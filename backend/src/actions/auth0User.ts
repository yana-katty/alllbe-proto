/**
 * Auth0 User Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作を提供し、tRPCから直接呼び出し可能
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 */

import { log } from '@temporalio/activity';
import { ApplicationFailure } from '@temporalio/common';
import type {
    Auth0UserProfile,
    Auth0UserSummary,
    Auth0UserCreateInput,
    Auth0UserUpdateInput,
} from '../activities/auth/auth0/types';

// Activity関数の型定義
type GetAuth0UserActivity = (userId: string) => Promise<Auth0UserProfile>;
type GetAuth0UserSummaryActivity = (userId: string) => Promise<Auth0UserSummary>;
type CreateAuth0UserActivity = (input: Auth0UserCreateInput) => Promise<Auth0UserProfile>;
type UpdateAuth0UserActivity = (userId: string, input: Auth0UserUpdateInput) => Promise<Auth0UserProfile>;

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
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const getAuth0UserById = (deps: Pick<Auth0UserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        log.info('Action: getAuth0UserById', { userId });

        try {
            const user = await deps.getAuth0UserActivity(userId);
            log.info('Successfully retrieved Auth0 user', { userId, email: user.email });
            return user;
        } catch (error) {
            log.error('Failed to get Auth0 user', { userId, error });
            throw error; // ApplicationFailure をそのまま再スロー
        }
    };

/**
 * Auth0 User Summary取得 (最小限の情報のみ)
 * 
 * @param deps - Activity依存
 * @returns Action関数
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const getAuth0UserSummaryById = (deps: Pick<Auth0UserActionDeps, 'getAuth0UserSummaryActivity'>) =>
    async (userId: string): Promise<Auth0UserSummary> => {
        log.info('Action: getAuth0UserSummaryById', { userId });

        try {
            const summary = await deps.getAuth0UserSummaryActivity(userId);
            log.info('Successfully retrieved Auth0 user summary', { userId });
            return summary;
        } catch (error) {
            log.error('Failed to get Auth0 user summary', { userId, error });
            throw error; // ApplicationFailure をそのまま再スロー
        }
    };
