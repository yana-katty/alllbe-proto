/**
 * Organization Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作を提供し、tRPCから直接呼び出し可能
 * 
 * DB Organization と WorkOS Organization を統合:
 * - DB から基本情報を取得（id = WorkOS Organization ID）
 * - WorkOS からも情報を取得
 * - 統合されたデータを返す
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 */

import type { Organization } from '../activities/db/schema';
import type { OrganizationQueryInput } from '../activities/db/models/organization';
import type { WorkosOrganization } from '../activities/auth/workos/types';

// Activity関数の型定義
type GetOrganizationByIdActivity = (id: string) => Promise<{ ok: true; value: Organization | null } | { ok: false; error: any }>;
type ListOrganizationsActivity = (params: OrganizationQueryInput) => Promise<{ ok: true; value: Organization[] } | { ok: false; error: any }>;

// WorkOS Activity関数の型定義
type GetWorkosOrganizationActivity = (organizationId: string) => Promise<{ ok: true; value: WorkosOrganization } | { ok: false; error: any }>;

// 依存関数の型定義
interface OrganizationActionDeps {
    getOrganizationByIdActivity: GetOrganizationByIdActivity;
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

        // id が WorkOS Organization ID なので、直接 WorkOS から情報を取得
        if (deps.getWorkosOrganizationActivity) {
            try {
                const workosResult = await deps.getWorkosOrganizationActivity(org.id);
                if (workosResult.ok) {
                    return {
                        ...org,
                        workosData: workosResult.value,
                    };
                }
            } catch (error) {
                // WorkOS からの取得失敗はエラーにせず、DB データのみ返す
                console.warn('Failed to fetch WorkOS organization data', { organizationId: org.id, error });
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
                    try {
                        const workosResult = await deps.getWorkosOrganizationActivity!(org.id); // id が WorkOS Organization ID
                        if (workosResult.ok) {
                            return {
                                ...org,
                                workosData: workosResult.value,
                            };
                        }
                    } catch (error) {
                        console.warn('Failed to fetch WorkOS organization data', { organizationId: org.id, error });
                    }
                    return org;
                })
            );
            return enrichedOrganizations;
        }

        return organizations;
    };
