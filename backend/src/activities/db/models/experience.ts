/**
 * Experience Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorType enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createExperienceError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and, ilike, gte, lte } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { experiences, selectExperienceSchema, type Experience } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * Experience エラータイプ
 */
export enum ExperienceErrorType {
    NOT_FOUND = 'EXPERIENCE_NOT_FOUND',
    ALREADY_EXISTS = 'EXPERIENCE_ALREADY_EXISTS',
    INVALID_INPUT = 'EXPERIENCE_INVALID_INPUT',
    DATABASE_ERROR = 'EXPERIENCE_DATABASE_ERROR',
    UNAUTHORIZED = 'EXPERIENCE_UNAUTHORIZED',
}

/**
 * Experience エラー情報
 */
export interface ExperienceErrorInfo {
    type: ExperienceErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Experience エラー作成ファクトリ
 * 
 * @param info - エラー情報
 * @returns ApplicationFailure インスタンス
 * 
 * @example
 * ```typescript
 * throw createExperienceError({
 *   type: ExperienceErrorType.NOT_FOUND,
 *   message: `Experience not found: ${id}`,
 *   details: { experienceId: id },
 *   nonRetryable: true,
 * });
 * ```
 */
export const createExperienceError = (info: ExperienceErrorInfo): ApplicationFailure => {
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

export const experienceCreateSchema = z.object({
    brandId: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    location: z.string().optional(),
    capacity: z.string().optional(),
    price: z.string().optional(),
    experienceType: z.enum(['scheduled', 'period', 'flexible']),
    scheduledStartAt: z.date().optional(),
    scheduledEndAt: z.date().optional(),
    periodStartDate: z.date().optional(),
    periodEndDate: z.date().optional(),
    status: z.enum(['draft', 'published', 'ended', 'archived']).default('draft'),
    coverImageUrl: z.string().url().optional(),
    tags: z.string().optional(),
});

export const experienceUpdateSchema = experienceCreateSchema.partial().omit({
    brandId: true,
});

export const experienceIdSchema = z.object({
    id: z.string().uuid()
});

export const experienceQuerySchema = z.object({
    brandId: z.string().uuid().optional(),
    status: z.enum(['draft', 'published', 'ended', 'archived']).optional(),
    experienceType: z.enum(['scheduled', 'period', 'flexible']).optional(),
    search: z.string().optional(),
    startDateFrom: z.date().optional(),
    startDateTo: z.date().optional(),
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>;
export type ExperienceUpdateInput = z.infer<typeof experienceUpdateSchema>;
export type ExperienceIdInput = z.infer<typeof experienceIdSchema>;
export type ExperienceQueryInput = z.infer<typeof experienceQuerySchema>;

// ============================================
// Activity Function Types
// ============================================

export type InsertExperience = (data: ExperienceCreateInput) => Promise<Experience>;
export type FindExperienceById = (id: string) => Promise<Experience | null>;
export type ListExperiences = (params: ExperienceQueryInput) => Promise<Experience[]>;
export type ListExperiencesByBrand = (brandId: string, params?: Partial<ExperienceQueryInput>) => Promise<Experience[]>;
export type UpdateExperience = (id: string, patch: ExperienceUpdateInput) => Promise<Experience>;
export type RemoveExperience = (id: string) => Promise<boolean>;

// ============================================
// Activity Functions
// ============================================

/**
 * Experience を挿入
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_INVALID_INPUT) - 入力バリデーションエラー
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const insertExperience = (db: Database): InsertExperience =>
    async (data: ExperienceCreateInput): Promise<Experience> => {
        try {
            // 入力バリデーション
            const validatedData = experienceCreateSchema.parse(data);

            const result = await db.insert(experiences).values({
                brandId: validatedData.brandId,
                title: validatedData.title,
                description: validatedData.description,
                location: validatedData.location,
                capacity: validatedData.capacity,
                price: validatedData.price,
                experienceType: validatedData.experienceType,
                scheduledStartAt: validatedData.scheduledStartAt,
                scheduledEndAt: validatedData.scheduledEndAt,
                periodStartDate: validatedData.periodStartDate,
                periodEndDate: validatedData.periodEndDate,
                status: validatedData.status ?? 'draft',
                coverImageUrl: validatedData.coverImageUrl,
                tags: validatedData.tags,
            }).returning();

            if (!result[0]) {
                throw createExperienceError({
                    type: ExperienceErrorType.DATABASE_ERROR,
                    message: 'Failed to insert experience: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectExperienceSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            // Zodバリデーションエラー
            if (error instanceof Error && error.name === 'ZodError') {
                throw createExperienceError({
                    type: ExperienceErrorType.INVALID_INPUT,
                    message: 'Invalid input data',
                    details: error,
                    nonRetryable: true,
                });
            }
            throw createExperienceError({
                type: ExperienceErrorType.DATABASE_ERROR,
                message: 'Failed to insert experience',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ID で Experience を検索
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const findExperienceById = (db: Database): FindExperienceById =>
    async (id: string): Promise<Experience | null> => {
        try {
            const result = await db.select()
                .from(experiences)
                .where(eq(experiences.id, id))
                .limit(1);

            if (!result[0]) {
                return null;
            }

            return selectExperienceSchema.parse(result[0]);
        } catch (error) {
            throw createExperienceError({
                type: ExperienceErrorType.DATABASE_ERROR,
                message: 'Failed to find experience by ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Experience リストを取得
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const listExperiences = (db: Database): ListExperiences =>
    async (params: ExperienceQueryInput): Promise<Experience[]> => {
        try {
            const { brandId, status, experienceType, search, startDateFrom, startDateTo, isActive, limit, offset } = params;
            const conditions: any[] = [];

            if (brandId) conditions.push(eq(experiences.brandId, brandId));
            if (status) conditions.push(eq(experiences.status, status));
            if (experienceType) conditions.push(eq(experiences.experienceType, experienceType));
            if (search) conditions.push(ilike(experiences.title, `%${search}%`));
            if (isActive !== undefined) conditions.push(eq(experiences.isActive, isActive));
            if (startDateFrom) conditions.push(gte(experiences.scheduledStartAt, startDateFrom));
            if (startDateTo) conditions.push(lte(experiences.scheduledStartAt, startDateTo));

            const whereClause = conditions.length ? and(...conditions) : undefined;

            const result = await db.select()
                .from(experiences)
                .where(whereClause)
                .limit(limit)
                .offset(offset)
                .orderBy(experiences.createdAt);

            return result.map(r => selectExperienceSchema.parse(r));
        } catch (error) {
            throw createExperienceError({
                type: ExperienceErrorType.DATABASE_ERROR,
                message: 'Failed to list experiences',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Brand 配下の Experience リストを取得
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const listExperiencesByBrand = (db: Database): ListExperiencesByBrand =>
    async (brandId: string, params?: Partial<ExperienceQueryInput>): Promise<Experience[]> => {
        const fullParams: ExperienceQueryInput = {
            brandId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listExperiences(db)(fullParams);
    };

/**
 * Experience を更新
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - 存在しない場合
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const updateExperience = (db: Database): UpdateExperience =>
    async (id: string, patch: ExperienceUpdateInput): Promise<Experience> => {
        try {
            const updateData: Partial<typeof experiences.$inferInsert> & { updatedAt: Date } = {
                updatedAt: new Date()
            };

            if (patch.title !== undefined) updateData.title = patch.title;
            if (patch.description !== undefined) updateData.description = patch.description;
            if (patch.location !== undefined) updateData.location = patch.location;
            if (patch.capacity !== undefined) updateData.capacity = patch.capacity;
            if (patch.price !== undefined) updateData.price = patch.price;
            if (patch.experienceType !== undefined) updateData.experienceType = patch.experienceType;
            if (patch.scheduledStartAt !== undefined) updateData.scheduledStartAt = patch.scheduledStartAt;
            if (patch.scheduledEndAt !== undefined) updateData.scheduledEndAt = patch.scheduledEndAt;
            if (patch.periodStartDate !== undefined) updateData.periodStartDate = patch.periodStartDate;
            if (patch.periodEndDate !== undefined) updateData.periodEndDate = patch.periodEndDate;
            if (patch.status !== undefined) updateData.status = patch.status;
            if (patch.coverImageUrl !== undefined) updateData.coverImageUrl = patch.coverImageUrl;
            if (patch.tags !== undefined) updateData.tags = patch.tags;

            const result = await db.update(experiences)
                .set(updateData)
                .where(eq(experiences.id, id))
                .returning();

            if (!result[0]) {
                throw createExperienceError({
                    type: ExperienceErrorType.NOT_FOUND,
                    message: `Experience not found: ${id}`,
                    details: { experienceId: id },
                    nonRetryable: true,
                });
            }

            return selectExperienceSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createExperienceError({
                type: ExperienceErrorType.DATABASE_ERROR,
                message: 'Failed to update experience',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Experience を削除
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const removeExperience = (db: Database): RemoveExperience =>
    async (id: string): Promise<boolean> => {
        try {
            const result = await db.delete(experiences)
                .where(eq(experiences.id, id))
                .returning();

            return result.length > 0;
        } catch (error) {
            throw createExperienceError({
                type: ExperienceErrorType.DATABASE_ERROR,
                message: 'Failed to delete experience',
                details: error,
                nonRetryable: false,
            });
        }
    };

// ============================================
// Factory Function
// ============================================

/**
 * Experience Activity 関数群のファクトリ
 * Temporal Workflow で使用するために、DB接続を注入してすべてのActivity関数を返す
 * 
 * @param db - Database接続
 * @returns すべてのExperience Activity関数
 */
export function createExperienceActivities(db: Database) {
    return {
        insertExperience: insertExperience(db),
        findExperienceById: findExperienceById(db),
        listExperiences: listExperiences(db),
        listExperiencesByBrand: listExperiencesByBrand(db),
        updateExperience: updateExperience(db),
        removeExperience: removeExperience(db),
    };
}
