/**
 * Brand Workflows
 * 
 * Temporal Workflowsとして実行される Brand の CUD操作
 * Read操作は actions/brand.ts に実装
 * 
 * SAGA パターン:
 * - 複数のActivity呼び出しを組み合わせる
 * - 失敗時の補償処理（rollback）を実装
 * - プラン制限チェックを含む
 */

import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type { Brand } from '../activities/db/schema';
import type {
    BrandCreateInput,
    BrandUpdateInput,
    InsertBrand,
    FindBrandById,
    UpdateBrand,
    DeleteBrand,
    CountBrandsByOrganizationId,
} from '../activities/db/models/brand';
import { BrandErrorType, createBrandError } from '../activities/db/models/brand';

// Brand Activity Proxy
const {
    insertBrand,
    findBrandById,
    updateBrand,
    deleteBrand,
    countBrandsByOrganizationId,
} = proxyActivities<{
    insertBrand: InsertBrand;
    findBrandById: FindBrandById;
    updateBrand: UpdateBrand;
    deleteBrand: DeleteBrand;
    countBrandsByOrganizationId: CountBrandsByOrganizationId;
}>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

// プラン種別
export type PlanType = 'standard' | 'enterprise';

// プランごとのBrand制限
const BRAND_LIMITS: Record<PlanType, number> = {
    standard: 1,
    enterprise: 100,
};

// 補償処理の型定義
interface Compensation {
    message: string;
    fn: () => Promise<void>;
}

/**
 * 補償処理の実行
 */
async function compensate(compensations: Compensation[]): Promise<void> {
    for (const compensation of compensations) {
        try {
            log.info(`Compensating: ${compensation.message}`);
            await compensation.fn();
        } catch (error) {
            log.error(`Compensation failed: ${compensation.message}`, { error });
            // 補償処理が失敗してもcontinue（ログのみ）
        }
    }
}

// ============================================
// Temporal Workflows (C/U/D)
// ============================================

/**
 * Brand 作成 Workflow
 * 
 * SAGA パターン:
 * 1. プラン制限チェック（Standard: 1個、Enterprise: 100個）
 * 2. Brand 作成
 * 3. 失敗時は作成済みリソースを削除
 * 
 * @throws ApplicationFailure (type: BRAND_LIMIT_REACHED) - Brand数が上限に達している場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export async function createBrandWorkflow(
    input: BrandCreateInput,
    planType: PlanType = 'standard'
): Promise<Brand> {
    const compensations: Compensation[] = [];

    try {
        // Step 1: プラン制限チェック
        log.info('Checking brand limit', { organizationId: input.organizationId, planType });
        const count = await countBrandsByOrganizationId(input.organizationId);
        const limit = BRAND_LIMITS[planType];

        if (count >= limit) {
            throw createBrandError({
                type: BrandErrorType.LIMIT_REACHED,
                message: `Brand limit reached for ${planType} plan. Current: ${count}, Limit: ${limit}`,
                details: { organizationId: input.organizationId, planType, count, limit },
                nonRetryable: true,
            });
        }

        // Step 2: Brand 作成
        log.info('Creating Brand', { organizationId: input.organizationId, name: input.name });
        const brand = await insertBrand(input);
        log.info('Brand created successfully', { brandId: brand.id });

        compensations.unshift({
            message: `Deleting Brand: ${brand.id}`,
            fn: async () => {
                try {
                    await deleteBrand(brand.id);
                } catch (error) {
                    log.error('Failed to delete Brand', { error });
                }
            },
        });

        return brand;
    } catch (error) {
        log.error('createBrandWorkflow failed', { error });
        await compensate(compensations);
        throw error;
    }
}

/**
 * Brand 更新 Workflow
 * 
 * SAGA パターン:
 * 1. 既存Brand取得（バックアップ用）
 * 2. Brand 更新
 * 3. 失敗時は元の値に戻す
 * 
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が見つからない場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export async function updateBrandWorkflow(
    brandId: string,
    patch: BrandUpdateInput
): Promise<Brand> {
    const compensations: Compensation[] = [];

    try {
        // Step 1: 既存Brand取得（バックアップ用）
        log.info('Fetching existing Brand for backup', { brandId });
        const existingBrand = await findBrandById(brandId);

        if (!existingBrand) {
            throw createBrandError({
                type: BrandErrorType.NOT_FOUND,
                message: `Brand not found: ${brandId}`,
                details: { brandId },
                nonRetryable: true,
            });
        }

        // Step 2: Brand 更新
        log.info('Updating Brand', { brandId, patch });
        const updatedBrand = await updateBrand(brandId, patch);
        log.info('Brand updated successfully', { brandId });

        // 補償処理: 元の値に戻す
        compensations.unshift({
            message: `Reverting Brand: ${brandId}`,
            fn: async () => {
                try {
                    await updateBrand(brandId, {
                        name: existingBrand.name,
                        description: existingBrand.description,
                        logoUrl: existingBrand.logoUrl,
                        websiteUrl: existingBrand.websiteUrl,
                        isActive: existingBrand.isActive,
                    });
                } catch (error) {
                    log.error('Failed to revert Brand', { error });
                }
            },
        });

        return updatedBrand;
    } catch (error) {
        log.error('updateBrandWorkflow failed', { error });
        await compensate(compensations);
        throw error;
    }
}

/**
 * Brand 削除 Workflow
 * 
 * SAGA パターン:
 * 1. Brand取得（存在確認 + バックアップ用）
 * 2. 依存関係チェック（TODO: Experience等）
 * 3. Brand 削除
 * 4. 失敗時は元に戻す
 * 
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が見つからない場合
 * @throws ApplicationFailure (type: BRAND_HAS_DEPENDENCIES) - 依存するExperience等が存在する場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export async function deleteBrandWorkflow(brandId: string): Promise<boolean> {
    const compensations: Compensation[] = [];

    try {
        // Step 1: Brand取得（存在確認 + バックアップ用）
        log.info('Fetching Brand for deletion', { brandId });
        const existingBrand = await findBrandById(brandId);

        if (!existingBrand) {
            throw createBrandError({
                type: BrandErrorType.NOT_FOUND,
                message: `Brand not found: ${brandId}`,
                details: { brandId },
                nonRetryable: true,
            });
        }

        // Step 2: 依存関係チェック（TODO: Experience等）
        // TODO: Experience等の依存関係をチェック
        // const hasExperiences = await checkBrandHasExperiences(brandId);
        // if (hasExperiences) {
        //     throw createBrandError({
        //         type: BrandErrorType.HAS_DEPENDENCIES,
        //         message: `Cannot delete brand with existing experiences: ${brandId}`,
        //         details: { brandId },
        //         nonRetryable: true,
        //     });
        // }

        // Step 3: Brand 削除
        log.info('Deleting Brand', { brandId });
        const deleted = await deleteBrand(brandId);
        log.info('Brand deleted successfully', { brandId });

        // 補償処理: Brandを再作成
        compensations.unshift({
            message: `Restoring Brand: ${brandId}`,
            fn: async () => {
                try {
                    await insertBrand({
                        organizationId: existingBrand.organizationId,
                        name: existingBrand.name,
                        description: existingBrand.description ?? undefined,
                        logoUrl: existingBrand.logoUrl ?? undefined,
                        websiteUrl: existingBrand.websiteUrl ?? undefined,
                        isDefault: existingBrand.isDefault,
                    });
                } catch (error) {
                    log.error('Failed to restore Brand', { error });
                }
            },
        });

        return deleted;
    } catch (error) {
        log.error('deleteBrandWorkflow failed', { error });
        await compensate(compensations);
        throw error;
    }
}
