/**
 * Activities Index
 * 
 * Temporal Activities のエントリーポイント
 * Workflowから使用されるActivity関数をエクスポート
 */

import type { Auth0UserProfile, Auth0UserCreateInput, Auth0UserUpdateInput } from './auth/auth0/types';

// =========================================
// Payment Activities (実装済み)
// =========================================
export {
    // Activity functions
    createPaymentActivity,
    getPaymentByIdActivity,
    getPaymentByBookingIdActivity,
    listPaymentsActivity,
    updatePaymentActivity,
    deletePaymentActivity,
    completePaymentActivity,
    refundPaymentActivity,
    // Types
    type Payment,
    type PaymentCreateInput,
    type PaymentUpdateInput,
    type PaymentQueryInput,
    type PaymentError,
    PaymentErrorCode,
} from './db/models/payment';

// =========================================
// Booking Activities (実装済み)
// =========================================
export {
    // Activity functions
    createBookingActivity,
    getBookingByIdActivity,
    getBookingByQrCodeActivity,
    listBookingsActivity,
    listBookingsByUserActivity,
    listBookingsByExperienceActivity,
    updateBookingActivity,
    deleteBookingActivity,
    markBookingAsAttendedActivity,
    listAttendedBookingsByUserActivity,
    hasUserAttendedExperienceActivity,
    // Types
    type Booking,
    type BookingCreateInput,
    type BookingUpdateInput,
    type BookingQueryInput,
    type BookingError,
    BookingErrorCode,
} from './db/models/booking';

// =========================================
// TODO: 以下は未実装
// =========================================

/**
 * Auth0 User Activities
 */
export async function getAuth0UserActivity(userId: string): Promise<Auth0UserProfile> {
    throw new Error('Not implemented');
}

export async function createAuth0UserActivity(input: Auth0UserCreateInput): Promise<Auth0UserProfile> {
    throw new Error('Not implemented');
}

export async function updateAuth0UserActivity(userId: string, updates: Auth0UserUpdateInput): Promise<Auth0UserProfile> {
    throw new Error('Not implemented');
}

export async function deleteAuth0UserActivity(userId: string): Promise<void> {
    throw new Error('Not implemented');
}

export async function reactivateAuth0UserActivity(userId: string): Promise<Auth0UserProfile> {
    throw new Error('Not implemented');
}

/**
 * DB User Activities
 */
export async function getDbUserActivity(auth0UserId: string): Promise<any> {
    throw new Error('Not implemented');
}

export async function createDbUserActivity(input: any): Promise<any> {
    throw new Error('Not implemented');
}

export async function updateDbUserActivity(platformUserId: string, updates: any): Promise<any> {
    throw new Error('Not implemented');
}

export async function markDbUserDeletedActivity(platformUserId: string): Promise<void> {
    throw new Error('Not implemented');
}

export async function findDbUserByEmailActivity(email: string): Promise<any | null> {
    throw new Error('Not implemented');
}

export async function restoreDbUserActivity(platformUserId: string, data: any): Promise<any> {
    throw new Error('Not implemented');
}
