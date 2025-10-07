/**
 * Brand Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorType enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createBrandError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { brands, selectBrandSchema, type Brand } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * Brand エラータイプ
 */
export enum BrandErrorType {
    NOT_FOUND = 'BRAND_NOT_FOUND',
    ALREADY_EXISTS = 'BRAND_ALREADY_EXISTS',
    LIMIT_REACHED = 'BRAND_LIMIT_REACHED',
    HAS_DEPENDENCIES = 'BRAND_HAS_DEPENDENCIES',
    INVALID_INPUT = 'BRAND_INVALID_INPUT',
    DATABASE_ERROR = 'BRAND_DATABASE_ERROR',
}

/**
 * Brand エラー情報
 */
export interface BrandErrorInfo {
    type: BrandErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Brand エラー作成ファクトリ
 * 
 * @param info - エラー情報
 * @returns ApplicationFailure インスタンス
 * 
 * @example
 * ```typescript
 * throw createBrandError({
 *   type: BrandErrorType.LIMIT_REACHED,
 *   message: `Brand limit reached for organization: ${organizationId}`,
 *   details: { organizationId, limit: 100 },
 *   nonRetryable: true,
 * });
 * ```
 */
export const createBrandError = (info: BrandErrorInfo): ApplicationFailure => {
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

export const brandCreateSchema = z.object({
    organizationId: z.string().min(1),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    isDefault: z.boolean().default(false),
});

export const brandUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional().nullable(),
    logoUrl: z.string().url().optional().nullable().or(z.literal('')),
    websiteUrl: z.string().url().optional().nullable().or(z.literal('')),
    isActive: z.boolean().optional(),
});

export const brandIdSchema = z.object({
    id: z.string().uuid()
});

export const brandsByOrganizationSchema = z.object({
    organizationId: z.string().min(1),
    isActive: z.boolean().optional(),
});

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;
export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;
export type BrandIdInput = z.infer<typeof brandIdSchema>;
export type BrandsByOrganizationInput = z.infer<typeof brandsByOrganizationSchema>;

// ============================================
// Activity Function Types
// ============================================

export type InsertBrand = (data: BrandCreateInput) => Promise<Brand>;
export type FindBrandById = (id: string) => Promise<Brand | null>;
export type FindBrandsByOrganizationId = (params: BrandsByOrganizationInput) => Promise<Brand[]>;
export type FindDefaultBrandByOrganizationId = (organizationId: string) => Promise<Brand | null>;
export type UpdateBrand = (id: string, patch: BrandUpdateInput) => Promise<Brand>;
export type DeleteBrand = (id: string) => Promise<boolean>;
export type CountBrandsByOrganizationId = (organizationId: string) => Promise<number>;

// ============================================
// Activity Functions
// ============================================

/**
 * Brand を挿入
 * 
 * @throws ApplicationFailure (type: BRAND_INVALID_INPUT) - 入力データが不正な場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const insertBrand = (db: Database): InsertBrand =>
    async (data: BrandCreateInput): Promise<Brand> => {
        try {
            // 入力データの検証
            const validated = brandCreateSchema.parse(data);

            const result = await db.insert(brands)
                .values({
                    organizationId: validated.organizationId,
                    name: validated.name,
                    description: validated.description,
                    logoUrl: validated.logoUrl || null,
                    websiteUrl: validated.websiteUrl || null,
                    isDefault: validated.isDefault,
                    isActive: true,
                })
                .returning();

            if (!result[0]) {
                throw createBrandError({
                    type: BrandErrorType.DATABASE_ERROR,
                    message: 'Failed to insert brand: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectBrandSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            if (error instanceof z.ZodError) {
                throw createBrandError({
                    type: BrandErrorType.INVALID_INPUT,
                    message: 'Invalid brand input data',
                    details: error.errors,
                    nonRetryable: true,
                });
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: 'Failed to insert brand',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Brand を ID で検索
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const findBrandById = (db: Database): FindBrandById =>
    async (id: string): Promise<Brand | null> => {
        try {
            const result = await db.select()
                .from(brands)
                .where(eq(brands.id, id))
                .limit(1);

            return result[0] ? selectBrandSchema.parse(result[0]) : null;
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: `Failed to find brand by id: ${id}`,
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Organization 配下の Brand 一覧を取得
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const findBrandsByOrganizationId = (db: Database): FindBrandsByOrganizationId =>
    async (params: BrandsByOrganizationInput): Promise<Brand[]> => {
        try {
            const conditions = [eq(brands.organizationId, params.organizationId)];

            if (params.isActive !== undefined) {
                conditions.push(eq(brands.isActive, params.isActive));
            }

            const result = await db.select()
                .from(brands)
                .where(and(...conditions));

            return result.map(row => selectBrandSchema.parse(row));
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: `Failed to find brands by organization: ${params.organizationId}`,
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Organization 配下のデフォルト Brand を取得
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const findDefaultBrandByOrganizationId = (db: Database): FindDefaultBrandByOrganizationId =>
    async (organizationId: string): Promise<Brand | null> => {
        try {
            const result = await db.select()
                .from(brands)
                .where(
                    and(
                        eq(brands.organizationId, organizationId),
                        eq(brands.isDefault, true)
                    )
                )
                .limit(1);

            return result[0] ? selectBrandSchema.parse(result[0]) : null;
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: `Failed to find default brand for organization: ${organizationId}`,
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Brand を更新
 * 
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が見つからない場合
 * @throws ApplicationFailure (type: BRAND_INVALID_INPUT) - 入力データが不正な場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const updateBrand = (db: Database): UpdateBrand =>
    async (id: string, patch: BrandUpdateInput): Promise<Brand> => {
        try {
            // 入力データの検証
            const validated = brandUpdateSchema.parse(patch);

            // 既存チェック
            const existing = await db.select()
                .from(brands)
                .where(eq(brands.id, id))
                .limit(1);

            if (existing.length === 0) {
                throw createBrandError({
                    type: BrandErrorType.NOT_FOUND,
                    message: `Brand not found: ${id}`,
                    details: { brandId: id },
                    nonRetryable: true,
                });
            }

            const result = await db.update(brands)
                .set({
                    ...validated,
                    updatedAt: new Date(),
                })
                .where(eq(brands.id, id))
                .returning();

            if (!result[0]) {
                throw createBrandError({
                    type: BrandErrorType.DATABASE_ERROR,
                    message: 'Failed to update brand: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectBrandSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            if (error instanceof z.ZodError) {
                throw createBrandError({
                    type: BrandErrorType.INVALID_INPUT,
                    message: 'Invalid brand update data',
                    details: error.errors,
                    nonRetryable: true,
                });
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: `Failed to update brand: ${id}`,
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Brand を削除
 * 
 * @throws ApplicationFailure (type: BRAND_NOT_FOUND) - Brand が見つからない場合
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const deleteBrand = (db: Database): DeleteBrand =>
    async (id: string): Promise<boolean> => {
        try {
            // 既存チェック
            const existing = await db.select()
                .from(brands)
                .where(eq(brands.id, id))
                .limit(1);

            if (existing.length === 0) {
                throw createBrandError({
                    type: BrandErrorType.NOT_FOUND,
                    message: `Brand not found: ${id}`,
                    details: { brandId: id },
                    nonRetryable: true,
                });
            }

            const result = await db.delete(brands)
                .where(eq(brands.id, id))
                .returning();

            return result.length > 0;
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: `Failed to delete brand: ${id}`,
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Organization 配下の Brand 数をカウント
 * 
 * @throws ApplicationFailure (type: BRAND_DATABASE_ERROR) - DB操作エラー
 */
export const countBrandsByOrganizationId = (db: Database): CountBrandsByOrganizationId =>
    async (organizationId: string): Promise<number> => {
        try {
            const result = await db.select()
                .from(brands)
                .where(eq(brands.organizationId, organizationId));

            return result.length;
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBrandError({
                type: BrandErrorType.DATABASE_ERROR,
                message: `Failed to count brands for organization: ${organizationId}`,
                details: error,
                nonRetryable: false,
            });
        }
    };
