import { z } from 'zod';
import { ResultAsync } from 'neverthrow';
import { Database } from '../connection';
import { organizations, selectOrganizationSchema } from '../schema';
import type { Organization } from '../schema';
import { eq, ilike, and } from 'drizzle-orm';

// 組織関連の入力スキーマ
export const organizationCreateSchema = z.object({
    id: z.string().min(1), // WorkOS Organization ID
});

export const organizationUpdateSchema = z.object({
    isActive: z.boolean().optional(),
});

export const organizationIdSchema = z.object({ id: z.string().min(1) }); // WorkOS Organization ID

export const organizationQuerySchema = z.object({
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
export type OrganizationIdInput = z.infer<typeof organizationIdSchema>;
export type OrganizationQueryInput = z.infer<typeof organizationQuerySchema>;

// エラー定義
export enum OrganizationErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    INVALID = 'INVALID',
    DATABASE = 'DATABASE',
}

export interface OrganizationError {
    code: OrganizationErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T> { data: T; message: string }

export type InsertOrganization = (data: OrganizationCreateInput) => ResultAsync<Organization, OrganizationError>;
export type FindOrganizationById = (id: string) => ResultAsync<Organization | null, OrganizationError>;
export type ListOrganizations = (params: OrganizationQueryInput) => ResultAsync<Organization[], OrganizationError>;
export type UpdateOrganization = (id: string, patch: OrganizationUpdateInput) => ResultAsync<Organization | null, OrganizationError>;
export type RemoveOrganization = (id: string) => ResultAsync<boolean, OrganizationError>;


export const insertOrganization = (db: Database): InsertOrganization =>
    (data: OrganizationCreateInput) => {
        return ResultAsync.fromPromise(
            db.insert(organizations).values({
                id: data.id, // WorkOS Organization ID
            }).returning().then(r => selectOrganizationSchema.parse(r[0])),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findOrganizationById = (db: Database): FindOrganizationById =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.select().from(organizations).where(eq(organizations.id, id)).limit(1).then(r => r[0] ? selectOrganizationSchema.parse(r[0]) : null),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const listOrganizations = (db: Database): ListOrganizations =>
    (params: OrganizationQueryInput) => {
        const { isActive, limit, offset } = params;
        const cond: any[] = [];
        if (isActive !== undefined) cond.push(eq(organizations.isActive, isActive));
        const whereClause = cond.length ? and(...cond) : undefined;

        return ResultAsync.fromPromise(
            db.select().from(organizations).where(whereClause).limit(limit).offset(offset).orderBy(organizations.createdAt).then(rows => rows.map(r => selectOrganizationSchema.parse(r))),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const updateOrganization = (db: Database): UpdateOrganization =>
    (id: string, patch: OrganizationUpdateInput) => {
        const updateData: Partial<typeof organizations.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };
        if (patch.isActive !== undefined) updateData.isActive = patch.isActive;

        return ResultAsync.fromPromise(
            db.update(organizations).set(updateData).where(eq(organizations.id, id)).returning().then(r => r[0] ? selectOrganizationSchema.parse(r[0]) : null),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeOrganization = (db: Database): RemoveOrganization =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.delete(organizations).where(eq(organizations.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

// ============================================
// Activity Functions (Temporal用)
// ============================================

/**
 * Organization作成Activity
 * @param data 作成データ
 * @returns 作成されたOrganization、またはエラー
 */
export async function createOrganizationActivity(
    data: OrganizationCreateInput
): Promise<{ ok: true; value: Organization } | { ok: false; error: OrganizationError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await insertOrganization(db)(data);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Organization取得Activity (ID指定)
 * @param id Organization ID (WorkOS Organization ID)
 * @returns 取得されたOrganization、またはエラー
 */
export async function getOrganizationByIdActivity(
    id: string
): Promise<{ ok: true; value: Organization | null } | { ok: false; error: OrganizationError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await findOrganizationById(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Organization一覧取得Activity
 * @param params クエリパラメータ
 * @returns Organization配列、またはエラー
 */
export async function listOrganizationsActivity(
    params: OrganizationQueryInput
): Promise<{ ok: true; value: Organization[] } | { ok: false; error: OrganizationError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listOrganizations(db)(params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Organization更新Activity
 * @param id Organization ID
 * @param patch 更新データ
 * @returns 更新されたOrganization、またはエラー
 */
export async function updateOrganizationActivity(
    id: string,
    patch: OrganizationUpdateInput
): Promise<{ ok: true; value: Organization | null } | { ok: false; error: OrganizationError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await updateOrganization(db)(id, patch);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Organization削除Activity
 * @param id Organization ID
 * @returns 削除成功フラグ、またはエラー
 */
export async function deleteOrganizationActivity(
    id: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: OrganizationError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await removeOrganization(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}
