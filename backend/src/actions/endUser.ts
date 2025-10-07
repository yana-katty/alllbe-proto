/**
 * EndUser Actions
 * 
 * エンドユーザー（一般参加者）に関するRead操作を提供
 * 実装の詳細（Auth0）は隠蔽し、ドメインロジックとして公開
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 * エラーは throw されるため、呼び出し側で try-catch でハンドリング
 * 
 * Note: CUD操作はWorkflow経由で実行（endUser.workflow.ts）
 */

import { log } from '@temporalio/activity';
import type { Auth0UserProfile, Auth0UserSummary } from '../activities/auth/auth0/types';

// Activity関数の型定義（try-catchベース）
type GetAuth0UserActivity = (userId: string) => Promise<Auth0UserProfile>;
type GetAuth0UserSummaryActivity = (userId: string) => Promise<Auth0UserSummary>;

// 依存関数の型定義
interface EndUserActionDeps {
    getAuth0UserActivity: GetAuth0UserActivity;
    getAuth0UserSummaryActivity: GetAuth0UserSummaryActivity;
}

/**
 * EndUser完全情報取得
 * 
 * @throws ApplicationFailure (type: USER_AUTH0_ERROR) - Auth0操作エラー
 * @throws ApplicationFailure (type: USER_NOT_FOUND) - ユーザーが見つからない場合
 */
export const getEndUserById = (deps: Pick<EndUserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        log.info('Getting end user by ID', { userId });

        // Auth0 から取得（エラーは throw される）
        const user = await deps.getAuth0UserActivity(userId);

        log.info('End user retrieved successfully', { userId, email: user.email });
        return user;
    };

/**
 * EndUser最小限情報取得
 * リスト表示などで使用する軽量版
 * 
 * @throws ApplicationFailure (type: USER_AUTH0_ERROR) - Auth0操作エラー
 * @throws ApplicationFailure (type: USER_NOT_FOUND) - ユーザーが見つからない場合
 */
export const getEndUserSummaryById = (deps: Pick<EndUserActionDeps, 'getAuth0UserSummaryActivity'>) =>
    async (userId: string): Promise<Auth0UserSummary> => {
        log.info('Getting end user summary by ID', { userId });

        // Auth0 から取得（エラーは throw される）
        const summary = await deps.getAuth0UserSummaryActivity(userId);

        log.info('End user summary retrieved successfully', {
            userId,
            emailVerified: summary.email_verified,
            blocked: summary.blocked
        });
        return summary;
    };
