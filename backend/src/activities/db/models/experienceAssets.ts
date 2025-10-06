import { z } from 'zod';
import { ResultAsync } from 'neverthrow';
import { Database } from '../connection';
import { experienceAssets, selectExperienceAssetSchema } from '../schema';
import type { ExperienceAsset } from '../schema';
import { eq, and } from 'drizzle-orm';

// ExperienceAsset関連の入力スキーマ
export const experienceAssetCreateSchema = z.object({
    experienceId: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    assetType: z.enum(['video', 'article', 'image', 'download', 'audio']),
    assetUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    contentTiming: z.enum(['before', 'after', 'anytime']),
    category: z.enum(['story', 'making', 'guide', 'column', 'interview', 'other']).optional(),
    categoryLabel: z.string().optional(),
    accessLevel: z.enum(['public', 'ticket_holder', 'attended']).default('public'),
    displayOrder: z.string().default('0'),
    fileSize: z.string().optional(),
    duration: z.string().optional(),
});

export const experienceAssetUpdateSchema = experienceAssetCreateSchema.partial().omit({
    experienceId: true,
});

export const experienceAssetIdSchema = z.object({ id: z.string().uuid() });

export const experienceAssetQuerySchema = z.object({
    experienceId: z.string().uuid().optional(),
    contentTiming: z.enum(['before', 'after', 'anytime']).optional(),
    category: z.enum(['story', 'making', 'guide', 'column', 'interview', 'other']).optional(),
    accessLevel: z.enum(['public', 'ticket_holder', 'attended']).optional(),
    assetType: z.enum(['video', 'article', 'image', 'download', 'audio']).optional(),
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
});

export type ExperienceAssetCreateInput = z.infer<typeof experienceAssetCreateSchema>;
export type ExperienceAssetUpdateInput = z.infer<typeof experienceAssetUpdateSchema>;
export type ExperienceAssetIdInput = z.infer<typeof experienceAssetIdSchema>;
export type ExperienceAssetQueryInput = z.infer<typeof experienceAssetQuerySchema>;

// エラー定義
export enum ExperienceAssetErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    INVALID = 'INVALID',
    DATABASE = 'DATABASE',
    UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface ExperienceAssetError {
    code: ExperienceAssetErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T> { data: T; message: string }

export type InsertExperienceAsset = (data: ExperienceAssetCreateInput) => ResultAsync<ExperienceAsset, ExperienceAssetError>;
export type FindExperienceAssetById = (id: string) => ResultAsync<ExperienceAsset | null, ExperienceAssetError>;
export type ListExperienceAssets = (params: ExperienceAssetQueryInput) => ResultAsync<ExperienceAsset[], ExperienceAssetError>;
export type ListExperienceAssetsByExperience = (experienceId: string, params?: Partial<ExperienceAssetQueryInput>) => ResultAsync<ExperienceAsset[], ExperienceAssetError>;
export type UpdateExperienceAsset = (id: string, patch: ExperienceAssetUpdateInput) => ResultAsync<ExperienceAsset | null, ExperienceAssetError>;
export type RemoveExperienceAsset = (id: string) => ResultAsync<boolean, ExperienceAssetError>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertExperienceAsset = (db: Database): InsertExperienceAsset =>
    (data: ExperienceAssetCreateInput) => {
        return ResultAsync.fromPromise(
            db.insert(experienceAssets).values({
                experienceId: data.experienceId,
                title: data.title,
                description: data.description,
                assetType: data.assetType,
                assetUrl: data.assetUrl,
                thumbnailUrl: data.thumbnailUrl,
                contentTiming: data.contentTiming,
                category: data.category,
                categoryLabel: data.categoryLabel,
                accessLevel: data.accessLevel ?? 'public',
                displayOrder: data.displayOrder ?? '0',
                fileSize: data.fileSize,
                duration: data.duration,
            }).returning().then(r => selectExperienceAssetSchema.parse(r[0])),
            (error) => ({ code: ExperienceAssetErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findExperienceAssetById = (db: Database): FindExperienceAssetById =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.select().from(experienceAssets).where(eq(experienceAssets.id, id)).limit(1).then(r => r[0] ? selectExperienceAssetSchema.parse(r[0]) : null),
            (error) => ({ code: ExperienceAssetErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const listExperienceAssets = (db: Database): ListExperienceAssets =>
    (params: ExperienceAssetQueryInput) => {
        const { experienceId, contentTiming, category, accessLevel, assetType, isActive, limit, offset } = params;
        const cond: any[] = [];

        if (experienceId) cond.push(eq(experienceAssets.experienceId, experienceId));
        if (contentTiming) cond.push(eq(experienceAssets.contentTiming, contentTiming));
        if (category) cond.push(eq(experienceAssets.category, category));
        if (accessLevel) cond.push(eq(experienceAssets.accessLevel, accessLevel));
        if (assetType) cond.push(eq(experienceAssets.assetType, assetType));
        if (isActive !== undefined) cond.push(eq(experienceAssets.isActive, isActive));

        const whereClause = cond.length ? and(...cond) : undefined;

        return ResultAsync.fromPromise(
            db.select().from(experienceAssets).where(whereClause).limit(limit).offset(offset).orderBy(experienceAssets.displayOrder, experienceAssets.createdAt).then(rows => rows.map(r => selectExperienceAssetSchema.parse(r))),
            (error) => ({ code: ExperienceAssetErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const listExperienceAssetsByExperience = (db: Database): ListExperienceAssetsByExperience =>
    (experienceId: string, params?: Partial<ExperienceAssetQueryInput>) => {
        const fullParams: ExperienceAssetQueryInput = {
            experienceId,
            limit: params?.limit ?? 50,
            offset: params?.offset ?? 0,
            ...params,
        };
        return listExperienceAssets(db)(fullParams);
    };

export const updateExperienceAsset = (db: Database): UpdateExperienceAsset =>
    (id: string, patch: ExperienceAssetUpdateInput) => {
        const updateData: Partial<typeof experienceAssets.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };

        if (patch.title !== undefined) updateData.title = patch.title;
        if (patch.description !== undefined) updateData.description = patch.description;
        if (patch.assetType !== undefined) updateData.assetType = patch.assetType;
        if (patch.assetUrl !== undefined) updateData.assetUrl = patch.assetUrl;
        if (patch.thumbnailUrl !== undefined) updateData.thumbnailUrl = patch.thumbnailUrl;
        if (patch.contentTiming !== undefined) updateData.contentTiming = patch.contentTiming;
        if (patch.category !== undefined) updateData.category = patch.category;
        if (patch.categoryLabel !== undefined) updateData.categoryLabel = patch.categoryLabel;
        if (patch.accessLevel !== undefined) updateData.accessLevel = patch.accessLevel;
        if (patch.displayOrder !== undefined) updateData.displayOrder = patch.displayOrder;
        if (patch.fileSize !== undefined) updateData.fileSize = patch.fileSize;
        if (patch.duration !== undefined) updateData.duration = patch.duration;

        return ResultAsync.fromPromise(
            db.update(experienceAssets).set(updateData).where(eq(experienceAssets.id, id)).returning().then(r => r[0] ? selectExperienceAssetSchema.parse(r[0]) : null),
            (error) => ({ code: ExperienceAssetErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeExperienceAsset = (db: Database): RemoveExperienceAsset =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.delete(experienceAssets).where(eq(experienceAssets.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: ExperienceAssetErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

// ============================================
// Activity Functions (Temporal用)
// ============================================

/**
 * ExperienceAsset作成Activity
 * @param data 作成データ
 * @returns 作成されたExperienceAsset、またはエラー
 */
export async function createExperienceAssetActivity(
    data: ExperienceAssetCreateInput
): Promise<{ ok: true; value: ExperienceAsset } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await insertExperienceAsset(db)(data);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * ExperienceAsset取得Activity (ID指定)
 * @param id ExperienceAsset ID
 * @returns 取得されたExperienceAsset、またはエラー
 */
export async function getExperienceAssetByIdActivity(
    id: string
): Promise<{ ok: true; value: ExperienceAsset | null } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await findExperienceAssetById(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * ExperienceAsset一覧取得Activity
 * @param params クエリパラメータ
 * @returns ExperienceAsset配列、またはエラー
 */
export async function listExperienceAssetsActivity(
    params: ExperienceAssetQueryInput
): Promise<{ ok: true; value: ExperienceAsset[] } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listExperienceAssets(db)(params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Experience別ExperienceAsset一覧取得Activity
 * @param experienceId Experience ID
 * @param params クエリパラメータ
 * @returns ExperienceAsset配列、またはエラー
 */
export async function listExperienceAssetsByExperienceActivity(
    experienceId: string,
    params?: Partial<ExperienceAssetQueryInput>
): Promise<{ ok: true; value: ExperienceAsset[] } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listExperienceAssetsByExperience(db)(experienceId, params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * ExperienceAsset更新Activity
 * @param id ExperienceAsset ID
 * @param patch 更新データ
 * @returns 更新されたExperienceAsset、またはエラー
 */
export async function updateExperienceAssetActivity(
    id: string,
    patch: ExperienceAssetUpdateInput
): Promise<{ ok: true; value: ExperienceAsset | null } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await updateExperienceAsset(db)(id, patch);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * ExperienceAsset削除Activity
 * @param id ExperienceAsset ID
 * @returns 削除成功フラグ、またはエラー
 */
export async function deleteExperienceAssetActivity(
    id: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await removeExperienceAsset(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Before/After別コンテンツ取得Activity
 * @param experienceId Experience ID
 * @param contentTiming 'before' | 'after' | 'anytime'
 * @returns ExperienceAsset配列、またはエラー
 */
export async function listExperienceAssetsByTimingActivity(
    experienceId: string,
    contentTiming: 'before' | 'after' | 'anytime'
): Promise<{ ok: true; value: ExperienceAsset[] } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listExperienceAssetsByExperience(db)(experienceId, {
        contentTiming,
        isActive: true,
    });

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * アクセス権限別コンテンツ取得Activity
 * @param experienceId Experience ID
 * @param accessLevel 'public' | 'ticket_holder' | 'attended'
 * @returns ExperienceAsset配列、またはエラー
 */
export async function listExperienceAssetsByAccessLevelActivity(
    experienceId: string,
    accessLevel: 'public' | 'ticket_holder' | 'attended'
): Promise<{ ok: true; value: ExperienceAsset[] } | { ok: false; error: ExperienceAssetError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listExperienceAssetsByExperience(db)(experienceId, {
        accessLevel,
        isActive: true,
    });

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}
