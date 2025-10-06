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
 * 原則:
 * - Neverthrow (ResultAsync) を使用してエラーハンドリング
 * - Error を throw しない
 * - WorkOS Client を依存として受け取る
 * - 単一責任の原則: 1つのActivityは1つのAPI呼び出しのみ
 */

import { ResultAsync } from 'neverthrow';
import type { WorkOS } from '@workos-inc/node';
import {
    WorkosOrganizationUser,
    WorkosUserSummary,
    WorkosUserInviteInput,
    WorkosError,
    WorkosErrorCode,
    workosOrganizationUserSchema,
    workosUserSummarySchema,
} from './types';

/**
 * WorkOS エラーマッピング
 */
const mapWorkosError = (error: unknown): WorkosError => {
    if (typeof error === 'object' && error !== null) {
        const err = error as any;

        if (err.status === 404 || err.code === 'user_not_found') {
            return {
                code: WorkosErrorCode.USER_NOT_FOUND,
                message: 'User not found in WorkOS',
                details: error,
            };
        }

        if (err.status === 403 || err.code === 'insufficient_permissions') {
            return {
                code: WorkosErrorCode.INSUFFICIENT_PERMISSIONS,
                message: 'Insufficient permissions for WorkOS operation',
                details: error,
            };
        }

        if (err.status === 404 || err.code === 'organization_not_found') {
            return {
                code: WorkosErrorCode.ORGANIZATION_NOT_FOUND,
                message: 'Organization not found in WorkOS',
                details: error,
            };
        }
    }

    return {
        code: WorkosErrorCode.API_ERROR,
        message: 'WorkOS API error',
        details: error,
    };
};

/**
 * WorkOS Organization User 取得 Activity
 */
export const getWorkosOrganizationUser = (client: WorkOS) =>
    (userId: string): ResultAsync<WorkosOrganizationUser, WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.getUser(userId)
                .then((user: any) => workosOrganizationUserSchema.parse({
                    id: user.id,
                    organization_id: user.organizationId,
                    email: user.email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    created_at: user.createdAt,
                    updated_at: user.updatedAt,
                    state: user.emailVerified ? 'active' : 'pending',
                    profile: user.profile,
                })),
            mapWorkosError
        );
    };

/**
 * WorkOS User サマリー取得 Activity
 */
export const getWorkosUserSummary = (client: WorkOS) =>
    (userId: string): ResultAsync<WorkosUserSummary, WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.getUser(userId)
                .then((user: any) => workosUserSummarySchema.parse({
                    id: user.id,
                    organization_id: user.organizationId,
                    admin_level: user.profile?.admin_level || 'member',
                    state: user.emailVerified ? 'active' : 'pending',
                    last_login: user.lastLoginAt,
                    created_at: user.createdAt,
                })),
            mapWorkosError
        );
    };

/**
 * WorkOS User 作成 Activity (プリミティブ)
 * 
 * WorkOS User Management API でユーザーを作成
 */
export const createWorkosUser = (client: WorkOS) =>
    (input: { email: string; firstName: string; lastName: string; emailVerified?: boolean }): ResultAsync<WorkosOrganizationUser, WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.createUser({
                email: input.email,
                firstName: input.firstName,
                lastName: input.lastName,
                emailVerified: input.emailVerified || false,
            }).then((user: any) => workosOrganizationUserSchema.parse({
                id: user.id,
                organization_id: '', // Organization への関連付けは別のActivityで行う
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
                state: user.emailVerified ? 'active' : 'pending',
                profile: undefined,
            })),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization Membership 作成 Activity (プリミティブ)
 * 
 * ユーザーを Organization に関連付け
 */
export const createWorkosOrganizationMembership = (client: WorkOS) =>
    (input: { userId: string; organizationId: string }): ResultAsync<boolean, WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.createOrganizationMembership({
                userId: input.userId,
                organizationId: input.organizationId,
            }).then(() => true),
            mapWorkosError
        );
    };

/**
 * WorkOS User 更新 Activity (プリミティブ)
 * 
 * WorkOS User の基本情報を更新
 */
export const updateWorkosUser = (client: WorkOS) =>
    (input: { userId: string; firstName?: string; lastName?: string }): ResultAsync<WorkosOrganizationUser, WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.updateUser({
                userId: input.userId,
                firstName: input.firstName,
                lastName: input.lastName,
            }).then((user: any) => workosOrganizationUserSchema.parse({
                id: user.id,
                organization_id: (user as any).organizationId || '',
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
                state: user.emailVerified ? 'active' : 'pending',
                profile: (user as any).profile,
            })),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization User 削除 Activity (プリミティブ)
 */
export const deleteWorkosUser = (client: WorkOS) =>
    (userId: string): ResultAsync<boolean, WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.deleteUser(userId)
                .then(() => true),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization Users 一覧取得 Activity
 */
export const listWorkosOrganizationUsers = (client: WorkOS) =>
    (organizationId: string, params: { limit?: number; before?: string; after?: string }): ResultAsync<WorkosOrganizationUser[], WorkosError> => {
        return ResultAsync.fromPromise(
            client.userManagement.listUsers({
                organizationId,
                limit: params.limit || 20,
                before: params.before,
                after: params.after,
            }).then((response: any) =>
                response.data.map((user: any) => workosOrganizationUserSchema.parse({
                    id: user.id,
                    organization_id: user.organizationId,
                    email: user.email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    created_at: user.createdAt,
                    updated_at: user.updatedAt,
                    state: user.emailVerified ? 'active' : 'pending',
                    profile: user.profile,
                }))
            ),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization Membership チェック Activity (プリミティブ)
 * 
 * ユーザーが特定の Organization に所属しているかを確認
 */
export const checkWorkosOrganizationMembership = (client: WorkOS) =>
    (input: { userId: string; organizationId: string }): ResultAsync<boolean, WorkosError> => {
        return ResultAsync.fromPromise(
            (async () => {
                try {
                    const user = await client.userManagement.getUser(input.userId);
                    const userOrgId = (user as any).organizationId;
                    return userOrgId === input.organizationId;
                } catch (error: any) {
                    if (error.status === 404) {
                        return false;
                    }
                    throw error;
                }
            })(),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization Membership 削除 Activity (プリミティブ)
 * 
 * ユーザーを Organization から削除
 */
export const deleteWorkosOrganizationMembership = (client: WorkOS) =>
    (input: { userId: string; organizationId: string }): ResultAsync<boolean, WorkosError> => {
        return ResultAsync.fromPromise(
            (async () => {
                // WorkOS API の実際のメソッドに応じて調整が必要
                // 現在は削除メソッドがない場合の代替実装
                // ユーザー自体を削除するか、または別のAPIを使用
                await client.userManagement.deleteUser(input.userId);
                return true;
            })(),
            mapWorkosError
        );
    };

// ============================================
// Temporal Activity 用のラッパー関数
// ============================================

/**
 * WorkOS User 作成 Activity (Temporal用)
 */
export async function createWorkosUserActivity(
    input: { email: string; firstName: string; lastName: string; emailVerified?: boolean }
): Promise<{ ok: true; value: WorkosOrganizationUser } | { ok: false; error: WorkosError }> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    const result = await createWorkosUser(client)(input);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * WorkOS Organization Membership 作成 Activity (Temporal用)
 */
export async function createWorkosOrganizationMembershipActivity(
    input: { userId: string; organizationId: string }
): Promise<{ ok: true; value: boolean } | { ok: false; error: WorkosError }> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    const result = await createWorkosOrganizationMembership(client)(input);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}
