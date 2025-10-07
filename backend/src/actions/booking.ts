/**
 * Booking Actions
 * 
 * Read操作用のAction関数
 * Workflow を経由しない単純な読み取り処理
 */

import type {
    Booking,
    BookingQueryInput,
    FindBookingById,
    ListBookingsByUser,
    ListBookingsByExperience,
    ListAttendedBookingsByUser,
    HasUserAttendedExperience,
} from '../activities/db/models/booking';

/**
 * Booking Action Dependencies
 */
export interface BookingActionDeps {
    findBookingById: FindBookingById;
    listBookingsByUser: ListBookingsByUser;
    listBookingsByExperience: ListBookingsByExperience;
    listAttendedBookingsByUser: ListAttendedBookingsByUser;
    hasUserAttendedExperience: HasUserAttendedExperience;
}

/**
 * IDでBookingを取得
 * 
 * @param deps - 依存関数
 * @returns Booking取得関数
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const getBookingById = (deps: Pick<BookingActionDeps, 'findBookingById'>) =>
    async (id: string): Promise<Booking | null> => {
        return await deps.findBookingById(id);
    };

/**
 * ユーザーのBooking一覧を取得
 * 
 * @param deps - 依存関数
 * @returns Booking一覧取得関数
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listBookingsByUserAction = (deps: Pick<BookingActionDeps, 'listBookingsByUser'>) =>
    async (userId: string, params?: Partial<BookingQueryInput>): Promise<Booking[]> => {
        return await deps.listBookingsByUser(userId, params);
    };

/**
 * ExperienceのBooking一覧を取得
 * 
 * @param deps - 依存関数
 * @returns Booking一覧取得関数
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listBookingsByExperienceAction = (deps: Pick<BookingActionDeps, 'listBookingsByExperience'>) =>
    async (experienceId: string, params?: Partial<BookingQueryInput>): Promise<Booking[]> => {
        return await deps.listBookingsByExperience(experienceId, params);
    };

/**
 * ユーザーの体験済みBooking一覧を取得
 * 
 * @param deps - 依存関数
 * @returns 体験済みBooking一覧取得関数
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const listAttendedBookingsByUserAction = (deps: Pick<BookingActionDeps, 'listAttendedBookingsByUser'>) =>
    async (userId: string): Promise<Booking[]> => {
        return await deps.listAttendedBookingsByUser(userId);
    };

/**
 * ユーザーが特定のExperienceを体験済みかチェック
 * 
 * @param deps - 依存関数
 * @returns 体験済みチェック関数
 * @throws ApplicationFailure (type: BOOKING_DATABASE_ERROR) - DB操作エラー
 */
export const hasUserAttendedExperienceAction = (deps: Pick<BookingActionDeps, 'hasUserAttendedExperience'>) =>
    async (userId: string, experienceId: string): Promise<boolean> => {
        return await deps.hasUserAttendedExperience(userId, experienceId);
    };
