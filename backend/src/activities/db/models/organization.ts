/**
 * Organization Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorCode enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createOrganizationError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { organizations, selectOrganizationSchema, type Organization } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * Organization エラータイプ
 */
export enum OrganizationErrorType {
    NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'ORGANIZATION_ALREADY_EXISTS',
    INVALID_INPUT = 'ORGANIZATION_INVALID_INPUT',
    DATABASE_ERROR = 'ORGANIZATION_DATABASE_ERROR',
    WORKOS_ERROR = 'ORGANIZATION_WORKOS_ERROR',
}

/**
 * Organization エラー情報
 */
export interface OrganizationErrorInfo {
    type: OrganizationErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Organization エラー作成ファクトリ
 * 
 * @param info - エラー情報
 * @returns ApplicationFailure インスタンス
 * 
 * @example
 * ```typescript
 * throw createOrganizationError({
 *   type: OrganizationErrorType.ALREADY_EXISTS,
 *   message: `Organization already exists: ${id}`,
 *   details: { organizationId: id },
 *   nonRetryable: true,
 * });
 * ```
 */
export const createOrganizationError = (info: OrganizationErrorInfo): ApplicationFailure => {
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

export const organizationCreateSchema = z.object({
    id: z.string().min(1), // WorkOS Organization ID
});

export const organizationUpdateSchema = z.object({
    isActive: z.boolean().optional(),
});

export const organizationIdSchema = z.object({
    id: z.string().min(1)
});

export const organizationQuerySchema = z.object({
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
export type OrganizationIdInput = z.infer<typeof organizationIdSchema>;
export type OrganizationQueryInput = z.infer<typeof organizationQuerySchema>;

// ============================================
// Activity Function Types
// ============================================

export type InsertOrganization = (data: OrganizationCreateInput) => Promise<Organization>;
export type FindOrganizationById = (id: string) => Promise<Organization | null>;
export type ListOrganizations = (params: OrganizationQueryInput) => Promise<Organization[]>;
export type UpdateOrganization = (id: string, patch: OrganizationUpdateInput) => Promise<Organization>;
export type RemoveOrganization = (id: string) => Promise<boolean>;

// ============================================
// Activity Functions
// ============================================

/**
 * Organization を挿入
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_ALREADY_EXISTS) - 既に存在する場合
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const insertOrganization = (db: Database): InsertOrganization =>
    async (data: OrganizationCreateInput): Promise<Organization> => {
        try {
            // 既存チェック
            const existing = await db.select()
                .from(organizations)
                .where(eq(organizations.id, data.id))
                .limit(1);

            if (existing.length > 0) {
                throw createOrganizationError({
                    type: OrganizationErrorType.ALREADY_EXISTS,
                    message: `Organization already exists: ${data.id}`,
                    details: { organizationId: data.id },
                    nonRetryable: true,
                });
            }

            const result = await db.insert(organizations)
                .values({ id: data.id })
                .returning();

            if (!result[0]) {
                throw createOrganizationError({
                    type: OrganizationErrorType.DATABASE_ERROR,
                    message: 'Failed to insert organization: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectOrganizationSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to insert organization',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ID で Organization を検索
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const findOrganizationById = (db: Database): FindOrganizationById =>
    async (id: string): Promise<Organization | null> => {
        try {
            const result = await db.select()
                .from(organizations)
                .where(eq(organizations.id, id))
                .limit(1);

            if (!result[0]) {
                return null;
            }

            return selectOrganizationSchema.parse(result[0]);
        } catch (error) {
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to find organization by ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Organization リストを取得
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const listOrganizations = (db: Database): ListOrganizations =>
    async (params: OrganizationQueryInput): Promise<Organization[]> => {
        try {
            const { isActive, limit, offset } = params;
            const conditions: any[] = [];

            if (isActive !== undefined) {
                conditions.push(eq(organizations.isActive, isActive));
            }

            const whereClause = conditions.length ? and(...conditions) : undefined;

            const result = await db.select()
                .from(organizations)
                .where(whereClause)
                .limit(limit)
                .offset(offset)
                .orderBy(organizations.createdAt);

            return result.map(r => selectOrganizationSchema.parse(r));
        } catch (error) {
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to list organizations',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Organization を更新
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_NOT_FOUND) - 存在しない場合
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const updateOrganization = (db: Database): UpdateOrganization =>
    async (id: string, patch: OrganizationUpdateInput): Promise<Organization> => {
        try {
            const updateData: Partial<typeof organizations.$inferInsert> & { updatedAt: Date } = {
                updatedAt: new Date()
            };
            if (patch.isActive !== undefined) {
                updateData.isActive = patch.isActive;
            }

            const result = await db.update(organizations)
                .set(updateData)
                .where(eq(organizations.id, id))
                .returning();

            if (!result[0]) {
                throw createOrganizationError({
                    type: OrganizationErrorType.NOT_FOUND,
                    message: `Organization not found: ${id}`,
                    details: { organizationId: id },
                    nonRetryable: true,
                });
            }

            return selectOrganizationSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to update organization',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Organization を削除
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const removeOrganization = (db: Database): RemoveOrganization =>
    async (id: string): Promise<boolean> => {
        try {
            const result = await db.delete(organizations)
                .where(eq(organizations.id, id))
                .returning();

            return result.length > 0;
        } catch (error) {
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to delete organization',
                details: error,
                nonRetryable: false,
            });
        }
    };

// ============================================
// Factory Function
// ============================================

/**
 * Organization Activity 関数群のファクトリ
 * Temporal Workflow で使用するために、DB接続を注入してすべてのActivity関数を返す
 * 
 * @param db - Database接続
 * @returns すべてのOrganization Activity関数
 */
export function createOrganizationActivities(db: Database) {
    return {
        insertOrganization: insertOrganization(db),
        findOrganizationById: findOrganizationById(db),
        listOrganizations: listOrganizations(db),
        updateOrganization: updateOrganization(db),
        removeOrganization: removeOrganization(db),
    };
}
