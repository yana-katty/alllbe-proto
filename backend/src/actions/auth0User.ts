/**
 * Auth0 User Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作を提供し、tRPCから直接呼び出し可能
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 */

import { log } from '@temporalio/activity';
import type {
    Auth0UserProfile,
    Auth0UserSummary,
    Auth0UserCreateInput,
    Auth0UserUpdateInput,
} from '../activities/auth/auth0/types';
import { ResultAsync } from 'neverthrow';

// Activity関数の型定義
type GetAuth0UserActivity = (userId: string) => ResultAsync<Auth0UserProfile, any>;
type GetAuth0UserSummaryActivity = (userId: string) => ResultAsync<Auth0UserSummary, any>;
type CreateAuth0UserActivity = (input: Auth0UserCreateInput) => ResultAsync<Auth0UserProfile, any>;
type UpdateAuth0UserActivity = (userId: string, input: Auth0UserUpdateInput) => ResultAsync<Auth0UserProfile, any>;

// 依存関数の型定義
interface Auth0UserActionDeps {
    getAuth0UserActivity: GetAuth0UserActivity;
    getAuth0UserSummaryActivity: GetAuth0UserSummaryActivity;
    createAuth0UserActivity: CreateAuth0UserActivity;
    updateAuth0UserActivity: UpdateAuth0UserActivity;
}

/**
 * Auth0 User取得 (ID指定)
 * 
 * @param deps - Activity依存
 * @returns Action関数
 */
export const getAuth0UserById = (deps: Pick<Auth0UserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        log.info('Action: getAuth0UserById', { userId });

        const result = await deps.getAuth0UserActivity(userId);

        if (result.isErr()) {
            log.error('Failed to get Auth0 user', { userId, error: result.error });
            throw new Error(`Failed to get Auth0 user: ${result.error.message}`);
        }

        log.info('Successfully retrieved Auth0 user', { userId, email: result.value.email });
        return result.value;
    };

/**
 * Auth0 User Summary取得 (最小限の情報のみ)
 * 
 * @param deps - Activity依存
 * @returns Action関数
 */
export const getAuth0UserSummaryById = (deps: Pick<Auth0UserActionDeps, 'getAuth0UserSummaryActivity'>) =>
    async (userId: string): Promise<Auth0UserSummary> => {
        log.info('Action: getAuth0UserSummaryById', { userId });

        const result = await deps.getAuth0UserSummaryActivity(userId);

        if (result.isErr()) {
            log.error('Failed to get Auth0 user summary', { userId, error: result.error });
            throw new Error(`Failed to get Auth0 user summary: ${result.error.message}`);
        }

        log.info('Successfully retrieved Auth0 user summary', { userId });
        return result.value;
    };

/**
 * 実際のActivity関数を使用したファクトリ関数
 * tRPCから呼び出す際はこれを使用
 * 
 * @example
 * // tRPC Handler
 * const actions = await createAuth0UserActions(auth0Client);
 * const user = await actions.getById('auth0|123456');
 */
export async function createAuth0UserActions(client: any, connectionName?: string) {
    const {
        getAuth0User,
        getAuth0UserSummary,
        createAuth0User,
        updateAuth0User,
    } = await import('../activities/auth/auth0');

    // Activity関数に依存を注入
    const getAuth0UserActivity = getAuth0User(client);
    const getAuth0UserSummaryActivity = getAuth0UserSummary(client);
    const createAuth0UserActivity = createAuth0User(client, connectionName || 'Username-Password-Authentication');
    const updateAuth0UserActivity = updateAuth0User(client);

    return {
        getById: getAuth0UserById({ getAuth0UserActivity }),
        getSummaryById: getAuth0UserSummaryById({ getAuth0UserSummaryActivity }),
        // Create/Update は Workflow経由を推奨（補償処理が必要なため）
        // 必要に応じて追加可能
    };
}
