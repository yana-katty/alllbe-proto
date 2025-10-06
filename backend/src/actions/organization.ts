/**
 * Organization Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作を提供し、tRPCから直接呼び出し可能
 * 
 * DB Organization と WorkOS Organization を統合:
 * - DB から基本情報を取得
 * - workos_organization_id が存在する場合、WorkOS からも情報を取得
 * - 統合されたデータを返す
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 */

import type { Organization } from '../activities/db/schema';
import type { OrganizationQueryInput } from '../activities/db/models/organization';
import type { WorkosOrganization } from '../activities/auth/workos/types';

// Activity関数の型定義
type GetOrganizationByIdActivity = (id: string) => Promise<{ ok: true; value: Organization | null } | { ok: false; error: any }>;
type GetOrganizationByEmailActivity = (email: string) => Promise<{ ok: true; value: Organization | null } | { ok: false; error: any }>;
type GetOrganizationByWorkosIdActivity = (workosOrganizationId: string) => Promise<{ ok: true; value: Organization | null } | { ok: false; error: any }>;
type ListOrganizationsActivity = (params: OrganizationQueryInput) => Promise<{ ok: true; value: Organization[] } | { ok: false; error: any }>;

// WorkOS Activity関数の型定義
type GetWorkosOrganizationActivity = (organizationId: string) => Promise<{ ok: true; value: WorkosOrganization } | { ok: false; error: any }>;

// 依存関数の型定義
interface OrganizationActionDeps {
    getOrganizationByIdActivity: GetOrganizationByIdActivity;
    getOrganizationByEmailActivity: GetOrganizationByEmailActivity;
    getOrganizationByWorkosIdActivity: GetOrganizationByWorkosIdActivity;
    listOrganizationsActivity: ListOrganizationsActivity;
    getWorkosOrganizationActivity?: GetWorkosOrganizationActivity;
}

/**
 * Organization の統合データ型
 * DB + WorkOS の情報を統合
 */
export interface OrganizationWithWorkos extends Organization {
    workosData?: WorkosOrganization;
}

/**
 * Organization取得 (ID指定) - DB と WorkOS を統合
 * 依存注入により、テスト時にモックを差し込める
 */
export const getOrganizationById = (deps: Pick<OrganizationActionDeps, 'getOrganizationByIdActivity' | 'getWorkosOrganizationActivity'>) =>
    async (id: string): Promise<OrganizationWithWorkos | null> => {
        const result = await deps.getOrganizationByIdActivity(id);

        if (!result.ok) {
            throw new Error(`Failed to get organization: ${result.error.message}`);
        }

        if (!result.value) {
            return null;
        }

        const org = result.value;

        // workos_organization_id が存在する場合、WorkOS からも情報を取得
        if (org.workosOrganizationId && deps.getWorkosOrganizationActivity) {
            try {
                const workosResult = await deps.getWorkosOrganizationActivity(org.workosOrganizationId);
                if (workosResult.ok) {
                    return {
                        ...org,
                        workosData: workosResult.value,
                    };
                }
            } catch (error) {
                // WorkOS からの取得失敗はエラーにせず、DB データのみ返す
                console.warn('Failed to fetch WorkOS organization data', { workosOrganizationId: org.workosOrganizationId, error });
            }
        }

        return org;
    };

/**
 * Organization取得 (Email指定)
 */
export const getOrganizationByEmail = (deps: Pick<OrganizationActionDeps, 'getOrganizationByEmailActivity' | 'getWorkosOrganizationActivity'>) =>
    async (email: string): Promise<OrganizationWithWorkos | null> => {
        const result = await deps.getOrganizationByEmailActivity(email);

        if (!result.ok) {
            throw new Error(`Failed to get organization: ${result.error.message}`);
        }

        if (!result.value) {
            return null;
        }

        const org = result.value;

        // workos_organization_id が存在する場合、WorkOS からも情報を取得
        if (org.workosOrganizationId && deps.getWorkosOrganizationActivity) {
            try {
                const workosResult = await deps.getWorkosOrganizationActivity(org.workosOrganizationId);
                if (workosResult.ok) {
                    return {
                        ...org,
                        workosData: workosResult.value,
                    };
                }
            } catch (error) {
                console.warn('Failed to fetch WorkOS organization data', { workosOrganizationId: org.workosOrganizationId, error });
            }
        }

        return org;
    };

/**
 * Organization取得 (WorkOS ID指定)
 */
export const getOrganizationByWorkosId = (deps: Pick<OrganizationActionDeps, 'getOrganizationByWorkosIdActivity' | 'getWorkosOrganizationActivity'>) =>
    async (workosOrganizationId: string): Promise<OrganizationWithWorkos | null> => {
        const result = await deps.getOrganizationByWorkosIdActivity(workosOrganizationId);

        if (!result.ok) {
            throw new Error(`Failed to get organization: ${result.error.message}`);
        }

        if (!result.value) {
            return null;
        }

        const org = result.value;

        // WorkOS からも情報を取得
        if (deps.getWorkosOrganizationActivity) {
            try {
                const workosResult = await deps.getWorkosOrganizationActivity(workosOrganizationId);
                if (workosResult.ok) {
                    return {
                        ...org,
                        workosData: workosResult.value,
                    };
                }
            } catch (error) {
                console.warn('Failed to fetch WorkOS organization data', { workosOrganizationId, error });
            }
        }

        return org;
    };

/**
 * Organization一覧取得 - DB と WorkOS を統合
 */
export const listOrganizations = (deps: Pick<OrganizationActionDeps, 'listOrganizationsActivity' | 'getWorkosOrganizationActivity'>) =>
    async (params: OrganizationQueryInput): Promise<OrganizationWithWorkos[]> => {
        const result = await deps.listOrganizationsActivity(params);

        if (!result.ok) {
            throw new Error(`Failed to list organizations: ${result.error.message}`);
        }

        const organizations = result.value;

        // 各 Organization に対して WorkOS データを取得（並列処理）
        if (deps.getWorkosOrganizationActivity) {
            const enrichedOrganizations = await Promise.all(
                organizations.map(async (org) => {
                    if (org.workosOrganizationId) {
                        try {
                            const workosResult = await deps.getWorkosOrganizationActivity!(org.workosOrganizationId);
                            if (workosResult.ok) {
                                return {
                                    ...org,
                                    workosData: workosResult.value,
                                };
                            }
                        } catch (error) {
                            console.warn('Failed to fetch WorkOS organization data', { workosOrganizationId: org.workosOrganizationId, error });
                        }
                    }
                    return org;
                })
            );
            return enrichedOrganizations;
        }

        return organizations;
    };

/**
 * 実際のActivity関数を使用したファクトリ関数
 * tRPCから呼び出す際はこれを使用
 */
export async function createOrganizationActions() {
    const {
        getOrganizationByIdActivity,
        getOrganizationByEmailActivity,
        getOrganizationByWorkosIdActivity,
        listOrganizationsActivity,
    } = await import('../activities/db/models/organization');

    // WorkOS Organization Activity をインポート（オプション）
    let getWorkosOrganizationActivity: GetWorkosOrganizationActivity | undefined;
    try {
        const workosModule = await import('../activities/auth/workos');
        // WorkOS Organization 取得用の Activity ラッパーを作成
        getWorkosOrganizationActivity = async (organizationId: string) => {
            const { createWorkosClient, getWorkosConfigFromEnv, getWorkosOrganization } = workosModule;
            const config = getWorkosConfigFromEnv();
            const client = createWorkosClient(config);
            const result = await getWorkosOrganization(client)(organizationId);

            if (result.isErr()) {
                return { ok: false, error: result.error };
            }
            return { ok: true, value: result.value };
        };
    } catch (error) {
        console.warn('WorkOS module not available, organization actions will work without WorkOS data', { error });
    }

    return {
        getById: getOrganizationById({ getOrganizationByIdActivity, getWorkosOrganizationActivity }),
        getByEmail: getOrganizationByEmail({ getOrganizationByEmailActivity, getWorkosOrganizationActivity }),
        getByWorkosId: getOrganizationByWorkosId({ getOrganizationByWorkosIdActivity, getWorkosOrganizationActivity }),
        list: listOrganizations({ listOrganizationsActivity, getWorkosOrganizationActivity }),
    };
}
