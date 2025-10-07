/**
 * Payment Database Operations
 * 
 * ApplicationFailure ベースのエラーハンドリング:
 * - ErrorType enum でエラー種別を定義
 * - ErrorInfo 型で構造化されたエラー情報
 * - createPaymentError() でApplicationFailure生成
 * - type/details/nonRetryable を活用
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { ApplicationFailure } from '@temporalio/common';
import type { Database } from '../connection';
import { payments, selectPaymentSchema, type Payment } from '../schema';

// Re-export Payment 型
export type { Payment } from '../schema';

// ============================================
// Error Definitions
// ============================================

/**
 * Payment エラータイプ
 */
export enum PaymentErrorType {
    NOT_FOUND = 'PAYMENT_NOT_FOUND',
    ALREADY_EXISTS = 'PAYMENT_ALREADY_EXISTS',
    INVALID_INPUT = 'PAYMENT_INVALID_INPUT',
    DATABASE_ERROR = 'PAYMENT_DATABASE_ERROR',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    REFUND_FAILED = 'PAYMENT_REFUND_FAILED',
    UNAUTHORIZED = 'PAYMENT_UNAUTHORIZED',
    INVALID_STATUS = 'PAYMENT_INVALID_STATUS',
}

/**
 * Payment エラー情報
 */
export interface PaymentErrorInfo {
    type: PaymentErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Payment エラー作成ファクトリ
 */
export const createPaymentError = (info: PaymentErrorInfo): ApplicationFailure => {
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

export const paymentIdSchema = z.object({
    id: z.string().uuid()
});

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

// ============================================
// Activity Function Types
// ============================================

export type InsertPayment = (data: PaymentCreateInput) => Promise<Payment>;
export type FindPaymentById = (id: string) => Promise<Payment | null>;
export type FindPaymentByBookingId = (bookingId: string) => Promise<Payment | null>;
export type ListPayments = (params: PaymentQueryInput) => Promise<Payment[]>;
export type UpdatePayment = (id: string, patch: PaymentUpdateInput) => Promise<Payment>;
export type RemovePayment = (id: string) => Promise<boolean>;
export type CompletePayment = (bookingId: string, paymentIntentId?: string) => Promise<Payment>;
export type RefundPayment = (bookingId: string, refundId?: string) => Promise<Payment>;

// ============================================
// DB操作関数（高階関数パターン）
// ============================================

/**
 * Payment を作成
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const insertPayment = (db: Database): InsertPayment =>
    async (data: PaymentCreateInput): Promise<Payment> => {
        try {
            const result = await db.insert(payments).values({
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
            }).returning();

            if (!result[0]) {
                throw createPaymentError({
                    type: PaymentErrorType.DATABASE_ERROR,
                    message: 'Failed to insert payment: no rows returned',
                    nonRetryable: false,
                });
            }

            return selectPaymentSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createPaymentError({
                type: PaymentErrorType.DATABASE_ERROR,
                message: 'Failed to insert payment',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * IDでPaymentを検索
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const findPaymentById = (db: Database): FindPaymentById =>
    async (id: string): Promise<Payment | null> => {
        try {
            const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
            if (!result[0]) {
                return null;
            }
            return selectPaymentSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createPaymentError({
                type: PaymentErrorType.DATABASE_ERROR,
                message: 'Failed to find payment by ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Booking IDでPaymentを検索
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const findPaymentByBookingId = (db: Database): FindPaymentByBookingId =>
    async (bookingId: string): Promise<Payment | null> => {
        try {
            const result = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1);
            if (!result[0]) {
                return null;
            }
            return selectPaymentSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createPaymentError({
                type: PaymentErrorType.DATABASE_ERROR,
                message: 'Failed to find payment by booking ID',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Payment一覧を取得（条件検索対応）
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const listPayments = (db: Database): ListPayments =>
    async (params: PaymentQueryInput): Promise<Payment[]> => {
        try {
            const { bookingId, paymentMethod, status, limit, offset } = params;
            const cond: Parameters<typeof and>[number][] = [];

            if (bookingId) cond.push(eq(payments.bookingId, bookingId));
            if (paymentMethod) cond.push(eq(payments.paymentMethod, paymentMethod));
            if (status) cond.push(eq(payments.status, status));

            const whereClause = cond.length ? and(...cond) : undefined;

            const result = await db
                .select()
                .from(payments)
                .where(whereClause)
                .limit(limit)
                .offset(offset)
                .orderBy(payments.createdAt);

            return result.map(r => selectPaymentSchema.parse(r));
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createPaymentError({
                type: PaymentErrorType.DATABASE_ERROR,
                message: 'Failed to list payments',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Paymentを更新
 * @throws ApplicationFailure (type: PAYMENT_NOT_FOUND) - Payment が見つからない場合
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const updatePayment = (db: Database): UpdatePayment =>
    async (id: string, patch: PaymentUpdateInput): Promise<Payment> => {
        try {
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

            const result = await db.update(payments).set(updateData).where(eq(payments.id, id)).returning();

            if (!result[0]) {
                throw createPaymentError({
                    type: PaymentErrorType.NOT_FOUND,
                    message: `Payment not found: ${id}`,
                    details: { paymentId: id },
                    nonRetryable: true,
                });
            }

            return selectPaymentSchema.parse(result[0]);
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createPaymentError({
                type: PaymentErrorType.DATABASE_ERROR,
                message: 'Failed to update payment',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * Paymentを削除
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const removePayment = (db: Database): RemovePayment =>
    async (id: string): Promise<boolean> => {
        try {
            const result = await db.delete(payments).where(eq(payments.id, id)).returning();
            return result.length > 0;
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createPaymentError({
                type: PaymentErrorType.DATABASE_ERROR,
                message: 'Failed to delete payment',
                details: error,
                nonRetryable: false,
            });
        }
    };

/**
 * 決済完了処理（現地払い・クレカ払い共通）
 * @throws ApplicationFailure (type: PAYMENT_NOT_FOUND) - Payment が見つからない場合
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const completePayment = (db: Database): CompletePayment =>
    async (bookingId: string, paymentIntentId?: string): Promise<Payment> => {
        const payment = await findPaymentByBookingId(db)(bookingId);

        if (!payment) {
            throw createPaymentError({
                type: PaymentErrorType.NOT_FOUND,
                message: `Payment not found for booking: ${bookingId}`,
                details: { bookingId },
                nonRetryable: true,
            });
        }

        // 既に完了済みならそのまま返す
        if (payment.status === 'completed') {
            return payment;
        }

        return await updatePayment(db)(payment.id, {
            status: 'completed',
            paidAt: new Date(),
            paymentIntentId: paymentIntentId ?? payment.paymentIntentId ?? undefined,
        });
    };

/**
 * 返金処理
 * @throws ApplicationFailure (type: PAYMENT_NOT_FOUND) - Payment が見つからない場合
 * @throws ApplicationFailure (type: PAYMENT_INVALID_STATUS) - 返金不可能なステータスの場合
 * @throws ApplicationFailure (type: PAYMENT_DATABASE_ERROR) - DB操作エラー
 */
export const refundPayment = (db: Database): RefundPayment =>
    async (bookingId: string, refundId?: string): Promise<Payment> => {
        const payment = await findPaymentByBookingId(db)(bookingId);

        if (!payment) {
            throw createPaymentError({
                type: PaymentErrorType.NOT_FOUND,
                message: `Payment not found for booking: ${bookingId}`,
                details: { bookingId },
                nonRetryable: true,
            });
        }

        if (payment.status !== 'completed') {
            throw createPaymentError({
                type: PaymentErrorType.INVALID_STATUS,
                message: 'Can only refund completed payments',
                details: { bookingId, currentStatus: payment.status },
                nonRetryable: true,
            });
        }

        return await updatePayment(db)(payment.id, {
            status: 'refunded',
            refundedAt: new Date(),
            refundId: refundId ?? payment.refundId ?? undefined,
        });
    };

// ============================================
// Factory Function
// ============================================

/**
 * Payment Activity 依存関数の集約
 */
export interface PaymentActivities {
    insertPayment: InsertPayment;
    findPaymentById: FindPaymentById;
    findPaymentByBookingId: FindPaymentByBookingId;
    listPayments: ListPayments;
    updatePayment: UpdatePayment;
    removePayment: RemovePayment;
    completePayment: CompletePayment;
    refundPayment: RefundPayment;
}

/**
 * Payment Activities ファクトリ関数
 * 
 * @param db - Database接続
 * @returns すべてのPayment Activity関数
 * 
 * @example
 * ```typescript
 * const db = await createDatabase();
 * const paymentActivities = createPaymentActivities(db);
 * 
 * const payment = await paymentActivities.insertPayment({
 *   bookingId: 'booking-1',
 *   paymentMethod: 'credit_card',
 *   amount: '5000',
 *   currency: 'JPY',
 * });
 * ```
 */
export const createPaymentActivities = (db: Database): PaymentActivities => ({
    insertPayment: insertPayment(db),
    findPaymentById: findPaymentById(db),
    findPaymentByBookingId: findPaymentByBookingId(db),
    listPayments: listPayments(db),
    updatePayment: updatePayment(db),
    removePayment: removePayment(db),
    completePayment: completePayment(db),
    refundPayment: refundPayment(db),
});
