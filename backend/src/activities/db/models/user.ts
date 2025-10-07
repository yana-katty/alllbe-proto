import { z } from 'zod';
import { Result, ResultAsync } from 'neverthrow';
import { Database } from '../connection';
import { users, selectUserSchema } from '../schema';
import type { User } from '../schema';
import { eq, ilike, and } from 'drizzle-orm';

// ユーザー関連の入力スキーマ
export const userCreateSchema = z.object({
    id: z.string().min(1), // Auth0 User ID
});

export const userUpdateSchema = z.object({
    isActive: z.boolean().optional(),
});

export const userIdSchema = z.object({ id: z.string().min(1) }); // Auth0 User ID

export const userQuerySchema = z.object({
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;

// エラー定義
export enum UserErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    INVALID = 'INVALID',
    DATABASE = 'DATABASE',
}

export interface UserError {
    code: UserErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T> { data: T; message: string }

export type InsertUser = (data: UserCreateInput) => Promise<Result<User, UserError>>;
export type FindUserById = (id: string) => Promise<Result<User | null, UserError>>;
export type ListUsers = (params: UserQueryInput) => Promise<Result<User[], UserError>>;
export type UpdateUser = (id: string, patch: UserUpdateInput) => Promise<Result<User | null, UserError>>;
export type RemoveUser = (id: string) => Promise<Result<boolean, UserError>>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertUser = (db: Database): InsertUser =>
    async (data: UserCreateInput) => {
        return await ResultAsync.fromPromise(
            db.insert(users).values({
                id: data.id, // Auth0 User ID
            }).returning().then(r => selectUserSchema.parse(r[0])),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findUserById = (db: Database): FindUserById =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(users).where(eq(users.id, id)).limit(1).then(r => r[0] ? selectUserSchema.parse(r[0]) : null),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const listUsers = (db: Database): ListUsers =>
    async (params: UserQueryInput) => {
        const { isActive, limit, offset } = params;
        const cond: any[] = [];
        if (isActive !== undefined) cond.push(eq(users.isActive, isActive));
        const whereClause = cond.length ? and(...cond) : undefined;

        return await ResultAsync.fromPromise(
            db.select().from(users).where(whereClause).limit(limit).offset(offset).orderBy(users.createdAt).then(rows => rows.map(r => selectUserSchema.parse(r))),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const updateUser = (db: Database): UpdateUser =>
    async (id: string, patch: UserUpdateInput) => {
        const updateData: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };
        if (patch.isActive !== undefined) updateData.isActive = patch.isActive;

        return await ResultAsync.fromPromise(
            db.update(users).set(updateData).where(eq(users.id, id)).returning().then(r => r[0] ? selectUserSchema.parse(r[0]) : null),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeUser = (db: Database): RemoveUser =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.delete(users).where(eq(users.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };
