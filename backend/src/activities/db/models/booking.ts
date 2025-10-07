import { z } from 'zod';
import { Result, ResultAsync, ok, err } from 'neverthrow';
import { Database } from '../connection';
import { bookings, selectBookingSchema } from '../schema';
import type { Booking } from '../schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Re-export Booking 型
export type { Booking } from '../schema';

// Booking関連の入力スキーマ
export const bookingCreateSchema = z.object({
    experienceId: z.string().uuid(),
    userId: z.string().uuid(),
    numberOfParticipants: z.string().min(1),
    scheduledVisitTime: z.date().optional(),
    status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).default('confirmed'),
    qrCode: z.string().optional(),
});

export const bookingUpdateSchema = z.object({
    scheduledVisitTime: z.date().optional(),
    status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).optional(),
    qrCode: z.string().optional(),
    attendedAt: z.date().optional(),
    cancelledAt: z.date().optional(),
    cancellationReason: z.string().optional(),
});

export const bookingIdSchema = z.object({ id: z.string().uuid() });

export const bookingQuerySchema = z.object({
    experienceId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).optional(),
    visitTimeFrom: z.date().optional(), // 訪問予定時刻の範囲検索
    visitTimeTo: z.date().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type BookingIdInput = z.infer<typeof bookingIdSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;

// エラー定義
export enum BookingErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    INVALID = 'INVALID',
    DATABASE = 'DATABASE',
    CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
    UNAUTHORIZED = 'UNAUTHORIZED',
    INVALID_QR_CODE = 'INVALID_QR_CODE',
    ALREADY_ATTENDED = 'ALREADY_ATTENDED',
    BOOKING_CANCELLED = 'BOOKING_CANCELLED',
    PAYMENT_INCOMPLETE = 'PAYMENT_INCOMPLETE',
    BOOKING_DEADLINE_PASSED = 'BOOKING_DEADLINE_PASSED',
}

export interface BookingError {
    code: BookingErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T> { data: T; message: string }

export type InsertBooking = (data: BookingCreateInput) => Promise<Result<Booking, BookingError>>;
export type FindBookingById = (id: string) => Promise<Result<Booking | null, BookingError>>;
export type FindBookingByQrCode = (qrCode: string) => Promise<Result<Booking | null, BookingError>>;
export type ListBookings = (params: BookingQueryInput) => Promise<Result<Booking[], BookingError>>;
export type ListBookingsByUser = (userId: string, params?: Partial<BookingQueryInput>) => Promise<Result<Booking[], BookingError>>;
export type ListBookingsByExperience = (experienceId: string, params?: Partial<BookingQueryInput>) => Promise<Result<Booking[], BookingError>>;
export type UpdateBooking = (id: string, patch: BookingUpdateInput) => Promise<Result<Booking | null, BookingError>>;
export type RemoveBooking = (id: string) => Promise<Result<boolean, BookingError>>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertBooking = (db: Database): InsertBooking =>
    async (data: BookingCreateInput) => {
        return await ResultAsync.fromPromise(
            db.insert(bookings).values({
                experienceId: data.experienceId,
                userId: data.userId,
                numberOfParticipants: data.numberOfParticipants,
                scheduledVisitTime: data.scheduledVisitTime,
                status: data.status ?? 'confirmed',
                qrCode: data.qrCode,
            }).returning().then(r => selectBookingSchema.parse(r[0])),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findBookingById = (db: Database): FindBookingById =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(bookings).where(eq(bookings.id, id)).limit(1).then(r => r[0] ? selectBookingSchema.parse(r[0]) : null),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const findBookingByQrCode = (db: Database): FindBookingByQrCode =>
    async (qrCode: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(bookings).where(eq(bookings.qrCode, qrCode)).limit(1).then(r => r[0] ? selectBookingSchema.parse(r[0]) : null),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Find by QR code failed', details: error })
        );
    };

export const listBookings = (db: Database): ListBookings =>
    async (params: BookingQueryInput) => {
        const { experienceId, userId, status, visitTimeFrom, visitTimeTo, limit, offset } = params;
        const cond: any[] = [];

        if (experienceId) cond.push(eq(bookings.experienceId, experienceId));
        if (userId) cond.push(eq(bookings.userId, userId));
        if (status) cond.push(eq(bookings.status, status));

        // 訪問予定時刻の範囲検索
        if (visitTimeFrom) cond.push(gte(bookings.scheduledVisitTime, visitTimeFrom));
        if (visitTimeTo) cond.push(lte(bookings.scheduledVisitTime, visitTimeTo));

        const whereClause = cond.length ? and(...cond) : undefined;

        return await ResultAsync.fromPromise(
            db.select().from(bookings).where(whereClause).limit(limit).offset(offset).orderBy(bookings.createdAt).then(rows => rows.map(r => selectBookingSchema.parse(r))),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const listBookingsByUser = (db: Database): ListBookingsByUser =>
    async (userId: string, params?: Partial<BookingQueryInput>) => {
        const fullParams: BookingQueryInput = {
            userId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listBookings(db)(fullParams);
    };

export const listBookingsByExperience = (db: Database): ListBookingsByExperience =>
    async (experienceId: string, params?: Partial<BookingQueryInput>) => {
        const fullParams: BookingQueryInput = {
            experienceId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listBookings(db)(fullParams);
    };

export const updateBooking = (db: Database): UpdateBooking =>
    async (id: string, patch: BookingUpdateInput) => {
        const updateData: Partial<typeof bookings.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };

        // Booking 固有のフィールドのみ更新（決済関連はPaymentテーブルで管理）
        if (patch.scheduledVisitTime !== undefined) updateData.scheduledVisitTime = patch.scheduledVisitTime;
        if (patch.status !== undefined) updateData.status = patch.status;
        if (patch.qrCode !== undefined) updateData.qrCode = patch.qrCode;
        if (patch.attendedAt !== undefined) updateData.attendedAt = patch.attendedAt;
        if (patch.cancelledAt !== undefined) updateData.cancelledAt = patch.cancelledAt;
        if (patch.cancellationReason !== undefined) updateData.cancellationReason = patch.cancellationReason;

        return await ResultAsync.fromPromise(
            db.update(bookings).set(updateData).where(eq(bookings.id, id)).returning().then(r => r[0] ? selectBookingSchema.parse(r[0]) : null),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeBooking = (db: Database): RemoveBooking =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.delete(bookings).where(eq(bookings.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

/**
 * ユーザーの体験履歴取得（attended のみ）
 */
export const listAttendedBookingsByUser = (db: Database) =>
    async (userId: string): Promise<Result<Booking[], BookingError>> => {
        return await listBookingsByUser(db)(userId, {
            status: 'attended',
        });
    };

/**
 * ユーザーが特定の Experience を体験済みかチェック
 */
export const hasUserAttendedExperience = (db: Database) =>
    async (userId: string, experienceId: string): Promise<Result<boolean, BookingError>> => {
        const result = await listBookings(db)({
            userId,
            experienceId,
            status: 'attended',
            limit: 1,
            offset: 0,
        });

        if (result.isErr()) {
            return err(result.error);
        }

        return ok(result.value.length > 0);
    };
