/**
 * Booking Workflows
 * 
 * 予約・決済・来場・キャンセルのビジネスフロー
 * ApplicationFailure を使用したエラーハンドリング
 * 
 * @see .github/instructions/booking-flow.instructions.md
 */

import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type {
    Booking,
    BookingCreateInput,
    BookingUpdateInput,
    createBookingActivities,
} from '../activities/db/models/booking';
import type { createPaymentActivities } from '../activities/db/models/payment';

// Booking Activity のプロキシ設定
const {
    insertBooking,
    findBookingById,
    findBookingByQrCode,
    listBookingsByUser,
    updateBooking,
} = proxyActivities<ReturnType<typeof createBookingActivities>>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

// Payment Activity のプロキシ設定
const {
    findPaymentByBookingId,
    completePayment,
} = proxyActivities<ReturnType<typeof createPaymentActivities>>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

/**
 * ユニークなQRコードを生成
 * 
 * @returns QRコード文字列（例: "BOOKING_2025_ABCD1234"）
 */
function generateUniqueQRCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `BOOKING_${timestamp}_${random}`;
}

/**
 * 予約作成 Workflow
 * 
 * フロー:
 * 1. QRコード生成（ユニーク性保証）
 * 2. Booking 作成
 * 3. （Phase 2）通知送信
 * 
 * @param input - 予約作成データ
 * @returns 作成された Booking
 * @throws ApplicationFailure - 予約作成エラー
 */
export async function createBookingWorkflow(
    input: BookingCreateInput
): Promise<Booking> {
    log.info('createBookingWorkflow started', { input });

    // 1. QRコード生成
    const qrCode = generateUniqueQRCode();
    log.info('QR code generated', { qrCode });

    // 2. Booking 作成
    const booking = await insertBooking({
        ...input,
        qrCode,
        status: 'confirmed',
    });

    log.info('Booking created successfully', {
        bookingId: booking.id,
        qrCode: booking.qrCode,
    });

    // 3. 通知送信（Phase 2）
    // await sendBookingConfirmationEmail(booking);

    return booking;
}

/**
 * QRコード入場 Workflow
 * 
 * フロー:
 * 1. QRコードで Booking 取得
 * 2. バリデーション（ステータス確認）
 * 3. 入場記録（status → 'attended', attendedAt 記録）
 * 4. 現地払いの場合は Payment を完了状態に更新
 * 
 * @param qrCode - QRコード文字列
 * @returns 更新された Booking
 * @throws ApplicationFailure - QRコード不正、すでに入場済み、キャンセル済みなど
 */
export async function checkInWithQRCodeWorkflow(
    qrCode: string
): Promise<Booking> {
    log.info('checkInWithQRCodeWorkflow started', { qrCode });

    // 1. QRコードで Booking 取得
    const booking = await findBookingByQrCode(qrCode);

    if (!booking) {
        log.error('QR code not found', { qrCode });
        throw ApplicationFailure.create({
            message: 'QR code not found',
            type: 'BOOKING_INVALID_QR_CODE',
            nonRetryable: true,
        });
    }

    log.info('Booking found', {
        bookingId: booking.id,
        status: booking.status,
    });

    // 2. バリデーション
    if (booking.status === 'attended') {
        log.warn('Booking already attended', { bookingId: booking.id });
        throw ApplicationFailure.create({
            message: 'Already checked in',
            type: 'BOOKING_ALREADY_ATTENDED',
            nonRetryable: true,
        });
    }

    if (booking.status === 'cancelled') {
        log.warn('Booking is cancelled', { bookingId: booking.id });
        throw ApplicationFailure.create({
            message: 'Booking is cancelled',
            type: 'BOOKING_CANCELLED',
            nonRetryable: true,
        });
    }

    // 3. 入場記録
    const updatedBooking = await updateBooking(booking.id, {
        status: 'attended',
        attendedAt: new Date(),
    });

    log.info('Booking marked as attended', {
        bookingId: updatedBooking.id,
        attendedAt: updatedBooking.attendedAt,
    });

    // 4. 現地払いの場合は Payment を完了状態に更新
    try {
        const payment = await findPaymentByBookingId(booking.id);

        if (payment && payment.paymentMethod === 'onsite' && payment.status === 'pending') {
            log.info('Completing onsite payment', {
                paymentId: payment.id,
                bookingId: booking.id,
            });

            await completePayment(booking.id);

            log.info('Onsite payment completed', {
                paymentId: payment.id,
            });
        }
    } catch (error) {
        // 支払い完了エラーは警告のみ（入場は成功させる）
        log.warn('Payment completion failed (non-blocking)', {
            bookingId: booking.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return updatedBooking;
}

/**
 * キャンセル Workflow
 * 
 * フロー:
 * 1. Booking 取得
 * 2. キャンセル処理（status → 'cancelled', cancelledAt 記録）
 * 3. クレカ決済済みの場合は返金処理（Phase 2）
 * 
 * @param bookingId - 予約ID
 * @param reason - キャンセル理由（オプション）
 * @returns 更新された Booking
 * @throws ApplicationFailure - Booking が見つからない、すでにキャンセル済みなど
 */
export async function cancelBookingWorkflow(
    bookingId: string,
    reason?: string
): Promise<Booking> {
    log.info('cancelBookingWorkflow started', { bookingId, reason });

    // 1. Booking 取得
    const booking = await findBookingById(bookingId);

    if (!booking) {
        log.error('Booking not found', { bookingId });
        throw ApplicationFailure.create({
            message: 'Booking not found',
            type: 'BOOKING_NOT_FOUND',
            nonRetryable: true,
        });
    }

    // 2. バリデーション
    if (booking.status === 'cancelled') {
        log.warn('Booking already cancelled', { bookingId });
        throw ApplicationFailure.create({
            message: 'Booking already cancelled',
            type: 'BOOKING_CANCELLED',
            nonRetryable: true,
        });
    }

    if (booking.status === 'attended') {
        log.warn('Cannot cancel attended booking', { bookingId });
        throw ApplicationFailure.create({
            message: 'Cannot cancel attended booking',
            type: 'BOOKING_ALREADY_ATTENDED',
            nonRetryable: true,
        });
    }

    // 3. キャンセル処理
    const updateData: BookingUpdateInput = {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
    };

    log.info('Cancelling booking', { bookingId, updateData });

    // 4. クレカ決済済みの場合は返金（Phase 2）
    try {
        const payment = await findPaymentByBookingId(booking.id);

        if (payment && payment.paymentMethod === 'credit_card' && payment.status === 'completed') {
            log.info('Refund required for credit card payment (Phase 2)', {
                paymentId: payment.id,
                bookingId: booking.id,
            });
            // Phase 2: 返金処理
            // await refundPaymentActivity(booking.id);
        }
    } catch (error) {
        log.warn('Payment refund check failed', {
            bookingId: booking.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    const cancelledBooking = await updateBooking(bookingId, updateData);

    log.info('Booking cancelled successfully', {
        bookingId: cancelledBooking.id,
        cancelledAt: cancelledBooking.cancelledAt,
    });

    return cancelledBooking;
}
