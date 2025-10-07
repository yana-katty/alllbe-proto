/**
 * ExperienceAsset Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorType enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createExperienceAssetError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { experienceAssets, selectExperienceAssetSchema, type ExperienceAsset } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * ExperienceAsset エラータイプ
 */
export enum ExperienceAssetErrorType {
    NOT_FOUND = 'EXPERIENCE_ASSET_NOT_FOUND',
    ALREADY_EXISTS = 'EXPERIENCE_ASSET_ALREADY_EXISTS',
    INVALID_INPUT = 'EXPERIENCE_ASSET_INVALID_INPUT',
    DATABASE_ERROR = 'EXPERIENCE_ASSET_DATABASE_ERROR',
    UNAUTHORIZED = 'EXPERIENCE_ASSET_UNAUTHORIZED',
}

/**
 * ExperienceAsset エラー情報
 */
export interface ExperienceAssetErrorInfo {
    type: ExperienceAssetErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * ExperienceAsset エラー作成ファクトリ
 */
export const createExperienceAssetError = (info: ExperienceAssetErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};

// ============================================
// Input/Output Types
// ============================================

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
    displayOrder: z.number().int().default(0),
    fileSize: z.string().optional(),
    duration: z.string().optional(),
});

export const experienceAssetUpdateSchema = experienceAssetCreateSchema.partial().omit({
    experienceId: true,
});

export const experienceAssetIdSchema = z.object({
    id: z.string().uuid()
});

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

// ============================================
// Activity Function Types
// ============================================

export type InsertExperienceAsset = (data: ExperienceAssetCreateInput) => Promise<ExperienceAsset>;
export type FindExperienceAssetById = (id: string) => Promise<ExperienceAsset | null>;
export type ListExperienceAssets = (params: ExperienceAssetQueryInput) => Promise<ExperienceAsset[]>;
export type ListExperienceAssetsByExperience = (experienceId: string, params?: Partial<ExperienceAssetQueryInput>) => Promise<ExperienceAsset[]>;
export type UpdateExperienceAsset = (id: string, patch: ExperienceAssetUpdateInput) => Promise<ExperienceAsset>;
export type RemoveExperienceAsset = (id: string) => Promise<boolean>;

// ============================================
// Activity Functions
// ============================================

/**
 * ExperienceAsset を挿入
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_INVALID_INPUT) - 入力バリデーションエラー
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const insertExperienceAsset = (db: Database): InsertExperienceAsset =>
    async (data: ExperienceAssetCreateInput): Promise<ExperienceAsset> => {
        try {
            // 入力バリデーション
            const validatedData = experienceAssetCreateSchema.parse(data);

            const result = await db.insert(experienceAssets).values({
                experienceId: validatedData.experienceId,
                title: validatedData.title,
                description: validatedData.description,
                assetType: validatedData.assetType,
                assetUrl: validatedData.assetUrl,
                thumbnailUrl: validatedData.thumbnailUrl,
                contentTiming: validatedData.contentTiming,
                category: validatedData.category,
                categoryLabel: validatedData.categoryLabel,
                accessLevel: validatedData.accessLevel ?? 'public',
                displayOrder: validatedData.displayOrder ?? 0,
                fileSize: validatedData.fileSize,
                duration: validatedData.duration,
            }).returning();

            if (!result[0]) {
                throw createExperienceAssetError({
                    type: ExperienceAssetErrorType.DATABASE_ERROR,
                    message: 'Failed to insert experience asset: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectExperienceAssetSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            // Zodバリデーションエラー
            if (error instanceof Error && error.name === 'ZodError') {
                throw createExperienceAssetError({
                    type: ExperienceAssetErrorType.INVALID_INPUT,
                    message: 'Invalid input data',
                    details: error,
                    nonRetryable: true,
                });
            }
            throw createExperienceAssetError({
                type: ExperienceAssetErrorType.DATABASE_ERROR,
                message: 'Failed to insert experience asset',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ID で ExperienceAsset を検索
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const findExperienceAssetById = (db: Database): FindExperienceAssetById =>
    async (id: string): Promise<ExperienceAsset | null> => {
        try {
            const result = await db.select()
                .from(experienceAssets)
                .where(eq(experienceAssets.id, id))
                .limit(1);

            if (!result[0]) {
                return null;
            }

            return selectExperienceAssetSchema.parse(result[0]);
        } catch (error) {
            throw createExperienceAssetError({
                type: ExperienceAssetErrorType.DATABASE_ERROR,
                message: 'Failed to find experience asset by ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ExperienceAsset リストを取得
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const listExperienceAssets = (db: Database): ListExperienceAssets =>
    async (params: ExperienceAssetQueryInput): Promise<ExperienceAsset[]> => {
        try {
            const { experienceId, contentTiming, category, accessLevel, assetType, isActive, limit, offset } = params;
            const conditions: any[] = [];

            if (experienceId) conditions.push(eq(experienceAssets.experienceId, experienceId));
            if (contentTiming) conditions.push(eq(experienceAssets.contentTiming, contentTiming));
            if (category) conditions.push(eq(experienceAssets.category, category));
            if (accessLevel) conditions.push(eq(experienceAssets.accessLevel, accessLevel));
            if (assetType) conditions.push(eq(experienceAssets.assetType, assetType));
            if (isActive !== undefined) conditions.push(eq(experienceAssets.isActive, isActive));

            const whereClause = conditions.length ? and(...conditions) : undefined;

            const result = await db.select()
                .from(experienceAssets)
                .where(whereClause)
                .limit(limit)
                .offset(offset)
                .orderBy(experienceAssets.displayOrder, experienceAssets.createdAt);

            return result.map(r => selectExperienceAssetSchema.parse(r));
        } catch (error) {
            throw createExperienceAssetError({
                type: ExperienceAssetErrorType.DATABASE_ERROR,
                message: 'Failed to list experience assets',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Experience 配下の ExperienceAsset リストを取得
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const listExperienceAssetsByExperience = (db: Database): ListExperienceAssetsByExperience =>
    async (experienceId: string, params?: Partial<ExperienceAssetQueryInput>): Promise<ExperienceAsset[]> => {
        const fullParams: ExperienceAssetQueryInput = {
            experienceId,
            limit: params?.limit ?? 50,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listExperienceAssets(db)(fullParams);
    };

/**
 * ExperienceAsset を更新
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_NOT_FOUND) - 存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const updateExperienceAsset = (db: Database): UpdateExperienceAsset =>
    async (id: string, patch: ExperienceAssetUpdateInput): Promise<ExperienceAsset> => {
        try {
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

            const result = await db.update(experienceAssets)
                .set(updateData)
                .where(eq(experienceAssets.id, id))
                .returning();

            if (!result[0]) {
                throw createExperienceAssetError({
                    type: ExperienceAssetErrorType.NOT_FOUND,
                    message: `Experience asset not found: ${id}`,
                    details: { assetId: id },
                    nonRetryable: true,
                });
            }

            return selectExperienceAssetSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createExperienceAssetError({
                type: ExperienceAssetErrorType.DATABASE_ERROR,
                message: 'Failed to update experience asset',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ExperienceAsset を削除
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const removeExperienceAsset = (db: Database): RemoveExperienceAsset =>
    async (id: string): Promise<boolean> => {
        try {
            const result = await db.delete(experienceAssets)
                .where(eq(experienceAssets.id, id))
                .returning();

            return result.length > 0;
        } catch (error) {
            throw createExperienceAssetError({
                type: ExperienceAssetErrorType.DATABASE_ERROR,
                message: 'Failed to delete experience asset',
                details: error,
                nonRetryable: false,
            });
        }
    };

// ============================================
// Factory Function
// ============================================

/**
 * ExperienceAsset Activity 関数群のファクトリ
 */
export function createExperienceAssetActivities(db: Database) {
    return {
        insertExperienceAsset: insertExperienceAsset(db),
        findExperienceAssetById: findExperienceAssetById(db),
        listExperienceAssets: listExperienceAssets(db),
        listExperienceAssetsByExperience: listExperienceAssetsByExperience(db),
        updateExperienceAsset: updateExperienceAsset(db),
        removeExperienceAsset: removeExperienceAsset(db),
    };
}
