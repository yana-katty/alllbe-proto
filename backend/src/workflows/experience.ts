/**
 * Experience Workflows
 * 
 * Experience の作成・更新・公開・削除などのワークフロー
 * 
 * @see .github/instructions/workflows.instructions.md
 * @see .github/instructions/backend-layers.instructions.md
 */

import { proxyActivities, log } from '@temporalio/workflow';
import { ApplicationFailure } from '@temporalio/common';
import type {
    InsertExperience,
    FindExperienceById,
    UpdateExperience,
    RemoveExperience,
    ExperienceCreateInput,
    ExperienceUpdateInput,
} from '../activities/db/models/experience';
import type { Experience } from '../activities/db/schema';
import type {
    FindBrandById,
} from '../activities/db/models/brand';

// Activity の型定義
const { insertExperience, findExperienceById, updateExperience, removeExperience, findBrandById } = proxyActivities<{
    insertExperience: InsertExperience;
    findExperienceById: FindExperienceById;
    updateExperience: UpdateExperience;
    removeExperience: RemoveExperience;
    findBrandById: FindBrandById;
}>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

/**
 * Experience 作成 Workflow
 * 
 * 1. Brand の存在確認
 * 2. Experience の作成（ステータス: 'draft'）
 * 
 * @param input - Experience 作成データ
 * @returns 作成された Experience
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export async function createExperienceWorkflow(input: ExperienceCreateInput): Promise<Experience> {
    log.info('Creating experience', { brandId: input.brandId, title: input.title });

    // Step 1: Brand の存在確認
    const brand = await findBrandById(input.brandId);
    if (!brand) {
        log.error('Brand not found', { brandId: input.brandId });
        throw ApplicationFailure.create({
            message: `Brand not found: ${input.brandId}`,
            type: 'BRAND_NOT_FOUND',
            nonRetryable: true,
        });
    }

    log.info('Brand verified', { brandId: brand.id, brandName: brand.name });

    // Step 2: Experience の作成
    try {
        const experience = await insertExperience(input);
        log.info('Experience created successfully', {
            experienceId: experience.id,
            title: experience.title,
            status: experience.status,
        });
        return experience;
    } catch (error) {
        log.error('Failed to create experience', { error, input });
        // ApplicationFailure はそのまま再スロー
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw ApplicationFailure.create({
            message: 'Failed to create experience',
            type: 'EXPERIENCE_DATABASE_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}

/**
 * Experience 更新 Workflow
 * 
 * 1. Experience の存在確認
 * 2. Experience の更新
 * 
 * @param id - Experience ID
 * @param patch - 更新データ
 * @returns 更新された Experience
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - Experience が存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export async function updateExperienceWorkflow(
    id: string,
    patch: ExperienceUpdateInput
): Promise<Experience> {
    log.info('Updating experience', { experienceId: id, patch });

    // Step 1: Experience の存在確認
    const existing = await findExperienceById(id);
    if (!existing) {
        log.error('Experience not found', { experienceId: id });
        throw ApplicationFailure.create({
            message: `Experience not found: ${id}`,
            type: 'EXPERIENCE_NOT_FOUND',
            nonRetryable: true,
        });
    }

    log.info('Experience verified', { experienceId: existing.id, currentStatus: existing.status });

    // Step 2: Experience の更新
    try {
        const updated = await updateExperience(id, patch);
        if (!updated) {
            throw ApplicationFailure.create({
                message: 'Failed to update experience: no rows returned',
                type: 'EXPERIENCE_DATABASE_ERROR',
                nonRetryable: false,
            });
        }

        log.info('Experience updated successfully', {
            experienceId: updated.id,
            changes: patch,
        });
        return updated;
    } catch (error) {
        log.error('Failed to update experience', { error, experienceId: id, patch });
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw ApplicationFailure.create({
            message: 'Failed to update experience',
            type: 'EXPERIENCE_DATABASE_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}

/**
 * Experience 公開 Workflow
 * 
 * ステータスを 'draft' → 'published' に変更
 * 
 * @param id - Experience ID
 * @returns 公開された Experience
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - Experience が存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_INVALID_STATUS) - 既に公開済みの場合
 */
export async function publishExperienceWorkflow(id: string): Promise<Experience> {
    log.info('Publishing experience', { experienceId: id });

    // Experience の存在確認
    const existing = await findExperienceById(id);
    if (!existing) {
        log.error('Experience not found', { experienceId: id });
        throw ApplicationFailure.create({
            message: `Experience not found: ${id}`,
            type: 'EXPERIENCE_NOT_FOUND',
            nonRetryable: true,
        });
    }

    // ステータス確認
    if (existing.status === 'published') {
        log.warn('Experience already published', { experienceId: id });
        throw ApplicationFailure.create({
            message: 'Experience is already published',
            type: 'EXPERIENCE_INVALID_STATUS',
            nonRetryable: true,
        });
    }

    // ステータスを 'published' に変更
    try {
        const published = await updateExperience(id, { status: 'published' });
        if (!published) {
            throw ApplicationFailure.create({
                message: 'Failed to publish experience: no rows returned',
                type: 'EXPERIENCE_DATABASE_ERROR',
                nonRetryable: false,
            });
        }

        log.info('Experience published successfully', {
            experienceId: published.id,
            status: published.status,
        });
        return published;
    } catch (error) {
        log.error('Failed to publish experience', { error, experienceId: id });
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw ApplicationFailure.create({
            message: 'Failed to publish experience',
            type: 'EXPERIENCE_DATABASE_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}

/**
 * Experience 終了 Workflow
 * 
 * ステータスを 'ended' に変更
 * 
 * @param id - Experience ID
 * @returns 終了された Experience
 */
export async function endExperienceWorkflow(id: string): Promise<Experience> {
    log.info('Ending experience', { experienceId: id });

    const existing = await findExperienceById(id);
    if (!existing) {
        throw ApplicationFailure.create({
            message: `Experience not found: ${id}`,
            type: 'EXPERIENCE_NOT_FOUND',
            nonRetryable: true,
        });
    }

    const ended = await updateExperience(id, { status: 'ended' });
    if (!ended) {
        throw ApplicationFailure.create({
            message: 'Failed to end experience',
            type: 'EXPERIENCE_DATABASE_ERROR',
            nonRetryable: false,
        });
    }

    log.info('Experience ended successfully', { experienceId: ended.id });
    return ended;
}

/**
 * Experience アーカイブ Workflow
 * 
 * ステータスを 'archived' に変更
 * 
 * @param id - Experience ID
 * @returns アーカイブされた Experience
 */
export async function archiveExperienceWorkflow(id: string): Promise<Experience> {
    log.info('Archiving experience', { experienceId: id });

    const existing = await findExperienceById(id);
    if (!existing) {
        throw ApplicationFailure.create({
            message: `Experience not found: ${id}`,
            type: 'EXPERIENCE_NOT_FOUND',
            nonRetryable: true,
        });
    }

    const archived = await updateExperience(id, { status: 'archived' });
    if (!archived) {
        throw ApplicationFailure.create({
            message: 'Failed to archive experience',
            type: 'EXPERIENCE_DATABASE_ERROR',
            nonRetryable: false,
        });
    }

    log.info('Experience archived successfully', { experienceId: archived.id });
    return archived;
}

/**
 * Experience 削除 Workflow
 * 
 * Experience を削除（関連する ExperienceAssets も CASCADE 削除）
 * 
 * @param id - Experience ID
 * @returns 削除成功の場合 true
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - Experience が存在しない場合
 */
export async function deleteExperienceWorkflow(id: string): Promise<boolean> {
    log.info('Deleting experience', { experienceId: id });

    // Experience の存在確認
    const existing = await findExperienceById(id);
    if (!existing) {
        log.error('Experience not found', { experienceId: id });
        throw ApplicationFailure.create({
            message: `Experience not found: ${id}`,
            type: 'EXPERIENCE_NOT_FOUND',
            nonRetryable: true,
        });
    }

    log.info('Experience verified, proceeding with deletion', {
        experienceId: existing.id,
        title: existing.title,
        brandId: existing.brandId,
    });

    // Experience の削除（CASCADE により ExperienceAssets も削除）
    try {
        const deleted = await removeExperience(id);
        log.info('Experience deleted successfully', { experienceId: id, result: deleted });
        return deleted;
    } catch (error) {
        log.error('Failed to delete experience', { error, experienceId: id });
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw ApplicationFailure.create({
            message: 'Failed to delete experience',
            type: 'EXPERIENCE_DATABASE_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}
