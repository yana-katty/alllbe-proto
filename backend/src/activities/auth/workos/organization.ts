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
 * 原則:
 * - Neverthrow (ResultAsync) を使用してエラーハンドリング
 * - Error を throw しない
 * - WorkOS Client を依存として受け取る
 * - 単一責任の原則: 1つのActivityは1つのAPI呼び出しのみ
 */

import { ResultAsync } from 'neverthrow';
import type { WorkOS } from '@workos-inc/node';
import {
    WorkosOrganization,
    WorkosOrganizationSummary,
    WorkosOrganizationCreateInput,
    WorkosError,
    WorkosErrorCode,
    workosOrganizationSchema,
    workosOrganizationSummarySchema,
} from './types';

/**
 * WorkOS エラーマッピング - WorkOS API エラーを WorkosError に変換
 */
const mapWorkosError = (error: unknown): WorkosError => {
    if (typeof error === 'object' && error !== null) {
        const err = error as any;

        // WorkOS API エラーコードのマッピング
        if (err.status === 404 || err.code === 'organization_not_found') {
            return {
                code: WorkosErrorCode.ORGANIZATION_NOT_FOUND,
                message: 'Organization not found in WorkOS',
                details: error,
            };
        }

        if (err.status === 409 || err.code === 'domain_already_exists') {
            return {
                code: WorkosErrorCode.DOMAIN_ALREADY_EXISTS,
                message: 'Domain already exists in WorkOS',
                details: error,
            };
        }

        if (err.status === 400 || err.code === 'invalid_domain') {
            return {
                code: WorkosErrorCode.INVALID_DOMAIN,
                message: 'Invalid domain format',
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
    }

    return {
        code: WorkosErrorCode.API_ERROR,
        message: 'WorkOS API error',
        details: error,
    };
};

/**
 * WorkOS Organization 取得 Activity
 * 
 * 依存注入パターン: WorkOS Client を外部から注入
 * 
 * @param client - WorkOS Client
 * @returns Activity関数
 * 
 * @example
 * // Worker 起動時
 * const config = getWorkosConfigFromEnv();
 * const client = createWorkosClient(config);
 * 
 * const worker = await Worker.create({
 *   activities: {
 *     getWorkosOrganization: getWorkosOrganization(client),
 *     createWorkosOrganization: createWorkosOrganization(client),
 *     // ...
 *   },
 * });
 */
export const getWorkosOrganization = (client: WorkOS) =>
    (organizationId: string): ResultAsync<WorkosOrganization, WorkosError> => {
        return ResultAsync.fromPromise(
            client.organizations.getOrganization(organizationId)
                .then((org: any) => workosOrganizationSchema.parse({
                    id: org.id,
                    name: org.name,
                    domains: org.domains || [],
                    created_at: org.created_at,
                    updated_at: org.updated_at,
                    metadata: org.metadata,
                })),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization サマリー取得 Activity
 * 
 * DB連携で必要最小限の情報のみ取得
 */
export const getWorkosOrganizationSummary = (client: WorkOS) =>
    (organizationId: string): ResultAsync<WorkosOrganizationSummary, WorkosError> => {
        return ResultAsync.fromPromise(
            client.organizations.getOrganization(organizationId)
                .then((org: any) => workosOrganizationSummarySchema.parse({
                    id: org.id,
                    name: org.name,
                    verified_domain_count: org.domains?.filter((d: any) => d.state === 'verified').length || 0,
                    active_user_count: 0, // WorkOS API から取得する場合は別途実装
                    enterprise_enabled: org.metadata?.enterprise_settings?.sso_required || false,
                    created_at: org.created_at,
                })),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization 作成 Activity (プリミティブ)
 * 
 * 基本的な Organization を WorkOS に作成
 */
export const createWorkosOrganization = (client: WorkOS) =>
    (input: { name: string; domains: string[] }): ResultAsync<WorkosOrganization, WorkosError> => {
        return ResultAsync.fromPromise(
            client.organizations.createOrganization({
                name: input.name,
                domainData: input.domains.map(domain => ({
                    domain,
                    state: 'pending' as any
                })),
            }).then((org: any) => workosOrganizationSchema.parse({
                id: org.id,
                name: org.name,
                domains: org.domains || [],
                created_at: org.createdAt,
                updated_at: org.updatedAt,
                metadata: {},
            })),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization 更新 Activity (プリミティブ)
 * 
 * Organization の基本情報を更新
 */
export const updateWorkosOrganization = (client: WorkOS) =>
    (input: { organizationId: string; name?: string; domains?: string[] }): ResultAsync<WorkosOrganization, WorkosError> => {
        return ResultAsync.fromPromise(
            (async () => {
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
                    metadata: (currentOrg as any).metadata || {},
                });
            })(),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization 削除 Activity
 */
export const deleteWorkosOrganization = (client: WorkOS) =>
    (organizationId: string): ResultAsync<boolean, WorkosError> => {
        return ResultAsync.fromPromise(
            client.organizations.deleteOrganization(organizationId)
                .then(() => true),
            mapWorkosError
        );
    };

/**
 * WorkOS Organization 一覧取得 Activity
 */
export const listWorkosOrganizations = (client: WorkOS) =>
    (params: { limit?: number; before?: string; after?: string }): ResultAsync<WorkosOrganization[], WorkosError> => {
        return ResultAsync.fromPromise(
            client.organizations.listOrganizations({
                limit: params.limit || 20,
                before: params.before,
                after: params.after,
            }).then((response: any) =>
                response.data.map((org: any) => workosOrganizationSchema.parse({
                    id: org.id,
                    name: org.name,
                    domains: org.domains || [],
                    created_at: org.createdAt,
                    updated_at: org.updatedAt,
                    metadata: org.metadata,
                }))
            ),
            mapWorkosError
        );
    };

// ============================================
// Temporal Activity 用のラッパー関数
// ============================================

/**
 * WorkOS Organization 作成 Activity (Temporal用)
 */
export async function createWorkosOrganizationActivity(
    input: { name: string; domains: string[] }
): Promise<{ ok: true; value: WorkosOrganization } | { ok: false; error: WorkosError }> {
    // WorkOS Client は環境変数から取得（実装時に注入）
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    const result = await createWorkosOrganization(client)(input);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * WorkOS Organization 削除 Activity (Temporal用)
 */
export async function deleteWorkosOrganizationActivity(
    organizationId: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: WorkosError }> {
    const { createWorkosClient, getWorkosConfigFromEnv } = await import('./workosClient');
    const config = getWorkosConfigFromEnv();
    const client = createWorkosClient(config);

    const result = await deleteWorkosOrganization(client)(organizationId);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}
