import { z } from 'zod';
import { ResultAsync } from 'neverthrow';
import { Database } from '../connection';
import { organizations, selectOrganizationSchema } from '../schema';
import type { Organization } from '../schema';
import { eq, ilike, and } from 'drizzle-orm';

// 組織関連の入力スキーマ
export const organizationCreateSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    email: z.string().email(),
    phone: z.string().min(1).optional(),
    website: z.string().url().optional(),
    address: z.string().optional(),
});

export const organizationUpdateSchema = organizationCreateSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export const organizationIdSchema = z.object({ id: z.string().uuid() });

export const organizationQuerySchema = z.object({
    isActive: z.boolean().optional(),
    search: z.string().optional(),
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
export type FindOrganizationByEmail = (email: string) => ResultAsync<Organization | null, OrganizationError>;
export type ListOrganizations = (params: OrganizationQueryInput) => ResultAsync<Organization[], OrganizationError>;
export type UpdateOrganization = (id: string, patch: OrganizationUpdateInput) => ResultAsync<Organization | null, OrganizationError>;
export type RemoveOrganization = (id: string) => ResultAsync<boolean, OrganizationError>;


export const insertOrganization = (db: Database): InsertOrganization =>
    (data: OrganizationCreateInput) => {
        return ResultAsync.fromPromise(
            db.insert(organizations).values({
                name: data.name,
                description: data.description ?? null,
                email: data.email,
                phone: data.phone ?? null,
                website: data.website ?? null,
                address: data.address ?? null,
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

export const findOrganizationByEmail = (db: Database): FindOrganizationByEmail =>
    (email: string) => {
        return ResultAsync.fromPromise(
            db.select().from(organizations).where(eq(organizations.email, email)).limit(1).then(r => r[0] ? selectOrganizationSchema.parse(r[0]) : null),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Find by email failed', details: error })
        );
    };

export const listOrganizations = (db: Database): ListOrganizations =>
    (params: OrganizationQueryInput) => {
        const { isActive, search, limit, offset } = params;
        const cond: any[] = [];
        if (isActive !== undefined) cond.push(eq(organizations.isActive, isActive));
        if (search) cond.push(ilike(organizations.name, `%${search}%`));
        const whereClause = cond.length ? and(...cond) : undefined;

        return ResultAsync.fromPromise(
            db.select().from(organizations).where(whereClause).limit(limit).offset(offset).orderBy(organizations.createdAt).then(rows => rows.map(r => selectOrganizationSchema.parse(r))),
            (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const updateOrganization = (db: Database): UpdateOrganization =>
    (id: string, patch: OrganizationUpdateInput) => {
        const updateData: any = {};
        if (patch.name !== undefined) updateData.name = patch.name;
        if (patch.description !== undefined) updateData.description = patch.description ?? null;
        if (patch.email !== undefined) updateData.email = patch.email;
        if (patch.phone !== undefined) updateData.phone = patch.phone ?? null;
        if (patch.website !== undefined) updateData.website = patch.website ?? null;
        if (patch.address !== undefined) updateData.address = patch.address ?? null;
        if (patch.isActive !== undefined) updateData.isActive = patch.isActive;
        updateData.updatedAt = new Date();

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
