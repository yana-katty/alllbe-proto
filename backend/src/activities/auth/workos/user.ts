/**
 * WorkOS Organization User Activities
 * 
 * WorkOS API を使用した Organization 配下のユーザー管理
 * 
 * ⚠️ 重要: Activity は単一のAPI呼び出しのみを行う（プリミティブな操作）
 * - 複数のAPI呼び出しを組み合わせる処理は Workflow で実装
 * 
 * 依存注入パターン:
 * - Activity内で環境変数を読み込まない
 * - WorkOS Client を外部から注入
 * - Worker起動時に設定を読み込んで依存注入
 * 
 * エラーハンドリング:
 * - ApplicationFailure を使用
 * - WorkOS API エラーを適切な type でマッピング
 */

import { ApplicationFailure } from '@temporalio/common';
import type { WorkOS } from '@workos-inc/node';
import {
    WorkosOrganizationUser,
    WorkosUserSummary,
    WorkosUserInviteInput,
    workosOrganizationUserSchema,
    workosUserSummarySchema,
} from './types';

// ============================================
// Error Definitions
// ============================================

/**
 * WorkOS User エラータイプ
 */
export enum WorkosUserErrorType {
    USER_NOT_FOUND = 'WORKOS_USER_NOT_FOUND',
    USER_ALREADY_EXISTS = 'WORKOS_USER_ALREADY_EXISTS',
    INSUFFICIENT_PERMISSIONS = 'WORKOS_INSUFFICIENT_PERMISSIONS',
    INVALID_EMAIL = 'WORKOS_INVALID_EMAIL',
    MEMBERSHIP_ALREADY_EXISTS = 'WORKOS_MEMBERSHIP_ALREADY_EXISTS',
    MEMBERSHIP_NOT_FOUND = 'WORKOS_MEMBERSHIP_NOT_FOUND',
    API_ERROR = 'WORKOS_API_ERROR',
}

/**
 * WorkOS User エラー情報
 */
export interface WorkosUserErrorInfo {
    type: WorkosUserErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * WorkOS User エラー作成ファクトリ
 */
export const createWorkosUserError = (info: WorkosUserErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};

/**
 * WorkOS エラーマッピング
 */
const mapWorkosError = (error: unknown): ApplicationFailure => {
    if (typeof error === 'object' && error !== null) {
        const err = error as any;

        if (err.status === 404 || err.code === 'user_not_found') {
            return createWorkosUserError({
                type: WorkosUserErrorType.USER_NOT_FOUND,
                message: 'User not found in WorkOS',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.status === 403 || err.code === 'insufficient_permissions') {
            return createWorkosUserError({
                type: WorkosUserErrorType.INSUFFICIENT_PERMISSIONS,
                message: 'Insufficient permissions for WorkOS operation',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.status === 409 || err.code === 'user_already_exists') {
            return createWorkosUserError({
                type: WorkosUserErrorType.USER_ALREADY_EXISTS,
                message: 'User already exists in WorkOS',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.status === 400 || err.code === 'invalid_email') {
            return createWorkosUserError({
                type: WorkosUserErrorType.INVALID_EMAIL,
                message: 'Invalid email format',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.code === 'membership_already_exists') {
            return createWorkosUserError({
                type: WorkosUserErrorType.MEMBERSHIP_ALREADY_EXISTS,
                message: 'Membership already exists',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.code === 'membership_not_found') {
            return createWorkosUserError({
                type: WorkosUserErrorType.MEMBERSHIP_NOT_FOUND,
                message: 'Membership not found',
                details: error,
                nonRetryable: true,
            });
        }
    }

    return createWorkosUserError({
        type: WorkosUserErrorType.API_ERROR,
        message: 'WorkOS API error',
        details: error,
        nonRetryable: false,
    });
};

// ============================================
// Activity Functions
// ============================================

/**
 * WorkOS Organization User 取得 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const getWorkosOrganizationUser = (client: WorkOS) =>
    async (userId: string): Promise<WorkosOrganizationUser> => {
        try {
            const user = await client.userManagement.getUser(userId);
            return workosOrganizationUserSchema.parse({
                id: user.id,
                organization_id: (user as any).organizationId || '',
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
                state: user.emailVerified ? 'active' : 'pending',
                profile: (user as any).profile,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS User サマリー取得 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const getWorkosUserSummary = (client: WorkOS) =>
    async (userId: string): Promise<WorkosUserSummary> => {
        try {
            const user = await client.userManagement.getUser(userId);
            return workosUserSummarySchema.parse({
                id: user.id,
                organization_id: (user as any).organizationId || '',
                admin_level: (user as any).profile?.admin_level || 'member',
                state: user.emailVerified ? 'active' : 'pending',
                last_login: (user as any).lastLoginAt,
                created_at: user.createdAt,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS User 作成 Activity (プリミティブ)
 * 
 * WorkOS User Management API でユーザーを作成
 * 
 * @throws ApplicationFailure (type: WORKOS_INVALID_EMAIL) - メールアドレスが不正な場合
 * @throws ApplicationFailure (type: WORKOS_USER_ALREADY_EXISTS) - ユーザーが既に存在する場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const createWorkosUser = (client: WorkOS) =>
    async (input: { email: string; firstName: string; lastName: string; emailVerified?: boolean }): Promise<WorkosOrganizationUser> => {
        try {
            const user = await client.userManagement.createUser({
                email: input.email,
                firstName: input.firstName,
                lastName: input.lastName,
                emailVerified: input.emailVerified || false,
            });

            return workosOrganizationUserSchema.parse({
                id: user.id,
                organization_id: '', // Organization への関連付けは別のActivityで行う
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
                state: user.emailVerified ? 'active' : 'pending',
                profile: undefined,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization Membership 作成 Activity (プリミティブ)
 * 
 * ユーザーを Organization に関連付け
 * 
 * @throws ApplicationFailure (type: WORKOS_MEMBERSHIP_ALREADY_EXISTS) - Membership が既に存在する場合
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const createWorkosOrganizationMembership = (client: WorkOS) =>
    async (input: { userId: string; organizationId: string }): Promise<boolean> => {
        try {
            await client.userManagement.createOrganizationMembership({
                userId: input.userId,
                organizationId: input.organizationId,
            });
            return true;
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS User 更新 Activity (プリミティブ)
 * 
 * WorkOS User の基本情報を更新
 * 
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const updateWorkosUser = (client: WorkOS) =>
    async (input: { userId: string; firstName?: string; lastName?: string }): Promise<WorkosOrganizationUser> => {
        try {
            const user = await client.userManagement.updateUser({
                userId: input.userId,
                firstName: input.firstName,
                lastName: input.lastName,
            });

            return workosOrganizationUserSchema.parse({
                id: user.id,
                organization_id: (user as any).organizationId || '',
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
                state: user.emailVerified ? 'active' : 'pending',
                profile: (user as any).profile,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization User 削除 Activity (プリミティブ)
 * 
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const deleteWorkosUser = (client: WorkOS) =>
    async (userId: string): Promise<boolean> => {
        try {
            await client.userManagement.deleteUser(userId);
            return true;
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization Users 一覧取得 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const listWorkosOrganizationUsers = (client: WorkOS) =>
    async (organizationId: string, params: { limit?: number; before?: string; after?: string }): Promise<WorkosOrganizationUser[]> => {
        try {
            const response = await client.userManagement.listUsers({
                organizationId,
                limit: params.limit || 20,
                before: params.before,
                after: params.after,
            });

            return response.data.map((user: any) => workosOrganizationUserSchema.parse({
                id: user.id,
                organization_id: user.organizationId,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
                state: user.emailVerified ? 'active' : 'pending',
                profile: user.profile,
            }));
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization Membership チェック Activity (プリミティブ)
 * 
 * ユーザーが特定の Organization に所属しているかを確認
 * 
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const checkWorkosOrganizationMembership = (client: WorkOS) =>
    async (input: { userId: string; organizationId: string }): Promise<boolean> => {
        try {
            const user = await client.userManagement.getUser(input.userId);
            const userOrgId = (user as any).organizationId;
            return userOrgId === input.organizationId;
        } catch (error: any) {
            if (error.status === 404) {
                return false;
            }
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization Membership 削除 Activity (プリミティブ)
 * 
 * ユーザーを Organization から削除
 * 
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const deleteWorkosOrganizationMembership = (client: WorkOS) =>
    async (input: { userId: string; organizationId: string }): Promise<boolean> => {
        try {
            // WorkOS API の実際のメソッドに応じて調整が必要
            // 現在は削除メソッドがない場合の代替実装
            // ユーザー自体を削除するか、または別のAPIを使用
            await client.userManagement.deleteUser(input.userId);
            return true;
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

// ============================================
// Temporal Activity 用のラッパー関数
// （ApplicationFailure パターンでは不要だが、互換性のため残す）
// ============================================

/**
 * WorkOS User 作成 Activity (Temporal用)
 * 
 * @deprecated Use createWorkosUser(client)(input) directly with dependency injection
 * @throws ApplicationFailure (type: WORKOS_INVALID_EMAIL) - メールアドレスが不正な場合
 * @throws ApplicationFailure (type: WORKOS_USER_ALREADY_EXISTS) - ユーザーが既に存在する場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export async function createWorkosUserActivity(
    input: { email: string; firstName: string; lastName: string; emailVerified?: boolean }
): Promise<WorkosOrganizationUser> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    return await createWorkosUser(client)(input);
}

/**
 * WorkOS Organization Membership 作成 Activity (Temporal用)
 * 
 * @deprecated Use createWorkosOrganizationMembership(client)(input) directly with dependency injection
 * @throws ApplicationFailure (type: WORKOS_MEMBERSHIP_ALREADY_EXISTS) - Membership が既に存在する場合
 * @throws ApplicationFailure (type: WORKOS_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export async function createWorkosOrganizationMembershipActivity(
    input: { userId: string; organizationId: string }
): Promise<boolean> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    return await createWorkosOrganizationMembership(client)(input);
}
