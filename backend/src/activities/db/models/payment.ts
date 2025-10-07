import { z } from 'zod';
import { Result, ResultAsync } from 'neverthrow';
import { Database } from '../connection';
import { payments, selectPaymentSchema } from '../schema';
import type { Payment } from '../schema';
import { eq, and } from 'drizzle-orm';

// Re-export Payment 型
export type { Payment } from '../schema';

// Payment関連の入力スキーマ
export const paymentCreateSchema = z.object({
    bookingId: z.string().uuid(),
    paymentMethod: z.enum(['onsite', 'credit_card']),
    status: z.enum(['pending', 'completed', 'refunded', 'partially_refunded', 'failed']).default('pending'),
    amount: z.string().min(1),
    currency: z.string().default('JPY'),
    paymentIntentId: z.string().optional(),
    refundId: z.string().optional(),
    transactionId: z.string().optional(),
    paidAt: z.date().optional(),
    refundedAt: z.date().optional(),
    metadata: z.string().optional(),
});

export const paymentUpdateSchema = z.object({
    status: z.enum(['pending', 'completed', 'refunded', 'partially_refunded', 'failed']).optional(),
    paymentIntentId: z.string().optional(),
    refundId: z.string().optional(),
    transactionId: z.string().optional(),
    paidAt: z.date().optional(),
    refundedAt: z.date().optional(),
    metadata: z.string().optional(),
});

export const paymentIdSchema = z.object({ id: z.string().uuid() });

export const paymentQuerySchema = z.object({
    bookingId: z.string().uuid().optional(),
    paymentMethod: z.enum(['onsite', 'credit_card']).optional(),
    status: z.enum(['pending', 'completed', 'refunded', 'partially_refunded', 'failed']).optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
export type PaymentIdInput = z.infer<typeof paymentIdSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;

// エラー定義
export enum PaymentErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    INVALID = 'INVALID',
    DATABASE = 'DATABASE',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    REFUND_FAILED = 'REFUND_FAILED',
    UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface PaymentError {
    code: PaymentErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T> { data: T; message: string }

export type InsertPayment = (data: PaymentCreateInput) => Promise<Result<Payment, PaymentError>>;
export type FindPaymentById = (id: string) => Promise<Result<Payment | null, PaymentError>>;
export type FindPaymentByBookingId = (bookingId: string) => Promise<Result<Payment | null, PaymentError>>;
export type ListPayments = (params: PaymentQueryInput) => Promise<Result<Payment[], PaymentError>>;
export type UpdatePayment = (id: string, patch: PaymentUpdateInput) => Promise<Result<Payment | null, PaymentError>>;
export type RemovePayment = (id: string) => Promise<Result<boolean, PaymentError>>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

export const insertPayment = (db: Database): InsertPayment =>
    async (data: PaymentCreateInput) => {
        return await ResultAsync.fromPromise(
            db.insert(payments).values({
                bookingId: data.bookingId,
                paymentMethod: data.paymentMethod,
                status: data.status ?? 'pending',
                amount: data.amount,
                currency: data.currency ?? 'JPY',
                paymentIntentId: data.paymentIntentId,
                refundId: data.refundId,
                transactionId: data.transactionId,
                paidAt: data.paidAt,
                refundedAt: data.refundedAt,
                metadata: data.metadata,
            }).returning().then(r => selectPaymentSchema.parse(r[0])),
            (error) => ({ code: PaymentErrorCode.DATABASE, message: 'Insert failed', details: error })
        );
    };

export const findPaymentById = (db: Database): FindPaymentById =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(payments).where(eq(payments.id, id)).limit(1).then(r => r[0] ? selectPaymentSchema.parse(r[0]) : null),
            (error) => ({ code: PaymentErrorCode.DATABASE, message: 'Find by ID failed', details: error })
        );
    };

export const findPaymentByBookingId = (db: Database): FindPaymentByBookingId =>
    async (bookingId: string) => {
        return await ResultAsync.fromPromise(
            db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1).then(r => r[0] ? selectPaymentSchema.parse(r[0]) : null),
            (error) => ({ code: PaymentErrorCode.DATABASE, message: 'Find by booking ID failed', details: error })
        );
    };

export const listPayments = (db: Database): ListPayments =>
    async (params: PaymentQueryInput) => {
        const { bookingId, paymentMethod, status, limit, offset } = params;
        const cond: any[] = [];

        if (bookingId) cond.push(eq(payments.bookingId, bookingId));
        if (paymentMethod) cond.push(eq(payments.paymentMethod, paymentMethod));
        if (status) cond.push(eq(payments.status, status));

        const whereClause = cond.length ? and(...cond) : undefined;

        return await ResultAsync.fromPromise(
            db.select().from(payments).where(whereClause).limit(limit).offset(offset).orderBy(payments.createdAt).then(rows => rows.map(r => selectPaymentSchema.parse(r))),
            (error) => ({ code: PaymentErrorCode.DATABASE, message: 'List failed', details: error })
        );
    };

export const updatePayment = (db: Database): UpdatePayment =>
    async (id: string, patch: PaymentUpdateInput) => {
        const updateData: Partial<typeof payments.$inferInsert> & { updatedAt: Date } = {
            updatedAt: new Date()
        };

        if (patch.status !== undefined) updateData.status = patch.status;
        if (patch.paymentIntentId !== undefined) updateData.paymentIntentId = patch.paymentIntentId;
        if (patch.refundId !== undefined) updateData.refundId = patch.refundId;
        if (patch.transactionId !== undefined) updateData.transactionId = patch.transactionId;
        if (patch.paidAt !== undefined) updateData.paidAt = patch.paidAt;
        if (patch.refundedAt !== undefined) updateData.refundedAt = patch.refundedAt;
        if (patch.metadata !== undefined) updateData.metadata = patch.metadata;

        return await ResultAsync.fromPromise(
            db.update(payments).set(updateData).where(eq(payments.id, id)).returning().then(r => r[0] ? selectPaymentSchema.parse(r[0]) : null),
            (error) => ({ code: PaymentErrorCode.DATABASE, message: 'Update failed', details: error })
        );
    };

export const removePayment = (db: Database): RemovePayment =>
    async (id: string) => {
        return await ResultAsync.fromPromise(
            db.delete(payments).where(eq(payments.id, id)).returning().then(r => r.length > 0),
            (error) => ({ code: PaymentErrorCode.DATABASE, message: 'Delete failed', details: error })
        );
    };

/**
 * 決済完了処理（現地払い・クレカ払い共通）
 */
export const completePayment = (db: Database) =>
    async (bookingId: string, paymentIntentId?: string): Promise<Result<Payment | null, PaymentError>> => {
        const paymentResult = await findPaymentByBookingId(db)(bookingId);

        if (paymentResult.isErr()) {
            return paymentResult;
        }

        const payment = paymentResult.value;
        if (!payment) {
            return paymentResult;
        }

        if (payment.status === 'completed') {
            return paymentResult;
        }

        return await updatePayment(db)(payment.id, {
            status: 'completed',
            paidAt: new Date(),
            paymentIntentId: paymentIntentId ?? payment.paymentIntentId ?? undefined,
        });
    };

/**
 * 返金処理
 */
export const refundPayment = (db: Database) =>
    async (bookingId: string, refundId?: string): Promise<Result<Payment | null, PaymentError>> => {
        const paymentResult = await findPaymentByBookingId(db)(bookingId);

        if (paymentResult.isErr()) {
            return paymentResult;
        }

        const payment = paymentResult.value;
        if (!payment) {
            return paymentResult;
        }

        if (payment.status !== 'completed') {
            return await ResultAsync.fromPromise(
                Promise.reject(new Error('Can only refund completed payments')),
                () => ({ code: PaymentErrorCode.INVALID, message: 'Can only refund completed payments' })
            );
        }

        return await updatePayment(db)(payment.id, {
            status: 'refunded',
            refundedAt: new Date(),
            refundId: refundId ?? payment.refundId ?? undefined,
        });
    };
