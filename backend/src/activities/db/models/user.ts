import { z } from 'zod';
import { ResultAsync } from 'neverthrow';
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

export type InsertUser = (data: UserCreateInput) => ResultAsync<User, UserError>;
export type FindUserById = (id: string) => ResultAsync<User | null, UserError>;
export type ListUsers = (params: UserQueryInput) => ResultAsync<User[], UserError>;
export type UpdateUser = (id: string, patch: UserUpdateInput) => ResultAsync<User | null, UserError>;
export type RemoveUser = (id: string) => ResultAsync<boolean, UserError>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertUser = (db: Database): InsertUser =>
    (data: UserCreateInput) => {
        return ResultAsync.fromPromise(
            db.insert(users).values({
                id: data.id, // Auth0 User ID
            }).returning().then(r => selectUserSchema.parse(r[0])),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findUserById = (db: Database): FindUserById =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.select().from(users).where(eq(users.id, id)).limit(1).then(r => r[0] ? selectUserSchema.parse(r[0]) : null),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const listUsers = (db: Database): ListUsers =>
    (params: UserQueryInput) => {
        const { isActive, limit, offset } = params;
        const cond: any[] = [];
        if (isActive !== undefined) cond.push(eq(users.isActive, isActive));
        const whereClause = cond.length ? and(...cond) : undefined;

        return ResultAsync.fromPromise(
            db.select().from(users).where(whereClause).limit(limit).offset(offset).orderBy(users.createdAt).then(rows => rows.map(r => selectUserSchema.parse(r))),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const updateUser = (db: Database): UpdateUser =>
    (id: string, patch: UserUpdateInput) => {
        const updateData: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };
        if (patch.isActive !== undefined) updateData.isActive = patch.isActive;

        return ResultAsync.fromPromise(
            db.update(users).set(updateData).where(eq(users.id, id)).returning().then(r => r[0] ? selectUserSchema.parse(r[0]) : null),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeUser = (db: Database): RemoveUser =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.delete(users).where(eq(users.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: UserErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

// ============================================
// Activity Functions (Temporal用)
// ============================================

/**
 * User作成Activity
 * @param data 作成データ
 * @returns 作成されたUser、またはエラー
 */
export async function createUserActivity(
    data: UserCreateInput
): Promise<{ ok: true; value: User } | { ok: false; error: UserError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await insertUser(db)(data);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * User取得Activity (ID指定)
 * @param id User ID (Auth0 User ID)
 * @returns 取得されたUser、またはエラー
 */
export async function getUserByIdActivity(
    id: string
): Promise<{ ok: true; value: User | null } | { ok: false; error: UserError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await findUserById(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * User一覧取得Activity
 * @param params クエリパラメータ
 * @returns User配列、またはエラー
 */
export async function listUsersActivity(
    params: UserQueryInput
): Promise<{ ok: true; value: User[] } | { ok: false; error: UserError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listUsers(db)(params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * User更新Activity
 * @param id User ID
 * @param patch 更新データ
 * @returns 更新されたUser、またはエラー
 */
export async function updateUserActivity(
    id: string,
    patch: UserUpdateInput
): Promise<{ ok: true; value: User | null } | { ok: false; error: UserError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await updateUser(db)(id, patch);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * User削除Activity
 * @param id User ID
 * @returns 削除成功フラグ、またはエラー
 */
export async function deleteUserActivity(
    id: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: UserError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await removeUser(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}
