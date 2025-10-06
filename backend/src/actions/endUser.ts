/**
 * EndUser Actions
 * 
 * エンドユーザー（一般参加者）に関するRead操作を提供
 * 実装の詳細（Auth0）は隠蔽し、ドメインロジックとして公開
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 * 
 * Note: CUD操作はWorkflow経由で実行（endUser.workflow.ts）
 */

import { log } from '@temporalio/activity';
import type { ResultAsync } from 'neverthrow';
import type { Auth0UserProfile, Auth0UserSummary, Auth0Error } from '../activities/auth/auth0/types';

// Activity関数の型定義（カリー化されたActivity関数）
type GetAuth0UserActivity = (userId: string) => ResultAsync<Auth0UserProfile, Auth0Error>;
type GetAuth0UserSummaryActivity = (userId: string) => ResultAsync<Auth0UserSummary, Auth0Error>;

// 依存関数の型定義
interface EndUserActionDeps {
    getAuth0UserActivity: GetAuth0UserActivity;
    getAuth0UserSummaryActivity: GetAuth0UserSummaryActivity;
}

/**
 * EndUser完全情報取得
 * 依存注入により、テスト時にモックを差し込める
 * 
 * @param deps - Activity関数の依存
 * @returns EndUser取得関数
 */
export const getEndUserById = (deps: Pick<EndUserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        log.info('Getting end user by ID', { userId });

        const result = await deps.getAuth0UserActivity(userId);

        if (result.isErr()) {
            const error = result._unsafeUnwrapErr();
            log.error('Failed to get end user', { userId, error });
            throw new Error(`Failed to get end user: ${error.message}`);
        }

        const user = result._unsafeUnwrap();
        log.info('End user retrieved successfully', { userId, email: user.email });
        return user;
    };

/**
 * EndUser最小限情報取得
 * リスト表示などで使用する軽量版
 * 
 * @param deps - Activity関数の依存
 * @returns EndUser最小限情報取得関数
 */
export const getEndUserSummaryById = (deps: Pick<EndUserActionDeps, 'getAuth0UserSummaryActivity'>) =>
    async (userId: string): Promise<Auth0UserSummary> => {
        log.info('Getting end user summary by ID', { userId });

        const result = await deps.getAuth0UserSummaryActivity(userId);

        if (result.isErr()) {
            const error = result._unsafeUnwrapErr();
            log.error('Failed to get end user summary', { userId, error });
            throw new Error(`Failed to get end user summary: ${error.message}`);
        }

        const summary = result._unsafeUnwrap();
        log.info('End user summary retrieved successfully', {
            userId,
            emailVerified: summary.email_verified,
            blocked: summary.blocked
        });
        return summary;
    };

/**
 * 実際のActivity関数を使用したファクトリ関数
 * tRPCから呼び出す際はこれを使用
 * 
 * 使用例:
 * ```typescript
 * // tRPC Handler
 * import { createEndUserActions } from '@/actions/endUser';
 * 
 * export const userRouter = router({
 *   getById: protectedProcedure
 *     .input(z.string())
 *     .query(async ({ input }) => {
 *       const actions = await createEndUserActions();
 *       return actions.getById(input);
 *     }),
 * });
 * ```
 */
export async function createEndUserActions() {
    // Auth0 Activitiesを動的にインポート（実装の詳細を隠蔽）
    const {
        getAuth0User,
        getAuth0UserSummary,
        getAuth0ConfigFromEnv,
        createAuth0ManagementClient,
    } = await import('../activities/auth/auth0');

    // 起動時に環境変数を読み込んでAuth0クライアントを初期化
    const auth0Config = getAuth0ConfigFromEnv();
    const auth0Client = createAuth0ManagementClient(auth0Config);

    // カリー化された関数に依存を注入
    const getAuth0UserActivity = getAuth0User(auth0Client);
    const getAuth0UserSummaryActivity = getAuth0UserSummary(auth0Client);

    return {
        /**
         * EndUser完全情報取得（ID指定）
         * @param userId - Auth0 User ID
         * @returns EndUserの完全なプロフィール情報
         */
        getById: getEndUserById({ getAuth0UserActivity }),

        /**
         * EndUser最小限情報取得（ID指定）
         * @param userId - Auth0 User ID
         * @returns EndUserの最小限の情報（リスト表示用）
         */
        getSummaryById: getEndUserSummaryById({ getAuth0UserSummaryActivity }),
    };
}
