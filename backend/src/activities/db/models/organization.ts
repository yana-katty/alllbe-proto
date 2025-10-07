import { z } from 'zod';
import { Result, ResultAsync } from 'neverthrow';
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

export type InsertOrganization = (data: OrganizationCreateInput) => Promise<Result<Organization, OrganizationError>>;
export type FindOrganizationById = (id: string) => Promise<Result<Organization | null, OrganizationError>>;
export type ListOrganizations = (params: OrganizationQueryInput) => Promise<Result<Organization[], OrganizationError>>;
export type UpdateOrganization = (id: string, patch: OrganizationUpdateInput) => Promise<Result<Organization | null, OrganizationError>>;
export type RemoveOrganization = (id: string) => Promise<Result<boolean, OrganizationError>>;


export const insertOrganization = (db: Database): InsertOrganization =>
    async (data: OrganizationCreateInput) => {
        return await ResultAsync.fromPromise(
            db.insert(organizations).values({
                id: data.id, // WorkOS Organization ID
            }).returning().then(r => selectOrganizationSchema.parse(r[0])),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findOrganizationById = (db: Database): FindOrganizationById =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(organizations).where(eq(organizations.id, id)).limit(1).then(r => r[0] ? selectOrganizationSchema.parse(r[0]) : null),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const listOrganizations = (db: Database): ListOrganizations =>
    async (params: OrganizationQueryInput) => {
        const { isActive, limit, offset } = params;
        const cond: any[] = [];
        if (isActive !== undefined) cond.push(eq(organizations.isActive, isActive));
        const whereClause = cond.length ? and(...cond) : undefined;

        return await ResultAsync.fromPromise(
            db.select().from(organizations).where(whereClause).limit(limit).offset(offset).orderBy(organizations.createdAt).then(rows => rows.map(r => selectOrganizationSchema.parse(r))),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const updateOrganization = (db: Database): UpdateOrganization =>
    async (id: string, patch: OrganizationUpdateInput) => {
        const updateData: Partial<typeof organizations.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };
        if (patch.isActive !== undefined) updateData.isActive = patch.isActive;

        return await ResultAsync.fromPromise(
            db.update(organizations).set(updateData).where(eq(organizations.id, id)).returning().then(r => r[0] ? selectOrganizationSchema.parse(r[0]) : null),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeOrganization = (db: Database): RemoveOrganization =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.delete(organizations).where(eq(organizations.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

/**
 * Organization Activities ファクトリ関数
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
