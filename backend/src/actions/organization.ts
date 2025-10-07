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
 * エラーは throw されるため、呼び出し側で try-catch でハンドリング
 */

import type { Organization } from '../activities/db/schema';
import type { OrganizationQueryInput } from '../activities/db/models/organization';
import type { WorkosOrganization } from '../activities/auth/workos/types';

// Activity関数の型定義（try-catchベース）
type GetOrganizationByIdActivity = (id: string) => Promise<Organization | null>;
type ListOrganizationsActivity = (params: OrganizationQueryInput) => Promise<Organization[]>;
type GetWorkosOrganizationActivity = (organizationId: string) => Promise<WorkosOrganization>;

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
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const getOrganizationById = (deps: Pick<OrganizationActionDeps, 'getOrganizationByIdActivity' | 'getWorkosOrganizationActivity'>) =>
    async (id: string): Promise<OrganizationWithWorkos | null> => {
        // DB から Organization を取得（エラーは throw される）
        const org = await deps.getOrganizationByIdActivity(id);

        if (!org) {
            return null;
        }

        // id が WorkOS Organization ID なので、直接 WorkOS から情報を取得
        if (deps.getWorkosOrganizationActivity) {
            try {
                const workosData = await deps.getWorkosOrganizationActivity(org.id);
                return {
                    ...org,
                    workosData,
                };
            } catch (error) {
                // WorkOS からの取得失敗はエラーにせず、DB データのみ返す
                console.warn('Failed to fetch WorkOS organization data', { organizationId: org.id, error });
            }
        }

        return org;
    };

/**
 * Organization一覧取得 - DB と WorkOS を統合
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const listOrganizations = (deps: Pick<OrganizationActionDeps, 'listOrganizationsActivity' | 'getWorkosOrganizationActivity'>) =>
    async (params: OrganizationQueryInput): Promise<OrganizationWithWorkos[]> => {
        // DB から Organizations を取得（エラーは throw される）
        const organizations = await deps.listOrganizationsActivity(params);

        // 各 Organization に対して WorkOS データを取得（並列処理）
        if (deps.getWorkosOrganizationActivity) {
            const enrichedOrganizations = await Promise.all(
                organizations.map(async (org) => {
                    try {
                        const workosData = await deps.getWorkosOrganizationActivity!(org.id);
                        return {
                            ...org,
                            workosData,
                        };
                    } catch (error) {
                        // 個別の WorkOS 取得失敗は無視
                        console.warn('Failed to fetch WorkOS organization data', { organizationId: org.id, error });
                        return org;
                    }
                })
            );
            return enrichedOrganizations;
        }

        return organizations;
    };
