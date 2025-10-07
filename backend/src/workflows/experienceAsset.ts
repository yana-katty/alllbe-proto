/**
 * Experience Asset Workflows
 * 
 * Experience Asset の作成・更新・削除処理
 * 
 * Workflow の設計原則:
 * - Activity は proxyActivities で呼び出し
 * - ApplicationFailure をそのまま throw（Temporal標準）
 * - 複雑な補償処理が必要な場合は SAGA パターンを使用
 */

import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type {
    InsertExperienceAsset,
    FindExperienceAssetById,
    UpdateExperienceAsset,
    RemoveExperienceAsset,
    ExperienceAssetCreateInput,
    ExperienceAssetUpdateInput,
} from '../activities/db/models/experienceAssets';
import type { FindExperienceById } from '../activities/db/models/experience';
import type { ExperienceAsset } from '../activities/db/schema';

// Activity の proxyActivities 設定
const {
    insertExperienceAsset,
    findExperienceAssetById,
    updateExperienceAsset,
    removeExperienceAsset,
    findExperienceById,
} = proxyActivities<{
    insertExperienceAsset: InsertExperienceAsset;
    findExperienceAssetById: FindExperienceAssetById;
    updateExperienceAsset: UpdateExperienceAsset;
    removeExperienceAsset: RemoveExperienceAsset;
    findExperienceById: FindExperienceById;
}>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

// ============================================
// Experience Asset Workflows
// ============================================

/**
 * Experience Asset 作成 Workflow
 * 
 * 処理フロー:
 * 1. Experience の存在確認
 * 2. Experience Asset の作成
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - Experience が存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export async function createExperienceAssetWorkflow(input: ExperienceAssetCreateInput): Promise<ExperienceAsset> {
    log.info('Creating experience asset', { experienceId: input.experienceId, title: input.title });

    // Step 1: Experience の存在確認
    const experience = await findExperienceById(input.experienceId);

    if (!experience) {
        log.error('Experience not found', { experienceId: input.experienceId });
        throw ApplicationFailure.create({
            message: `Experience not found: ${input.experienceId}`,
            type: 'EXPERIENCE_NOT_FOUND',
            details: [{ experienceId: input.experienceId }],
            nonRetryable: true,
        });
    }

    log.debug('Experience found', { experienceId: experience.id, brandId: experience.brandId });

    // Step 2: Experience Asset の作成
    try {
        const asset = await insertExperienceAsset(input);
        log.info('Experience asset created successfully', { assetId: asset.id, experienceId: asset.experienceId });
        return asset;
    } catch (error) {
        // ApplicationFailure はそのまま再スロー
        if (error instanceof ApplicationFailure) {
            log.error('Failed to create experience asset', {
                type: error.type,
                message: error.message,
                experienceId: input.experienceId,
            });
            throw error;
        }
        // 予期しないエラー
        throw ApplicationFailure.create({
            message: 'Unexpected error in createExperienceAssetWorkflow',
            type: 'WORKFLOW_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}

/**
 * Experience Asset 更新 Workflow
 * 
 * 処理フロー:
 * 1. Experience Asset の存在確認
 * 2. Experience Asset の更新
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_NOT_FOUND) - Asset が存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export async function updateExperienceAssetWorkflow(
    id: string,
    patch: ExperienceAssetUpdateInput
): Promise<ExperienceAsset> {
    log.info('Updating experience asset', { assetId: id, patch });

    // Step 1: Experience Asset の存在確認
    const existing = await findExperienceAssetById(id);

    if (!existing) {
        log.error('Experience asset not found', { assetId: id });
        throw ApplicationFailure.create({
            message: `Experience asset not found: ${id}`,
            type: 'EXPERIENCE_ASSET_NOT_FOUND',
            details: [{ assetId: id }],
            nonRetryable: true,
        });
    }

    log.debug('Experience asset found', { assetId: existing.id, experienceId: existing.experienceId });

    // Step 2: Experience Asset の更新
    try {
        const updated = await updateExperienceAsset(id, patch);
        log.info('Experience asset updated successfully', { assetId: updated.id });
        return updated;
    } catch (error) {
        // ApplicationFailure はそのまま再スロー
        if (error instanceof ApplicationFailure) {
            log.error('Failed to update experience asset', {
                type: error.type,
                message: error.message,
                assetId: id,
            });
            throw error;
        }
        // 予期しないエラー
        throw ApplicationFailure.create({
            message: 'Unexpected error in updateExperienceAssetWorkflow',
            type: 'WORKFLOW_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}

/**
 * Experience Asset 削除 Workflow
 * 
 * 処理フロー:
 * 1. Experience Asset の存在確認（オプション）
 * 2. Experience Asset の削除
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export async function deleteExperienceAssetWorkflow(id: string): Promise<boolean> {
    log.info('Deleting experience asset', { assetId: id });

    try {
        const deleted = await removeExperienceAsset(id);

        if (deleted) {
            log.info('Experience asset deleted successfully', { assetId: id });
        } else {
            log.warn('Experience asset not found or already deleted', { assetId: id });
        }

        return deleted;
    } catch (error) {
        // ApplicationFailure はそのまま再スロー
        if (error instanceof ApplicationFailure) {
            log.error('Failed to delete experience asset', {
                type: error.type,
                message: error.message,
                assetId: id,
            });
            throw error;
        }
        // 予期しないエラー
        throw ApplicationFailure.create({
            message: 'Unexpected error in deleteExperienceAssetWorkflow',
            type: 'WORKFLOW_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}
