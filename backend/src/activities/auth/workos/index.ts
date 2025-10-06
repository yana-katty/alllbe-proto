/**
 * WorkOS Activities Export
 * 
 * WorkOS API を使用した Organization・Enterprise ユーザー管理Activity
 * 
 * 依存注入パターン（カリー化）:
 * - 各Activity関数は同名のカリー化された関数
 * - Worker起動時に環境変数から設定を読み込んで依存注入
 * - テストが容易（モック注入が簡単）
 */

// WorkOS Client
export {
    createWorkosClient,
    getWorkosConfigFromEnv,
    type WorkosConfig,
} from './workosClient';

// Organization Activities (カリー化された関数)
export {
    getWorkosOrganization,
    getWorkosOrganizationSummary,
    createWorkosOrganization,
    updateWorkosOrganization,
    deleteWorkosOrganization,
    listWorkosOrganizations,
    createWorkosOrganizationActivity,
    deleteWorkosOrganizationActivity,
} from './organization';

// User Activities (カリー化された関数)
export {
    getWorkosOrganizationUser,
    getWorkosUserSummary,
    createWorkosUser,
    createWorkosOrganizationMembership,
    updateWorkosUser,
    deleteWorkosUser,
    listWorkosOrganizationUsers,
    checkWorkosOrganizationMembership,
    deleteWorkosOrganizationMembership,
    createWorkosUserActivity,
    createWorkosOrganizationMembershipActivity,
} from './user';

// Types
export * from './types';
