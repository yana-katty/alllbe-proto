'use client';

import { trpc } from '@/lib/trpc';

/**
 * ユーザーのExperienceに対するアクセスレベルを判定するフック
 * 
 * @param experienceId - Experience ID
 * @returns アクセスレベル ('public' | 'ticket_holder' | 'attended')
 */
export function useExperienceAccessLevel(experienceId: string): {
    accessLevel: 'public' | 'ticket_holder' | 'attended';
    isLoading: boolean;
} {
    // 環境変数からモックユーザーIDを取得
    const mockUserId = process.env.NEXT_PUBLIC_MOCK_USER_ID || 'auth0|mock-user-001';

    // ユーザーのBooking一覧を取得
    const { data: bookings, isLoading } = trpc.booking.listMine.useQuery(
        {
            userId: mockUserId,
            limit: 100,
        },
        {
            // Auth0統合前はスキップ（Phase 3で実装予定）
            enabled: false,
        }
    );

    // 現在はPhase 2なので、常にpublicを返す
    // Phase 3（Auth0統合後）に以下のロジックを有効化：
    // 1. bookings から experienceId に一致する予約を探す
    // 2. status === 'attended' なら 'attended'
    // 3. status === 'confirmed' または 'pending' なら 'ticket_holder'
    // 4. それ以外は 'public'

    return {
        accessLevel: 'public',
        isLoading: false,
    };
}
