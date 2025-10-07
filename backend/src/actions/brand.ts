/**
 * Brand Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作とビジネスロジックを提供し、tRPCから直接呼び出し可能
 * 
 * Standard プラン制限:
 * - Organization 配下に 1 Brand のみ許可（isDefault: true）
 * - 追加作成は BRAND_LIMIT_REACHED エラー
 * 
 * Enterprise プラン制限:
 * - Organization 配下に 最大 100 Brands まで許可
 * - 100個に達した場合は BRAND_LIMIT_REACHED エラー
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 * エラーは throw されるため、呼び出し側で try-catch でハンドリング
 */

import type { Brand } from '../activities/db/schema';
import type {
    BrandCreateInput,
    BrandUpdateInput,
    BrandsByOrganizationInput,
    InsertBrand,
    FindBrandById,
    FindBrandsByOrganizationId,
    FindDefaultBrandByOrganizationId,
    UpdateBrand,
    DeleteBrand,
    CountBrandsByOrganizationId,
} from '../activities/db/models/brand';
import { BrandErrorType, createBrandError } from '../activities/db/models/brand';

// プラン種別
export type PlanType = 'standard' | 'enterprise';

// プランごとのBrand制限
const BRAND_LIMITS: Record<PlanType, number> = {
    standard: 1,
    enterprise: 100,
};

// 依存関数の型定義
interface BrandActionDeps {
    insertBrandActivity: InsertBrand;
    findBrandByIdActivity: FindBrandById;
    findBrandsByOrganizationIdActivity: FindBrandsByOrganizationId;
    findDefaultBrandByOrganizationIdActivity: FindDefaultBrandByOrganizationId;
    updateBrandActivity: UpdateBrand;
    deleteBrandActivity: DeleteBrand;
    countBrandsByOrganizationIdActivity: CountBrandsByOrganizationId;
}

/**
 * Brand作成可能かチェック
 * 
 * Standard: 1つまで
 * Enterprise: 100個まで
 * 
 * @throws ApplicationFailure (type: BRAND_LIMIT_REACHED) - Brand数が上限に達している場合
 */
export const canCreateBrand = (deps: Pick<BrandActionDeps, 'countBrandsByOrganizationIdActivity'>) =>
    async (organizationId: string, planType: PlanType = 'standard'): Promise<boolean> => {
        const count = await deps.countBrandsByOrganizationIdActivity(organizationId);
        const limit = BRAND_LIMITS[planType];

        return count < limit;
    };

/**
 * Brand作成（プラン制限チェック付き）
 * 
 * @throws ApplicationFailure (type: BRAND_LIMIT_REACHED) - Brand数が上限に達している場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const createBrand = (deps: Pick<BrandActionDeps, 'insertBrandActivity' | 'countBrandsByOrganizationIdActivity'>) =>
    async (data: BrandCreateInput, planType: PlanType = 'standard'): Promise<Brand> => {
        // プラン制限チェック
        const count = await deps.countBrandsByOrganizationIdActivity(data.organizationId);
        const limit = BRAND_LIMITS[planType];

        if (count >= limit) {
            throw createBrandError({
                type: BrandErrorType.LIMIT_REACHED,
                message: `Brand limit reached for ${planType} plan. Current: ${count}, Limit: ${limit}`,
                details: { organizationId: data.organizationId, planType, count, limit },
                nonRetryable: true,
            });
        }

        // Brand作成
        return await deps.insertBrandActivity(data);
    };

/**
 * Brand取得 (ID指定)
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const getBrandById = (deps: Pick<BrandActionDeps, 'findBrandByIdActivity'>) =>
    async (id: string): Promise<Brand | null> => {
        return await deps.findBrandByIdActivity(id);
    };

/**
 * Organization配下のBrand一覧取得
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const listBrandsByOrganization = (deps: Pick<BrandActionDeps, 'findBrandsByOrganizationIdActivity'>) =>
    async (params: BrandsByOrganizationInput): Promise<Brand[]> => {
        return await deps.findBrandsByOrganizationIdActivity(params);
    };

/**
 * Organizationのデフォルトブランド取得
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const getDefaultBrand = (deps: Pick<BrandActionDeps, 'findDefaultBrandByOrganizationIdActivity'>) =>
    async (organizationId: string): Promise<Brand | null> => {
        return await deps.findDefaultBrandByOrganizationIdActivity(organizationId);
    };

/**
 * Brand更新
 * 
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が見つからない場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const updateBrand = (deps: Pick<BrandActionDeps, 'updateBrandActivity'>) =>
    async (id: string, patch: BrandUpdateInput): Promise<Brand> => {
        return await deps.updateBrandActivity(id, patch);
    };

/**
 * Brand削除（依存関係チェック付き）
 * 
 * TODO: Experience等の依存関係チェックを追加予定
 * 現時点では削除のみ実行
 * 
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が見つからない場合
 * @throws ApplicationFailure (type: BRAND_HAS_DEPENDENCIES) - 依存するExperience等が存在する場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const deleteBrand = (deps: Pick<BrandActionDeps, 'deleteBrandActivity' | 'findBrandByIdActivity'>) =>
    async (id: string): Promise<boolean> => {
        // Brand存在チェック
        const brand = await deps.findBrandByIdActivity(id);
        if (!brand) {
            throw createBrandError({
                type: BrandErrorType.NOT_FOUND,
                message: `Brand not found: ${id}`,
                details: { brandId: id },
                nonRetryable: true,
            });
        }

        // TODO: Experience等の依存関係チェック
        // const hasExperiences = await checkBrandHasExperiences(id);
        // if (hasExperiences) {
        //     throw createBrandError({
        //         type: BrandErrorType.HAS_DEPENDENCIES,
        //         message: `Cannot delete brand with existing experiences: ${id}`,
        //         details: { brandId: id },
        //         nonRetryable: true,
        //     });
        // }

        return await deps.deleteBrandActivity(id);
    };

/**
 * デフォルトBrandかチェック
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const isDefaultBrand = (deps: Pick<BrandActionDeps, 'findBrandByIdActivity'>) =>
    async (id: string): Promise<boolean> => {
        const brand = await deps.findBrandByIdActivity(id);
        return brand?.isDefault ?? false;
    };

/**
 * Brand数カウント
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const countBrands = (deps: Pick<BrandActionDeps, 'countBrandsByOrganizationIdActivity'>) =>
    async (organizationId: string): Promise<number> => {
        return await deps.countBrandsByOrganizationIdActivity(organizationId);
    };

/**
 * Brand Actions ファクトリ
 * 全てのAction関数を依存注入で生成
 * 
 * @param deps - Brand Activity関数の依存
 * @returns すべてのBrand Action関数
 */
export function createBrandActions(deps: BrandActionDeps) {
    return {
        canCreateBrand: canCreateBrand(deps),
        createBrand: createBrand(deps),
        getBrandById: getBrandById(deps),
        listBrandsByOrganization: listBrandsByOrganization(deps),
        getDefaultBrand: getDefaultBrand(deps),
        updateBrand: updateBrand(deps),
        deleteBrand: deleteBrand(deps),
        isDefaultBrand: isDefaultBrand(deps),
        countBrands: countBrands(deps),
    };
}
