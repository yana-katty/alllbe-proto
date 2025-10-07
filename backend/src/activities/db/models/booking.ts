/**
 * Booking Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorType enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createBookingError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and, gte, lte } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { bookings, selectBookingSchema, type Booking } from '../schema';

// Re-export Booking 型
export type { Booking } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * Booking エラータイプ
 */
export enum BookingErrorType {
    NOT_FOUND = 'BOOKING_NOT_FOUND',
    ALREADY_EXISTS = 'BOOKING_ALREADY_EXISTS',
    INVALID_INPUT = 'BOOKING_INVALID_INPUT',
    DATABASE_ERROR = 'BOOKING_DATABASE_ERROR',
    CAPACITY_EXCEEDED = 'BOOKING_CAPACITY_EXCEEDED',
    UNAUTHORIZED = 'BOOKING_UNAUTHORIZED',
    INVALID_QR_CODE = 'BOOKING_INVALID_QR_CODE',
    ALREADY_ATTENDED = 'BOOKING_ALREADY_ATTENDED',
    BOOKING_CANCELLED = 'BOOKING_CANCELLED',
    PAYMENT_INCOMPLETE = 'BOOKING_PAYMENT_INCOMPLETE',
    DEADLINE_PASSED = 'BOOKING_DEADLINE_PASSED',
}

/**
 * Booking エラー情報
 */
export interface BookingErrorInfo {
    type: BookingErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Booking エラー作成ファクトリ
 */
export const createBookingError = (info: BookingErrorInfo): ApplicationFailure => {
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

export const bookingIdSchema = z.object({
    id: z.string().uuid()
});

export const bookingQuerySchema = z.object({
    experienceId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).optional(),
    visitTimeFrom: z.date().optional(),
    visitTimeTo: z.date().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type BookingIdInput = z.infer<typeof bookingIdSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;

// ============================================
// Activity Function Types
// ============================================

export type InsertBooking = (data: BookingCreateInput) => Promise<Booking>;
export type FindBookingById = (id: string) => Promise<Booking | null>;
export type FindBookingByQrCode = (qrCode: string) => Promise<Booking | null>;
export type ListBookings = (params: BookingQueryInput) => Promise<Booking[]>;
export type ListBookingsByUser = (userId: string, params?: Partial<BookingQueryInput>) => Promise<Booking[]>;
export type ListBookingsByExperience = (experienceId: string, params?: Partial<BookingQueryInput>) => Promise<Booking[]>;
export type UpdateBooking = (id: string, patch: BookingUpdateInput) => Promise<Booking>;
export type RemoveBooking = (id: string) => Promise<boolean>;
export type ListAttendedBookingsByUser = (userId: string) => Promise<Booking[]>;
export type HasUserAttendedExperience = (userId: string, experienceId: string) => Promise<boolean>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

/**
 * Booking を作成
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const insertBooking = (db: Database): InsertBooking =>
    async (data: BookingCreateInput): Promise<Booking> => {
        try {
            const result = await db.insert(bookings).values({
                experienceId: data.experienceId,
                userId: data.userId,
                numberOfParticipants: data.numberOfParticipants,
                scheduledVisitTime: data.scheduledVisitTime,
                status: data.status ?? 'confirmed',
                qrCode: data.qrCode,
            }).returning();

            if (!result[0]) {
                throw createBookingError({
                    type: BookingErrorType.DATABASE_ERROR,
                    message: 'Failed to insert booking: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectBookingSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBookingError({
                type: BookingErrorType.DATABASE_ERROR,
                message: 'Failed to insert booking',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * IDでBookingを検索
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const findBookingById = (db: Database): FindBookingById =>
    async (id: string): Promise<Booking | null> => {
        try {
            const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
            if (!result[0]) {
                return null;
            }
            return selectBookingSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBookingError({
                type: BookingErrorType.DATABASE_ERROR,
                message: 'Failed to find booking by ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * QRコードでBookingを検索
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const findBookingByQrCode = (db: Database): FindBookingByQrCode =>
    async (qrCode: string): Promise<Booking | null> => {
        try {
            const result = await db.select().from(bookings).where(eq(bookings.qrCode, qrCode)).limit(1);
            if (!result[0]) {
                return null;
            }
            return selectBookingSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBookingError({
                type: BookingErrorType.DATABASE_ERROR,
                message: 'Failed to find booking by QR code',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Booking一覧を取得（条件検索対応）
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listBookings = (db: Database): ListBookings =>
    async (params: BookingQueryInput): Promise<Booking[]> => {
        try {
            const { experienceId, userId, status, visitTimeFrom, visitTimeTo, limit, offset } = params;
            const cond: Parameters<typeof and>[number][] = [];

            if (experienceId) cond.push(eq(bookings.experienceId, experienceId));
            if (userId) cond.push(eq(bookings.userId, userId));
            if (status) cond.push(eq(bookings.status, status));

            // 訪問予定時刻の範囲検索
            if (visitTimeFrom) cond.push(gte(bookings.scheduledVisitTime, visitTimeFrom));
            if (visitTimeTo) cond.push(lte(bookings.scheduledVisitTime, visitTimeTo));

            const whereClause = cond.length ? and(...cond) : undefined;

            const result = await db
                .select()
                .from(bookings)
                .where(whereClause)
                .limit(limit)
                .offset(offset)
                .orderBy(bookings.createdAt);

            return result.map(r => selectBookingSchema.parse(r));
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBookingError({
                type: BookingErrorType.DATABASE_ERROR,
                message: 'Failed to list bookings',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ユーザーのBooking一覧を取得
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listBookingsByUser = (db: Database): ListBookingsByUser =>
    async (userId: string, params?: Partial<BookingQueryInput>): Promise<Booking[]> => {
        const fullParams: BookingQueryInput = {
            userId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listBookings(db)(fullParams);
    };

/**
 * ExperienceのBooking一覧を取得
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listBookingsByExperience = (db: Database): ListBookingsByExperience =>
    async (experienceId: string, params?: Partial<BookingQueryInput>): Promise<Booking[]> => {
        const fullParams: BookingQueryInput = {
            experienceId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return await listBookings(db)(fullParams);
    };

/**
 * Bookingを更新
 * @throws ApplicationFailure (type: BOOKING_NOT_FOUND) - Booking が見つからない場合
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const updateBooking = (db: Database): UpdateBooking =>
    async (id: string, patch: BookingUpdateInput): Promise<Booking> => {
        try {
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

            const result = await db.update(bookings).set(updateData).where(eq(bookings.id, id)).returning();

            if (!result[0]) {
                throw createBookingError({
                    type: BookingErrorType.NOT_FOUND,
                    message: `Booking not found: ${id}`,
                    details: { bookingId: id },
                    nonRetryable: true,
                });
            }

            return selectBookingSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBookingError({
                type: BookingErrorType.DATABASE_ERROR,
                message: 'Failed to update booking',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Bookingを削除
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const removeBooking = (db: Database): RemoveBooking =>
    async (id: string): Promise<boolean> => {
        try {
            const result = await db.delete(bookings).where(eq(bookings.id, id)).returning();
            return result.length > 0;
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createBookingError({
                type: BookingErrorType.DATABASE_ERROR,
                message: 'Failed to delete booking',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * ユーザーの体験履歴取得（attended のみ）
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listAttendedBookingsByUser = (db: Database): ListAttendedBookingsByUser =>
    async (userId: string): Promise<Booking[]> => {
        return await listBookingsByUser(db)(userId, {
            status: 'attended',
        });
    };

/**
 * ユーザーが特定の Experience を体験済みかチェック
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const hasUserAttendedExperience = (db: Database): HasUserAttendedExperience =>
    async (userId: string, experienceId: string): Promise<boolean> => {
        const result = await listBookings(db)({
            userId,
            experienceId,
            status: 'attended',
            limit: 1,
            offset: 0,
        });

        return result.length > 0;
    };

// ============================================
// Factory Function
// ============================================

/**
 * Booking Activity 依存関数の集約
 */
export interface BookingActivities {
    insertBooking: InsertBooking;
    findBookingById: FindBookingById;
    findBookingByQrCode: FindBookingByQrCode;
    listBookings: ListBookings;
    listBookingsByUser: ListBookingsByUser;
    listBookingsByExperience: ListBookingsByExperience;
    updateBooking: UpdateBooking;
    removeBooking: RemoveBooking;
    listAttendedBookingsByUser: ListAttendedBookingsByUser;
    hasUserAttendedExperience: HasUserAttendedExperience;
}

/**
 * Booking Activities ファクトリ関数
 * 
 * @param db - Database接続
 * @returns すべてのBooking Activity関数
 * 
 * @example
 * ```typescript
 * const db = await createDatabase();
 * const bookingActivities = createBookingActivities(db);
 * 
 * const booking = await bookingActivities.insertBooking({
 *   experienceId: 'exp-1',
 *   userId: 'user-1',
 *   numberOfParticipants: '2',
 * });
 * ```
 */
export const createBookingActivities = (db: Database): BookingActivities => ({
    insertBooking: insertBooking(db),
    findBookingById: findBookingById(db),
    findBookingByQrCode: findBookingByQrCode(db),
    listBookings: listBookings(db),
    listBookingsByUser: listBookingsByUser(db),
    listBookingsByExperience: listBookingsByExperience(db),
    updateBooking: updateBooking(db),
    removeBooking: removeBooking(db),
    listAttendedBookingsByUser: listAttendedBookingsByUser(db),
    hasUserAttendedExperience: hasUserAttendedExperience(db),
});
