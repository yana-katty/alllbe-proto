/**
 * WorkOS Organization Activities
 * 
 * WorkOS API を使用した Organization 管理
 * 
 * ⚠️ 重要: Activity は単一のAPI呼び出しのみを行う（プリミティブな操作）
 * - 複数のAPI呼び出しを組み合わせる処理は Workflow で実装
 * - Metadata 設定などの複雑な処理も Workflow で調整
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
    WorkosOrganization,
    WorkosOrganizationSummary,
    WorkosOrganizationCreateInput,
    workosOrganizationSchema,
    workosOrganizationSummarySchema,
} from './types';

// ============================================
// Error Definitions
// ============================================

/**
 * WorkOS Organization エラータイプ
 */
export enum WorkosOrganizationErrorType {
    NOT_FOUND = 'WORKOS_ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'WORKOS_ORGANIZATION_ALREADY_EXISTS',
    DOMAIN_ALREADY_EXISTS = 'WORKOS_DOMAIN_ALREADY_EXISTS',
    INVALID_DOMAIN = 'WORKOS_INVALID_DOMAIN',
    INSUFFICIENT_PERMISSIONS = 'WORKOS_INSUFFICIENT_PERMISSIONS',
    API_ERROR = 'WORKOS_API_ERROR',
}

/**
 * WorkOS Organization エラー情報
 */
export interface WorkosOrganizationErrorInfo {
    type: WorkosOrganizationErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * WorkOS Organization エラー作成ファクトリ
 */
export const createWorkosOrganizationError = (info: WorkosOrganizationErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};

/**
 * WorkOS エラーマッピング - WorkOS API エラーを ApplicationFailure に変換
 */
const mapWorkosError = (error: unknown): ApplicationFailure => {
    if (typeof error === 'object' && error !== null) {
        const err = error as any;

        // WorkOS API エラーコードのマッピング
        if (err.status === 404 || err.code === 'organization_not_found') {
            return createWorkosOrganizationError({
                type: WorkosOrganizationErrorType.NOT_FOUND,
                message: 'Organization not found in WorkOS',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.status === 409 || err.code === 'domain_already_exists') {
            return createWorkosOrganizationError({
                type: WorkosOrganizationErrorType.DOMAIN_ALREADY_EXISTS,
                message: 'Domain already exists in WorkOS',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.status === 400 || err.code === 'invalid_domain') {
            return createWorkosOrganizationError({
                type: WorkosOrganizationErrorType.INVALID_DOMAIN,
                message: 'Invalid domain format',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.status === 403 || err.code === 'insufficient_permissions') {
            return createWorkosOrganizationError({
                type: WorkosOrganizationErrorType.INSUFFICIENT_PERMISSIONS,
                message: 'Insufficient permissions for WorkOS operation',
                details: error,
                nonRetryable: true,
            });
        }
    }

    return createWorkosOrganizationError({
        type: WorkosOrganizationErrorType.API_ERROR,
        message: 'WorkOS API error',
        details: error,
        nonRetryable: false, // API エラーはリトライ可能
    });
};


// ============================================
// Activity Functions
// ============================================

/**
 * WorkOS Organization 取得 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_ORGANIZATION_NOT_FOUND) - Organization が見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const getWorkosOrganization = (client: WorkOS) =>
    async (organizationId: string): Promise<WorkosOrganization> => {
        try {
            const org = await client.organizations.getOrganization(organizationId);
            return workosOrganizationSchema.parse({
                id: org.id,
                name: org.name,
                domains: org.domains || [],
                created_at: org.createdAt,
                updated_at: org.updatedAt,
                metadata: org.metadata || undefined,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization サマリー取得 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_ORGANIZATION_NOT_FOUND) - Organization が見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const getWorkosOrganizationSummary = (client: WorkOS) =>
    async (organizationId: string): Promise<WorkosOrganizationSummary> => {
        try {
            const org = await client.organizations.getOrganization(organizationId);
            return workosOrganizationSummarySchema.parse({
                id: org.id,
                name: org.name,
                verified_domain_count: org.domains?.filter((d: any) => d.state === 'verified').length || 0,
                active_user_count: 0,
                enterprise_enabled: false, // WorkOS metadata から取得可能な場合は実装
                created_at: org.createdAt,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization 作成 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_DOMAIN_ALREADY_EXISTS) - ドメインが既に存在する場合
 * @throws ApplicationFailure (type: WORKOS_INVALID_DOMAIN) - 無効なドメイン形式の場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const createWorkosOrganization = (client: WorkOS) =>
    async (input: { name: string; domains: string[] }): Promise<WorkosOrganization> => {
        try {
            const org = await client.organizations.createOrganization({
                name: input.name,
                domainData: input.domains.map(domain => ({
                    domain,
                    state: 'pending' as any
                })),
            });
            return workosOrganizationSchema.parse({
                id: org.id,
                name: org.name,
                domains: org.domains || [],
                created_at: org.createdAt,
                updated_at: org.updatedAt,
                metadata: org.metadata || undefined,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization 更新 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_ORGANIZATION_NOT_FOUND) - Organization が見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const updateWorkosOrganization = (client: WorkOS) =>
    async (input: { organizationId: string; name?: string; domains?: string[] }): Promise<WorkosOrganization> => {
        try {
            const currentOrg = await client.organizations.getOrganization(input.organizationId);

            const updatedOrg = await client.organizations.updateOrganization({
                organization: input.organizationId,
                name: input.name || currentOrg.name,
                domainData: input.domains
                    ? input.domains.map(domain => ({ domain, state: 'pending' as any }))
                    : currentOrg.domains as any,
            });

            return workosOrganizationSchema.parse({
                id: updatedOrg.id,
                name: updatedOrg.name,
                domains: updatedOrg.domains || [],
                created_at: updatedOrg.createdAt,
                updated_at: updatedOrg.updatedAt,
                metadata: (currentOrg as any).metadata || undefined,
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization 削除 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_ORGANIZATION_NOT_FOUND) - Organization が見つからない場合
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const deleteWorkosOrganization = (client: WorkOS) =>
    async (organizationId: string): Promise<boolean> => {
        try {
            await client.organizations.deleteOrganization(organizationId);
            return true;
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

/**
 * WorkOS Organization 一覧取得 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_API_ERROR) - WorkOS API エラー
 */
export const listWorkosOrganizations = (client: WorkOS) =>
    async (params: { limit?: number; before?: string; after?: string }): Promise<WorkosOrganization[]> => {
        try {
            const response = await client.organizations.listOrganizations({
                limit: params.limit || 20,
                before: params.before,
                after: params.after,
            });
            return response.data.map((org: any) => workosOrganizationSchema.parse({
                id: org.id,
                name: org.name,
                domains: org.domains || [],
                created_at: org.createdAt,
                updated_at: org.updatedAt,
                metadata: org.metadata,
            }));
        } catch (error) {
            throw mapWorkosError(error);
        }
    };

// ============================================
// Temporal Activity 用のラッパー関数
// ============================================

/**
 * WorkOS Organization 作成 Activity (Temporal用)
 * 
 * @throws ApplicationFailure - WorkOS API エラー
 */
export async function createWorkosOrganizationActivity(
    input: { name: string; domains: string[] }
): Promise<WorkosOrganization> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    return await createWorkosOrganization(client)(input);
}

/**
 * WorkOS Organization 削除 Activity (Temporal用)
 * 
 * @throws ApplicationFailure - WorkOS API エラー
 */
export async function deleteWorkosOrganizationActivity(
    organizationId: string
): Promise<boolean> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    return await deleteWorkosOrganization(client)(organizationId);
}
