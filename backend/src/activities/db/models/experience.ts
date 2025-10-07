import { z } from 'zod';
import { Result, ResultAsync } from 'neverthrow';
import { Database } from '../connection';
import { experiences, selectExperienceSchema } from '../schema';
import type { Experience } from '../schema';
import { eq, and, ilike, gte, lte, inArray } from 'drizzle-orm';

// Experience関連の入力スキーマ
export const experienceCreateSchema = z.object({
    organizationId: z.string().uuid(),
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
    tags: z.string().optional(), // JSON文字列
});

export const experienceUpdateSchema = experienceCreateSchema.partial().omit({
    organizationId: true,
});

export const experienceIdSchema = z.object({ id: z.string().uuid() });

export const experienceQuerySchema = z.object({
    organizationId: z.string().uuid().optional(),
    status: z.enum(['draft', 'published', 'ended', 'archived']).optional(),
    experienceType: z.enum(['scheduled', 'period', 'flexible']).optional(),
    search: z.string().optional(), // title で検索
    startDateFrom: z.date().optional(), // 開始日時の範囲検索
    startDateTo: z.date().optional(),
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>;
export type ExperienceUpdateInput = z.infer<typeof experienceUpdateSchema>;
export type ExperienceIdInput = z.infer<typeof experienceIdSchema>;
export type ExperienceQueryInput = z.infer<typeof experienceQuerySchema>;

// エラー定義
export enum ExperienceErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    INVALID = 'INVALID',
    DATABASE = 'DATABASE',
    UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface ExperienceError {
    code: ExperienceErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T> { data: T; message: string }

export type InsertExperience = (data: ExperienceCreateInput) => Promise<Result<Experience, ExperienceError>>;
export type FindExperienceById = (id: string) => Promise<Result<Experience | null, ExperienceError>>;
export type ListExperiences = (params: ExperienceQueryInput) => Promise<Result<Experience[], ExperienceError>>;
export type ListExperiencesByOrganization = (organizationId: string, params?: Partial<ExperienceQueryInput>) => Promise<Result<Experience[], ExperienceError>>;
export type UpdateExperience = (id: string, patch: ExperienceUpdateInput) => Promise<Result<Experience | null, ExperienceError>>;
export type RemoveExperience = (id: string) => Promise<Result<boolean, ExperienceError>>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertExperience = (db: Database): InsertExperience =>
    async (data: ExperienceCreateInput) => {
        return await ResultAsync.fromPromise(
            db.insert(experiences).values({
                organizationId: data.organizationId,
                title: data.title,
                description: data.description,
                location: data.location,
                capacity: data.capacity,
                price: data.price,
                experienceType: data.experienceType,
                scheduledStartAt: data.scheduledStartAt,
                scheduledEndAt: data.scheduledEndAt,
                periodStartDate: data.periodStartDate,
                periodEndDate: data.periodEndDate,
                status: data.status ?? 'draft',
                coverImageUrl: data.coverImageUrl,
                tags: data.tags,
            }).returning().then(r => selectExperienceSchema.parse(r[0])),
            (error) => ({ code: ExperienceErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findExperienceById = (db: Database): FindExperienceById =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(experiences).where(eq(experiences.id, id)).limit(1).then(r => r[0] ? selectExperienceSchema.parse(r[0]) : null),
            (error) => ({ code: ExperienceErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const listExperiences = (db: Database): ListExperiences =>
    async (params: ExperienceQueryInput) => {
        const { organizationId, status, experienceType, search, startDateFrom, startDateTo, isActive, limit, offset } = params;
        const cond: any[] = [];

        if (organizationId) cond.push(eq(experiences.organizationId, organizationId));
        if (status) cond.push(eq(experiences.status, status));
        if (experienceType) cond.push(eq(experiences.experienceType, experienceType));
        if (search) cond.push(ilike(experiences.title, `%${search}%`));
        if (isActive !== undefined) cond.push(eq(experiences.isActive, isActive));

        // 日時範囲検索（scheduled の場合）
        if (startDateFrom) cond.push(gte(experiences.scheduledStartAt, startDateFrom));
        if (startDateTo) cond.push(lte(experiences.scheduledStartAt, startDateTo));

        const whereClause = cond.length ? and(...cond) : undefined;

        return await ResultAsync.fromPromise(
            db.select().from(experiences).where(whereClause).limit(limit).offset(offset).orderBy(experiences.createdAt).then(rows => rows.map(r => selectExperienceSchema.parse(r))),
            (error) => ({ code: ExperienceErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const listExperiencesByOrganization = (db: Database): ListExperiencesByOrganization =>
    async (organizationId: string, params?: Partial<ExperienceQueryInput>) => {
        const fullParams: ExperienceQueryInput = {
            organizationId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listExperiences(db)(fullParams);
    };

export const updateExperience = (db: Database): UpdateExperience =>
    async (id: string, patch: ExperienceUpdateInput) => {
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

        return await ResultAsync.fromPromise(
            db.update(experiences).set(updateData).where(eq(experiences.id, id)).returning().then(r => r[0] ? selectExperienceSchema.parse(r[0]) : null),
            (error) => ({ code: ExperienceErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeExperience = (db: Database): RemoveExperience =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.delete(experiences).where(eq(experiences.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: ExperienceErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };
