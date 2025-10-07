/**
 * User Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorType enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createUserError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { users, selectUserSchema, type User } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * User エラータイプ
 */
export enum UserErrorType {
    NOT_FOUND = 'USER_NOT_FOUND',
    ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
    INVALID_INPUT = 'USER_INVALID_INPUT',
    DATABASE_ERROR = 'USER_DATABASE_ERROR',
    AUTH0_ERROR = 'USER_AUTH0_ERROR',
    UNAUTHORIZED = 'USER_UNAUTHORIZED',
}

/**
 * User エラー情報
 */
export interface UserErrorInfo {
    type: UserErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * User エラー作成ファクトリ
 * 
 * @param info - エラー情報
 * @returns ApplicationFailure インスタンス
 * 
 * @example
 * ```typescript
 * throw createUserError({
 *   type: UserErrorType.ALREADY_EXISTS,
 *   message: `User already exists: ${id}`,
 *   details: { userId: id },
 *   nonRetryable: true,
 * });
 * ```
 */
export const createUserError = (info: UserErrorInfo): ApplicationFailure => {
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

export const userCreateSchema = z.object({
    id: z.string().min(1), // Auth0 User ID
});

export const userUpdateSchema = z.object({
    isActive: z.boolean().optional(),
});

export const userIdSchema = z.object({
    id: z.string().min(1)
});

export const userQuerySchema = z.object({
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;

// ============================================
// Activity Function Types
// ============================================

export type InsertUser = (data: UserCreateInput) => Promise<User>;
export type FindUserById = (id: string) => Promise<User | null>;
export type ListUsers = (params: UserQueryInput) => Promise<User[]>;
export type UpdateUser = (id: string, patch: UserUpdateInput) => Promise<User>;
export type RemoveUser = (id: string) => Promise<boolean>;

// ============================================
// Activity Functions
// ============================================

/**
 * User を挿入
 * 
 * @throws ApplicationFailure (type: USER_ALREADY_EXISTS) - 既に存在する場合
 * @throws ApplicationFailure (type: USER_DATABASE_ERROR) - DB操作エラー
 */
export const insertUser = (db: Database): InsertUser =>
    async (data: UserCreateInput): Promise<User> => {
        try {
            // 既存チェック
            const existing = await db.select()
                .from(users)
                .where(eq(users.id, data.id))
                .limit(1);

            if (existing.length > 0) {
                throw createUserError({
                    type: UserErrorType.ALREADY_EXISTS,
                    message: `User already exists: ${data.id}`,
                    details: { userId: data.id },
                    nonRetryable: true,
                });
            }

            const result = await db.insert(users)
                .values({ id: data.id })
                .returning();

            if (!result[0]) {
                throw createUserError({
                    type: UserErrorType.DATABASE_ERROR,
                    message: 'Failed to insert user: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectUserSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createUserError({
                type: UserErrorType.DATABASE_ERROR,
                message: 'Failed to insert user',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ID で User を検索
 * 
 * @throws ApplicationFailure (type: USER_DATABASE_ERROR) - DB操作エラー
 */
export const findUserById = (db: Database): FindUserById =>
    async (id: string): Promise<User | null> => {
        try {
            const result = await db.select()
                .from(users)
                .where(eq(users.id, id))
                .limit(1);

            if (!result[0]) {
                return null;
            }

            return selectUserSchema.parse(result[0]);
        } catch (error) {
            throw createUserError({
                type: UserErrorType.DATABASE_ERROR,
                message: 'Failed to find user by ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * User リストを取得
 * 
 * @throws ApplicationFailure (type: USER_DATABASE_ERROR) - DB操作エラー
 */
export const listUsers = (db: Database): ListUsers =>
    async (params: UserQueryInput): Promise<User[]> => {
        try {
            const { isActive, limit, offset } = params;
            const conditions: any[] = [];

            if (isActive !== undefined) {
                conditions.push(eq(users.isActive, isActive));
            }

            const whereClause = conditions.length ? and(...conditions) : undefined;

            const result = await db.select()
                .from(users)
                .where(whereClause)
                .limit(limit)
                .offset(offset)
                .orderBy(users.createdAt);

            return result.map(r => selectUserSchema.parse(r));
        } catch (error) {
            throw createUserError({
                type: UserErrorType.DATABASE_ERROR,
                message: 'Failed to list users',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * User を更新
 * 
 * @throws ApplicationFailure (type: USER_NOT_FOUND) - 存在しない場合
 * @throws ApplicationFailure (type: USER_DATABASE_ERROR) - DB操作エラー
 */
export const updateUser = (db: Database): UpdateUser =>
    async (id: string, patch: UserUpdateInput): Promise<User> => {
        try {
            const updateData: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
                updatedAt: new Date()
            };
            if (patch.isActive !== undefined) {
                updateData.isActive = patch.isActive;
            }

            const result = await db.update(users)
                .set(updateData)
                .where(eq(users.id, id))
                .returning();

            if (!result[0]) {
                throw createUserError({
                    type: UserErrorType.NOT_FOUND,
                    message: `User not found: ${id}`,
                    details: { userId: id },
                    nonRetryable: true,
                });
            }

            return selectUserSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createUserError({
                type: UserErrorType.DATABASE_ERROR,
                message: 'Failed to update user',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * User を削除
 * 
 * @throws ApplicationFailure (type: USER_DATABASE_ERROR) - DB操作エラー
 */
export const removeUser = (db: Database): RemoveUser =>
    async (id: string): Promise<boolean> => {
        try {
            const result = await db.delete(users)
                .where(eq(users.id, id))
                .returning();

            return result.length > 0;
        } catch (error) {
            throw createUserError({
                type: UserErrorType.DATABASE_ERROR,
                message: 'Failed to delete user',
                details: error,
                nonRetryable: false,
            });
        }
    };

// ============================================
// Factory Function
// ============================================

/**
 * User Activity 関数群のファクトリ
 * Temporal Workflow で使用するために、DB接続を注入してすべてのActivity関数を返す
 * 
 * @param db - Database接続
 * @returns すべてのUser Activity関数
 */
export function createUserActivities(db: Database) {
    return {
        insertUser: insertUser(db),
        findUserById: findUserById(db),
        listUsers: listUsers(db),
        updateUser: updateUser(db),
        removeUser: removeUser(db),
    };
}
