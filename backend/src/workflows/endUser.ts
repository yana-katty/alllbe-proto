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
import type { Auth0UserCreateInput, Auth0UserUpdateInput, Auth0UserProfile } from '../activities/auth/auth0/types';

/**
 * Workflow Input/Output Types
 */

// EndUserCreateInput: Auth0データとプラットフォーム設定を含む
export interface EndUserCreateInput {
    auth0_data?: Auth0UserCreateInput;
    platform_settings?: Record<string, unknown>;
}

// EndUserUpdateInput: Auth0更新とプラットフォーム更新を含む
export interface EndUserUpdateInput {
    auth0_updates?: Auth0UserUpdateInput;
    platform_updates?: Record<string, unknown>;
}

// EndUser: ワークフロー実行結果として返されるエンドユーザー情報
export interface EndUser {
    platform_user_id: string;
    auth0_profile: Auth0UserProfile;
    platform_data: any;
    synchronized_at: Date;
}

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
} = proxyActivities<{
    getAuth0UserActivity: (userId: string) => Promise<Auth0UserProfile>;
    createAuth0UserActivity: (input: Auth0UserCreateInput) => Promise<Auth0UserProfile>;
    updateAuth0UserActivity: (userId: string, updates: Auth0UserUpdateInput) => Promise<Auth0UserProfile>;
    deleteAuth0UserActivity: (userId: string) => Promise<void>;
    getDbUserActivity: (auth0UserId: string) => Promise<any>;
    createDbUserActivity: (input: any) => Promise<any>;
    updateDbUserActivity: (platformUserId: string, updates: any) => Promise<any>;
    markDbUserDeletedActivity: (platformUserId: string) => Promise<void>;
    findDbUserByEmailActivity: (email: string) => Promise<any | null>;
    restoreDbUserActivity: (platformUserId: string, data: any) => Promise<any>;
    reactivateAuth0UserActivity: (userId: string) => Promise<Auth0UserProfile>;
}>({
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
        if (!input.auth0_data) {
            throw new Error('auth0_data is required for user creation');
        }
        const auth0User = await createAuth0UserActivity(input.auth0_data);

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

        // ActivityFailureの場合、元のApplicationFailureを抽出して再スロー
        if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure) {
            throw err.cause;
        }

        // ApplicationFailureの場合はそのまま再スロー
        if (err instanceof ApplicationFailure) {
            throw err;
        }

        // その他のエラーはApplicationFailureでラップ
        throw ApplicationFailure.nonRetryable(
            err instanceof Error ? err.message : 'EndUser creation failed',
            'ENDUSER_CREATION_ERROR'
        );
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
            await updateAuth0UserActivity(input.auth0_user_id, input.auth0_updates);

            // 補償アクション登録（以前の状態に復元）
            compensations.unshift({
                message: 'Restoring Auth0 profile to previous state',
                fn: async () => {
                    // Auth0UserUpdateInput型に必要なフィールドだけを抽出
                    const restoreData: Auth0UserUpdateInput = {
                        name: currentAuth0User.name,
                        family_name: currentAuth0User.family_name,
                        given_name: currentAuth0User.given_name,
                        picture: currentAuth0User.picture,
                        user_metadata: currentAuth0User.user_metadata,
                    };
                    await updateAuth0UserActivity(input.auth0_user_id, restoreData);
                },
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

        // ActivityFailureの場合、元のApplicationFailureを抽出して再スロー
        if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure) {
            throw err.cause;
        }

        // ApplicationFailureの場合はそのまま再スロー
        if (err instanceof ApplicationFailure) {
            throw err;
        }

        // その他のエラーはApplicationFailureでラップ
        throw ApplicationFailure.nonRetryable(
            err instanceof Error ? err.message : 'EndUser update failed',
            'ENDUSER_UPDATE_ERROR'
        );
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

        // ActivityFailureの場合、元のApplicationFailureを抽出して再スロー
        if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure) {
            throw err.cause;
        }

        // ApplicationFailureの場合はそのまま再スロー
        if (err instanceof ApplicationFailure) {
            throw err;
        }

        // その他のエラーはApplicationFailureでラップ
        throw ApplicationFailure.nonRetryable(
            err instanceof Error ? err.message : 'EndUser deletion failed',
            'ENDUSER_DELETION_ERROR'
        );
    }
}
