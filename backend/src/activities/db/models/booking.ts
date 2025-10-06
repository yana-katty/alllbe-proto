import { z } from 'zod';
import { ResultAsync } from 'neverthrow';
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

export type InsertBooking = (data: BookingCreateInput) => ResultAsync<Booking, BookingError>;
export type FindBookingById = (id: string) => ResultAsync<Booking | null, BookingError>;
export type FindBookingByQrCode = (qrCode: string) => ResultAsync<Booking | null, BookingError>;
export type ListBookings = (params: BookingQueryInput) => ResultAsync<Booking[], BookingError>;
export type ListBookingsByUser = (userId: string, params?: Partial<BookingQueryInput>) => ResultAsync<Booking[], BookingError>;
export type ListBookingsByExperience = (experienceId: string, params?: Partial<BookingQueryInput>) => ResultAsync<Booking[], BookingError>;
export type UpdateBooking = (id: string, patch: BookingUpdateInput) => ResultAsync<Booking | null, BookingError>;
export type RemoveBooking = (id: string) => ResultAsync<boolean, BookingError>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertBooking = (db: Database): InsertBooking =>
    (data: BookingCreateInput) => {
        return ResultAsync.fromPromise(
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
    (id: string) => {
        return ResultAsync.fromPromise(
            db.select().from(bookings).where(eq(bookings.id, id)).limit(1).then(r => r[0] ? selectBookingSchema.parse(r[0]) : null),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const findBookingByQrCode = (db: Database): FindBookingByQrCode =>
    (qrCode: string) => {
        return ResultAsync.fromPromise(
            db.select().from(bookings).where(eq(bookings.qrCode, qrCode)).limit(1).then(r => r[0] ? selectBookingSchema.parse(r[0]) : null),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Find by QR code failed', details: error })
        );
    };

export const listBookings = (db: Database): ListBookings =>
    (params: BookingQueryInput) => {
        const { experienceId, userId, status, visitTimeFrom, visitTimeTo, limit, offset } = params;
        const cond: any[] = [];

        if (experienceId) cond.push(eq(bookings.experienceId, experienceId));
        if (userId) cond.push(eq(bookings.userId, userId));
        if (status) cond.push(eq(bookings.status, status));

        // 訪問予定時刻の範囲検索
        if (visitTimeFrom) cond.push(gte(bookings.scheduledVisitTime, visitTimeFrom));
        if (visitTimeTo) cond.push(lte(bookings.scheduledVisitTime, visitTimeTo));

        const whereClause = cond.length ? and(...cond) : undefined;

        return ResultAsync.fromPromise(
            db.select().from(bookings).where(whereClause).limit(limit).offset(offset).orderBy(bookings.createdAt).then(rows => rows.map(r => selectBookingSchema.parse(r))),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const listBookingsByUser = (db: Database): ListBookingsByUser =>
    (userId: string, params?: Partial<BookingQueryInput>) => {
        const fullParams: BookingQueryInput = {
            userId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return listBookings(db)(fullParams);
    };

export const listBookingsByExperience = (db: Database): ListBookingsByExperience =>
    (experienceId: string, params?: Partial<BookingQueryInput>) => {
        const fullParams: BookingQueryInput = {
            experienceId,
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            ...params,
        };
        return listBookings(db)(fullParams);
    };

export const updateBooking = (db: Database): UpdateBooking =>
    (id: string, patch: BookingUpdateInput) => {
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

        return ResultAsync.fromPromise(
            db.update(bookings).set(updateData).where(eq(bookings.id, id)).returning().then(r => r[0] ? selectBookingSchema.parse(r[0]) : null),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removeBooking = (db: Database): RemoveBooking =>
    (id: string) => {
        return ResultAsync.fromPromise(
            db.delete(bookings).where(eq(bookings.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: BookingErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

// ============================================
// Activity Functions (Temporal用)
// ============================================

/**
 * Booking作成Activity
 * @param data 作成データ
 * @returns 作成されたBooking、またはエラー
 */
export async function createBookingActivity(
    data: BookingCreateInput
): Promise<{ ok: true; value: Booking } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await insertBooking(db)(data);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Booking取得Activity (ID指定)
 * @param id Booking ID
 * @returns 取得されたBooking、またはエラー
 */
export async function getBookingByIdActivity(
    id: string
): Promise<{ ok: true; value: Booking | null } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await findBookingById(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Booking取得Activity (QRコード指定)
 * @param qrCode QRコード
 * @returns 取得されたBooking、またはエラー
 */
export async function getBookingByQrCodeActivity(
    qrCode: string
): Promise<{ ok: true; value: Booking | null } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await findBookingByQrCode(db)(qrCode);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Booking一覧取得Activity
 * @param params クエリパラメータ
 * @returns Booking配列、またはエラー
 */
export async function listBookingsActivity(
    params: BookingQueryInput
): Promise<{ ok: true; value: Booking[] } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookings(db)(params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * User別Booking一覧取得Activity
 * @param userId User ID
 * @param params クエリパラメータ
 * @returns Booking配列、またはエラー
 */
export async function listBookingsByUserActivity(
    userId: string,
    params?: Partial<BookingQueryInput>
): Promise<{ ok: true; value: Booking[] } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookingsByUser(db)(userId, params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Experience別Booking一覧取得Activity
 * @param experienceId Experience ID
 * @param params クエリパラメータ
 * @returns Booking配列、またはエラー
 */
export async function listBookingsByExperienceActivity(
    experienceId: string,
    params?: Partial<BookingQueryInput>
): Promise<{ ok: true; value: Booking[] } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookingsByExperience(db)(experienceId, params);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Booking更新Activity
 * @param id Booking ID
 * @param patch 更新データ
 * @returns 更新されたBooking、またはエラー
 */
export async function updateBookingActivity(
    id: string,
    patch: BookingUpdateInput
): Promise<{ ok: true; value: Booking | null } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await updateBooking(db)(id, patch);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * Booking削除Activity
 * @param id Booking ID
 * @returns 削除成功フラグ、またはエラー
 */
export async function deleteBookingActivity(
    id: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await removeBooking(db)(id);

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * QRコードでの入場記録Activity
 * - QRコード検証
 * - Booking の status を attended に更新
 * - 現地払いの場合は Payment の status を completed に更新
 * @param qrCode QRコード
 * @returns 更新されたBooking、またはエラー
 */
export async function markBookingAsAttendedActivity(
    qrCode: string
): Promise<{ ok: true; value: Booking | null } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();

    // QRコードでBookingを取得
    const findResult = await findBookingByQrCode(db)(qrCode);
    if (findResult.isErr()) {
        return { ok: false, error: findResult.error };
    }

    if (!findResult.value) {
        return { ok: false, error: { code: BookingErrorCode.INVALID_QR_CODE, message: 'Booking not found for QR code' } };
    }

    const booking = findResult.value;

    // バリデーション
    if (booking.status === 'attended') {
        return { ok: false, error: { code: BookingErrorCode.ALREADY_ATTENDED, message: 'Already checked in' } };
    }

    if (booking.status === 'cancelled') {
        return { ok: false, error: { code: BookingErrorCode.BOOKING_CANCELLED, message: 'Booking is cancelled' } };
    }

    // Booking の status を attended に更新
    const updateData: BookingUpdateInput = {
        status: 'attended',
        attendedAt: new Date(),
    };

    const updateResult = await updateBooking(db)(booking.id, updateData);
    if (updateResult.isErr()) {
        return { ok: false, error: updateResult.error };
    }

    // 現地払いの場合は Payment を完了状態にする
    // Payment テーブルから支払い情報を取得
    const { getPaymentByBookingIdActivity } = await import('./payment');
    const paymentResult = await getPaymentByBookingIdActivity(booking.id);

    if (paymentResult.ok && paymentResult.value) {
        const payment = paymentResult.value;

        // 現地払いで未払いの場合のみ、支払い完了処理
        if (payment.paymentMethod === 'onsite' && payment.status === 'pending') {
            const { completePaymentActivity } = await import('./payment');
            const completeResult = await completePaymentActivity(booking.id);

            // 支払い完了エラーは警告のみ（入場は成功させる）
            if (!completeResult.ok) {
                console.warn(`Payment completion failed for booking ${booking.id}:`, completeResult.error);
            }
        }
    }

    return { ok: true, value: updateResult.value };
}

/**
 * ユーザーの体験履歴取得（attended のみ）
 * @param userId User ID
 * @returns attended 状態の Booking 配列、またはエラー
 */
export async function listAttendedBookingsByUserActivity(
    userId: string
): Promise<{ ok: true; value: Booking[] } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookingsByUser(db)(userId, {
        status: 'attended',
    });

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * ユーザーが特定の Experience を体験済みかチェック
 * @param userId User ID
 * @param experienceId Experience ID
 * @returns 体験済みならtrue、またはエラー
 */
export async function hasUserAttendedExperienceActivity(
    userId: string,
    experienceId: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookings(db)({
        userId,
        experienceId,
        status: 'attended',
        limit: 1,
        offset: 0,
    });

    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value.length > 0 };
}
