/**
 * Auth0 Activities Export
 * 
 * Auth0 Management API を使用したエンドユーザー管理Activity
 * 
 * 依存注入パターン（カリー化）:
 * - 各Activity関数は同名のカリー化された関数
 * - Worker起動時に環境変数から設定を読み込んで依存注入
 * - テストが容易（モック注入が簡単）
 */

// Auth0 Client
export {
    createAuth0ManagementClient,
    getAuth0ConfigFromEnv,
    type Auth0Config,
} from './auth0Client';

// User Activities (カリー化された関数)
export {
    getAuth0User,
    getAuth0UserSummary,
    createAuth0User,
    updateAuth0User,
    deleteAuth0User,
    updateAuth0EmailVerification,
    blockAuth0User,
} from './user';

// Types
export * from './types';
