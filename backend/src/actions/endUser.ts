/**
 * EndUser Actions - Read操作の実装
 * 
 * 設計原則:
 * - Read操作はWorkflowではなくActionsで実装
 * - ActivityをPick<>で依存注入
 * - 複数のActivityを協調させてビジネスロジックを実現
 */

import type { Auth0UserProfile, Auth0UserSummary } from '../activities/auth/auth0/types';

// Activity関数の型定義（try-catchベース）
type GetAuth0UserActivity = (userId: string) => Promise<Auth0UserProfile>;
type GetAuth0UserSummaryActivity = (userId: string) => Promise<Auth0UserSummary>;
type FindUserById = (userId: string) => Promise<any | null>;
type FindAuth0UserByEmail = (email: string) => Promise<Auth0UserProfile | null>;

// 依存関数の型定義
interface EndUserActionDeps {
    getAuth0UserActivity: GetAuth0UserActivity;
    getAuth0UserSummaryActivity: GetAuth0UserSummaryActivity;
    findUserById: FindUserById;
    findAuth0UserByEmail: FindAuth0UserByEmail;
}

/**
 * EndUser統合データ型定義
 */
export interface EndUser {
    platform_user_id: string;
    auth0_profile: Auth0UserProfile;
    platform_data: any;
    synchronized_at: Date;
}

/**
 * EndUser完全情報取得
 * 
 * @throws Error - Auth0操作エラー、ユーザーが見つからない場合
 */
export const getEndUserById = (deps: Pick<EndUserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        // Auth0 から取得（エラーは throw される）
        const user = await deps.getAuth0UserActivity(userId);
        return user;
    };

/**
 * EndUser最小限情報取得
 * リスト表示などで使用する軽量版
 * 
 * @throws Error - Auth0操作エラー、ユーザーが見つからない場合
 */
export const getEndUserSummaryById = (deps: Pick<EndUserActionDeps, 'getAuth0UserSummaryActivity'>) =>
    async (userId: string): Promise<Auth0UserSummary> => {
        // Auth0 から取得（エラーは throw される）
        const summary = await deps.getAuth0UserSummaryActivity(userId);
        return summary;
    };

/**
 * EndUser統合データ取得（Auth0 + DB）
 * 
 * Auth0とDBの両方のデータを取得し、統合して返す
 * メールアドレス、Auth0 ID、Platform IDのいずれかで検索可能
 * 
 * @throws Error - Auth0操作エラー、ユーザーが見つからない場合
 */
export const getEndUser = (deps: Pick<EndUserActionDeps, 'getAuth0UserActivity' | 'findUserById' | 'findAuth0UserByEmail'>) =>
    async (input: {
        auth0_user_id?: string;
        platform_user_id?: string;
        email?: string;
    }): Promise<EndUser | null> => {
        try {
            let auth0User: Auth0UserProfile | null = null;
            let dbUser: any | null = null;

            // email での検索
            if (input.email) {
                auth0User = await deps.findAuth0UserByEmail(input.email);
                if (!auth0User) {
                    return null;
                }
                // Auth0 User が見つかったので、そのIDでDB検索
                dbUser = await deps.findUserById(auth0User.user_id);
            } else {
                // user_id での検索
                const userId = input.auth0_user_id || input.platform_user_id;

                if (!userId) {
                    return null;
                }

                // Auth0とDBの両方からデータ取得
                [auth0User, dbUser] = await Promise.all([
                    deps.getAuth0UserActivity(userId),
                    deps.findUserById(userId),
                ]);
            }

            if (!auth0User || !dbUser) {
                return null;
            }

            return {
                platform_user_id: dbUser.id,
                auth0_profile: auth0User,
                platform_data: dbUser,
                synchronized_at: new Date(),
            };
        } catch (error) {
            // Auth0やDBのエラーはnullを返す（ユーザーが見つからない扱い）
            return null;
        }
    };
