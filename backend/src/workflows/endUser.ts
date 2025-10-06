/**
 * EndUser Workflows - Auth0エンドユーザー管理の複合操作
 * 
 * 複数のActivityを協調してEndUserの作成・更新・削除を行うWorkflow群。
 * SAGAパターンでエラーハンドリングと補償アクションを実装。
 * 
 * 設計原則:
 * - service/repositoryディレクトリは作成せず、Activityで直接実装
 * - 排他制御はWorkflow Id Reuse PolicyのDuplicateでclient側で管理
 * - 複雑な状態管理やSignal/Updateは使用せず、シンプルな処理フローに留める
 */

import { proxyActivities, log, ActivityFailure, ApplicationFailure } from '@temporalio/workflow';
import type { EndUserCreateInput, EndUserUpdateInput, EndUser } from '../activities/auth/endUser';
import type * as activities from '../activities';

// Activity のプロキシ
const {
    getAuth0UserActivity,
    createAuth0UserActivity,
    updateAuth0UserActivity,
    deleteAuth0UserActivity,
    getDbUserActivity,
    createDbUserActivity,
    updateDbUserActivity,
    markDbUserDeletedActivity,
    findDbUserByEmailActivity,
    restoreDbUserActivity,
    reactivateAuth0UserActivity,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '30s',
        backoffCoefficient: 2.0,
        maximumAttempts: 3,
    },
});

/**
 * SAGA Compensation Interface - 補償アクション定義
 */
interface Compensation {
    message: string;
    fn: () => Promise<void>;
}

/**
 * 補償アクション実行 - エラー発生時に成功した操作を逆順で取り消し
 */
async function compensate(compensations: Compensation[] = []): Promise<void> {
    if (compensations.length > 0) {
        log.info('Failures encountered during operation - compensating');
        for (const comp of compensations) {
            try {
                log.info(comp.message);
                await comp.fn();
            } catch (err) {
                log.error(`Failed to compensate: ${err}`, { err });
                // swallow compensation errors
            }
        }
    }
}

/**
 * EndUser作成Workflow
 * 
 * Auth0ユーザー作成 → DBユーザー作成の順番で実行。
 * 失敗時は成功した操作を逆順で補償アクション実行。
 */
export async function createEndUserWorkflow(
    input: EndUserCreateInput
): Promise<EndUser> {
    const compensations: Compensation[] = [];

    try {
        // Step 1: 重複チェック（冪等性）
        const email = input.auth0_data?.email || '';
        const existingUser = await findDbUserByEmailActivity(email);

        if (existingUser) {
            // 既存ユーザーが存在する場合、そのユーザー情報を返す
            const auth0User = await getAuth0UserActivity(existingUser.auth0_user_id);

            return {
                platform_user_id: existingUser.platform_user_id,
                auth0_profile: auth0User,
                platform_data: existingUser,
                synchronized_at: new Date(),
            };
        }

        // Step 2: Auth0ユーザー作成
        log.info('Creating Auth0 user', { email });
        const auth0User = await createAuth0UserActivity(input);

        // 成功時の補償アクション登録（Auth0ユーザー削除）
        compensations.unshift({
            message: 'Rolling back Auth0 user creation',
            fn: () => deleteAuth0UserActivity(auth0User.user_id),
        });

        // Step 3: DBユーザー作成
        log.info('Creating DB user', { auth0_user_id: auth0User.user_id });
        const dbUser = await createDbUserActivity({
            auth0_user_id: auth0User.user_id,
            ...input.platform_settings,
        });

        // 成功時の補償アクション登録（DBユーザー削除マーク）
        compensations.unshift({
            message: 'Rolling back DB user creation',
            fn: () => markDbUserDeletedActivity(dbUser.platform_user_id),
        });

        log.info('EndUser created successfully', {
            platform_user_id: dbUser.platform_user_id,
            auth0_user_id: auth0User.user_id
        });

        return {
            platform_user_id: dbUser.platform_user_id,
            auth0_profile: auth0User,
            platform_data: dbUser,
            synchronized_at: new Date(),
        };

    } catch (err) {
        log.error('Error during EndUser creation', { error: err });

        // 補償アクション実行
        await compensate(compensations);

        // 元のエラーをre-throw
        throw err;
    }
}

/**
 * EndUser更新Workflow
 * 
 * Auth0プロフィール更新 → DBプラットフォーム設定更新の順番で実行。
 * 失敗時は以前の状態に復元。
 */
export async function updateEndUserWorkflow(
    input: EndUserUpdateInput & { auth0_user_id: string }
): Promise<EndUser> {
    const compensations: Compensation[] = [];

    try {
        const currentDbUser = await getDbUserActivity(input.auth0_user_id);
        const currentAuth0User = await getAuth0UserActivity(input.auth0_user_id);

        // Step 1: Auth0プロフィール更新
        if (input.auth0_updates) {
            log.info('Updating Auth0 profile', { auth0_user_id: input.auth0_user_id });
            await updateAuth0UserActivity(input.auth0_user_id, input);

            // 補償アクション登録（以前の状態に復元）
            compensations.unshift({
                message: 'Restoring Auth0 profile to previous state',
                fn: () => updateAuth0UserActivity(input.auth0_user_id, { auth0_updates: currentAuth0User }),
            });
        }

        // Step 2: DBプラットフォーム設定更新
        if (input.platform_updates) {
            log.info('Updating platform settings', { auth0_user_id: input.auth0_user_id });
            await updateDbUserActivity(currentDbUser.platform_user_id, input.platform_updates);

            // 補償アクション登録（以前の状態に復元）
            compensations.unshift({
                message: 'Restoring DB user to previous state',
                fn: () => restoreDbUserActivity(currentDbUser.platform_user_id, currentDbUser),
            });
        }

        // 更新後の最新データを取得
        const updatedDbUser = await getDbUserActivity(input.auth0_user_id);
        const updatedAuth0User = await getAuth0UserActivity(input.auth0_user_id);

        log.info('EndUser updated successfully', { auth0_user_id: input.auth0_user_id });

        return {
            platform_user_id: updatedDbUser.platform_user_id,
            auth0_profile: updatedAuth0User,
            platform_data: updatedDbUser,
            synchronized_at: new Date(),
        };

    } catch (err) {
        log.error('Error during EndUser update', { error: err });

        // 補償アクション実行
        await compensate(compensations);

        // 元のエラーをre-throw
        throw err;
    }
}

/**
 * EndUser削除Workflow
 * 
 * Auth0ユーザー削除 → DBユーザー削除マークの順番で実行。
 * 物理削除ではなく、論理削除（is_active=false）を実行。
 */
export async function deleteEndUserWorkflow(
    input: { auth0_user_id: string }
): Promise<void> {
    try {
        const currentDbUser = await getDbUserActivity(input.auth0_user_id);

        // Step 1: Auth0ユーザー削除
        log.info('Deleting Auth0 user', { auth0_user_id: input.auth0_user_id });
        await deleteAuth0UserActivity(input.auth0_user_id);

        // Step 2: DBユーザー削除マーク（論理削除）
        log.info('Marking DB user as deleted', { platform_user_id: currentDbUser.platform_user_id });
        await markDbUserDeletedActivity(currentDbUser.platform_user_id);

        log.info('EndUser deletion completed', { auth0_user_id: input.auth0_user_id });

    } catch (err) {
        log.error('Critical error during EndUser deletion', {
            error: err,
            auth0_user_id: input.auth0_user_id
        });

        // 削除処理では補償は困難なため、エラーログを出力してre-throw
        throw err;
    }
}

import { proxyActivities, uuid4, log, ActivityFailure, ApplicationFailure } from '@temporalio/workflow';
import type { EndUserCreateInput, EndUserUpdateInput, EndUser } from '../activities/auth/endUser';
import type * as activities from '../activities';

// Activity のプロキシ
const {
    getAuth0UserActivity,
    createAuth0UserActivity,
    updateAuth0UserActivity,
    deleteAuth0UserActivity,
    getDbUserActivity,
    createDbUserActivity,
    updateDbUserActivity,
    markDbUserDeletedActivity,
    findDbUserByEmailActivity,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '30s',
        backoffCoefficient: 2.0,
        maximumAttempts: 3,
    },
});

/**
 * SAGA Compensation Interface - 補償アクション定義
 */
interface Compensation {
    message: string;
    fn: () => Promise<void>;
}

/**
 * 補償アクション実行 - エラー発生時に成功した操作を逆順で取り消し
 */
async function compensate(compensations: Compensation[] = []): Promise<void> {
    if (compensations.length > 0) {
        log.info('failures encountered during user creation - compensating');
        for (const comp of compensations) {
            try {
                log.error(comp.message);
                await comp.fn();
            } catch (err) {
                log.error(`failed to compensate: ${prettyErrorMessage('', err)}`, { err });
                // 補償失敗は記録するが、Workflowは継続
            }
        }
    }
}

/**
 * エラーメッセージ整形
 */
function prettyErrorMessage(message: string, err?: any): string {
    let errMessage = err && err.message ? err.message : '';
    if (err && err instanceof ActivityFailure) {
        errMessage = `${err.cause?.message}`;
    }
    return `${message}: ${errMessage}`;
}


/**
 * Workflow: EndUser作成
 * 
 * SAGA パターン: Auth0ユーザー作成 → DBユーザー作成の順次実行。
 * 失敗時は成功した操作を逆順で補償アクション実行。
 */
export async function createEndUserWorkflow(
    input: EndUserCreateInput
): Promise<EndUser> {
    const compensations: Compensation[] = [];

    try {
        // Step 1: 重複チェック（冪等性）
        const existingUser = await findDbUserByEmailActivity(input.auth0_data?.email || '');

        if (existingUser) {
            // 既存ユーザーが存在する場合、そのユーザー情報を返す
            const auth0User = await getAuth0UserActivity(existingUser.auth0_user_id);

            if (auth0User.isErr()) {
                throw new Error(`Failed to get existing Auth0 user: ${auth0User.error.message}`);
            }

            return {
                platform_user_id: existingUser.value.id,
                auth0_profile: auth0User.value,
                platform_data: existingUser.value,
                synchronized_at: new Date(),
            };
        }

        // Step 2: Auth0ユーザー作成
        let auth0User: any;
        try {
            const auth0Result = await createAuth0UserActivity(
                input.auth0_data,
                { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
            );

            if (auth0Result.isErr()) {
                throw new Error(`Failed to create Auth0 user: ${auth0Result.error.message}`);
            }

            auth0User = auth0Result.value;

            // 成功した場合、補償アクションを追加（最初に追加されたものが最後に実行される）
            compensations.unshift({
                message: prettyErrorMessage('reversing Auth0 user creation'),
                fn: () => deleteAuth0UserActivity(
                    { user_id: auth0User.user_id },
                    { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
                ),
            });

        } catch (err) {
            log.error('Auth0 user creation failed. stopping.');
            throw err;
        }

        // Step 3: DBユーザー作成
        try {
            const dbResult = await createDbUserActivity(
                {
                    auth0_user_id: auth0User.user_id,
                    platform_data: input.platform_settings
                },
                { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
            );

            if (dbResult.isErr()) {
                throw new Error(`Failed to create DB user: ${dbResult.error.message}`);
            }

            return {
                platform_user_id: dbResult.value.id,
                auth0_profile: auth0User,
                platform_data: dbResult.value,
                synchronized_at: new Date(),
            };

        } catch (err) {
            if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure) {
                log.error(err.cause.message);
            } else {
                log.error(`error while creating DB user: ${err}`);
            }
            // エラーが発生したので補償アクション実行
            await compensate(compensations);
            throw err;
        }

    } catch (error) {
        throw error;
    }
}

/**
 * Workflow: EndUser更新
 * 
 * SAGA パターン: Auth0更新とDB更新を並行実行。
 * 一方が失敗した場合は成功した方を元の状態にロールバック。
 */
export async function updateEndUserWorkflow(
    input: { auth0_user_id: string } & EndUserUpdateInput
): Promise<EndUser> {
    const compensations: Compensation[] = [];

    try {
        // 現在の状態を取得（ロールバック用）
        const [currentAuth0Result, currentDbResult] = await Promise.all([
            getAuth0UserActivity(
                { user_id: input.auth0_user_id },
                { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
            ),
            getDbUserActivity(
                { auth0_user_id: input.auth0_user_id },
                { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
            ),
        ]);

        if (currentAuth0Result.isErr() || currentDbResult.isErr()) {
            throw new Error('Failed to get current user state for update');
        }

        const currentAuth0User = currentAuth0Result.value;
        const currentDbUser = currentDbResult.value;

        // 並行更新実行
        let auth0UpdateResult: any;
        let dbUpdateResult: any;

        try {
            // Auth0 更新
            if (input.auth0_updates) {
                auth0UpdateResult = await updateAuth0UserActivity(
                    { user_id: input.auth0_user_id, updates: input.auth0_updates },
                    { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
                );

                if (auth0UpdateResult.isErr()) {
                    throw new Error(`Auth0 update failed: ${auth0UpdateResult.error.message}`);
                }

                // 成功した場合、補償アクションを追加
                compensations.unshift({
                    message: prettyErrorMessage('reversing Auth0 user update'),
                    fn: () => updateAuth0UserActivity(
                        { user_id: input.auth0_user_id, updates: currentAuth0User },
                        { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
                    ),
                });
            } else {
                auth0UpdateResult = { isOk: () => true, value: currentAuth0User };
            }

            // DB 更新
            if (input.platform_updates) {
                dbUpdateResult = await updateDbUserActivity(
                    { auth0_user_id: input.auth0_user_id, updates: input.platform_updates },
                    { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
                );

                if (dbUpdateResult.isErr()) {
                    throw new Error(`DB update failed: ${dbUpdateResult.error.message}`);
                }

                // 成功した場合、補償アクションを追加（DB更新は最後なので、最初に戻される）
                compensations.unshift({
                    message: prettyErrorMessage('reversing DB user update'),
                    fn: () => updateDbUserActivity(
                        { auth0_user_id: input.auth0_user_id, updates: currentDbUser },
                        { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
                    ),
                });
            } else {
                dbUpdateResult = { isOk: () => true, value: currentDbUser };
            }

            return {
                platform_user_id: dbUpdateResult.value.id,
                auth0_profile: auth0UpdateResult.value,
                platform_data: dbUpdateResult.value,
                synchronized_at: new Date(),
            };

        } catch (err) {
            if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure) {
                log.error(err.cause.message);
            } else {
                log.error(`error while updating user: ${err}`);
            }
            // エラーが発生したので補償アクション実行
            await compensate(compensations);
            throw err;
        }

    } catch (error) {
        throw error;
    }
}

/**
 * Workflow: EndUser削除
 * 
 * SAGA パターン: Auth0削除 → DBステータス更新の順次実行。
 * Auth0削除成功後のDB更新失敗は重大なエラー（補償不可能）として扱う。
 */
export async function deleteEndUserWorkflow(
    input: { auth0_user_id: string }
): Promise<{ deleted: boolean }> {
    try {
        // 現在の状態確認（冪等性）
        const dbUserResult = await getDbUserActivity(
            { auth0_user_id: input.auth0_user_id },
            { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
        );

        if (dbUserResult.isErr()) {
            // ユーザーが見つからない場合は既に削除済み
            return { deleted: true };
        }

        if (dbUserResult.value.status === 'deleted') {
            // 既に削除マーク済み
            return { deleted: true };
        }

        // Auth0ユーザー削除
        try {
            const deleteAuth0Result = await deleteAuth0UserActivity(
                { user_id: input.auth0_user_id },
                { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
            );

            if (deleteAuth0Result.isErr()) {
                throw new Error(`Failed to delete Auth0 user: ${deleteAuth0Result.error.message}`);
            }

        } catch (err) {
            log.error('Auth0 user deletion failed. stopping.');
            throw err;
        }

        // DBステータス更新
        try {
            const markDeletedResult = await markDbUserDeletedActivity(
                { auth0_user_id: input.auth0_user_id },
                { activity_id: uuid4(), attempt: 1, timeout_seconds: 30 }
            );

            if (markDeletedResult.isErr()) {
                // Auth0は削除済み、DBステータス更新失敗は重大なエラー
                // この場合、Auth0ユーザーは復元できないため補償アクションは実行しない
                // 代わりに重大なエラーとしてログに記録し、手動対応が必要
                log.error('Critical error: Auth0 user deleted but DB status update failed. Manual intervention required.', {
                    auth0_user_id: input.auth0_user_id,
                    error: markDeletedResult.error.message
                });
                throw new Error(`Critical error: DB status update failed: ${markDeletedResult.error.message}`);
            }

            return { deleted: true };

        } catch (err) {
            if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure) {
                log.error(err.cause.message);
            } else {
                log.error(`error while updating DB status: ${err}`);
            }
            throw err;
        }

    } catch (error) {
        throw error;
    }
}

