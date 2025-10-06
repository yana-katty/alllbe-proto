/**
 * DB連携型定義 - Auth0/WorkOS との ID 紐づけ専用
 * 
 * 個人情報は Auth0/WorkOS がマスター管理し、DBには以下のみ保存：
 * - Auth0/WorkOS の ID 参照
 * - プラットフォーム固有の関連データ（Experience、Booking等）
 * - 統計・分析用の非個人情報
 * 
 * GDPR対応: 個人情報削除時はAuth0/WorkOS側のみ削除すれば完了
 * DB側は参照IDが無効になるだけで、個人情報漏洩リスクなし
 */

import { z } from 'zod';

/**
 * DB User Entity - エンドユーザーのプラットフォーム内データ
 * 個人情報は一切含まず、Auth0 ID との紐づけのみ
 */
export const dbUserEntitySchema = z.object({
    /** プラットフォーム内でのユニークID（UUID） */
    id: z.string().uuid(),

    /** Auth0 User ID（外部キー、個人情報は Auth0 で管理） */
    auth0_user_id: z.string(),

    /** アカウント作成日時 */
    created_at: z.date(),

    /** 最終更新日時 */
    updated_at: z.date(),

    /** アカウント状態（プラットフォーム固有） */
    status: z.enum(['active', 'suspended', 'deleted']).default('active'),

    /** プラットフォーム内での統計情報（非個人情報） */
    stats: z.object({
        /** 総予約数 */
        total_bookings: z.number().int().min(0).default(0),

        /** 完了した Experience 数 */
        completed_experiences: z.number().int().min(0).default(0),

        /** キャンセル数 */
        cancelled_bookings: z.number().int().min(0).default(0),

        /** Experience Circle 参加数 */
        circle_participations: z.number().int().min(0).default(0),

        /** 初回予約日時 */
        first_booking_at: z.date().optional(),

        /** 最終 Experience 参加日時 */
        last_experience_at: z.date().optional(),
    }).default({}),

    /** プラットフォーム設定（非個人情報） */
    platform_settings: z.object({
        /** 通知設定 */
        notifications: z.object({
            booking_reminders: z.boolean().default(true),
            experience_updates: z.boolean().default(true),
            circle_activities: z.boolean().default(true),
            marketing: z.boolean().default(false),
        }).default({}),

        /** 言語設定 */
        locale: z.string().default('ja-JP'),

        /** タイムゾーン */
        timezone: z.string().default('Asia/Tokyo'),
    }).default({}),
});

export type DbUserEntity = z.infer<typeof dbUserEntitySchema>;

/**
 * DB Organization Entity - Organization のプラットフォーム内データ
 * 企業情報は WorkOS で管理、DBには紐づけと運営データのみ
 */
export const dbOrganizationEntitySchema = z.object({
    /** プラットフォーム内でのユニークID（UUID） */
    id: z.string().uuid(),

    /** WorkOS Organization ID（外部キー、企業情報は WorkOS で管理） */
    workos_organization_id: z.string(),

    /** 作成日時 */
    created_at: z.date(),

    /** 最終更新日時 */
    updated_at: z.date(),

    /** Organization 状態（プラットフォーム固有） */
    status: z.enum(['active', 'suspended', 'pending_approval', 'deleted']).default('pending_approval'),

    /** プラットフォーム内での統計情報（非個人情報） */
    stats: z.object({
        /** 総 Experience 数 */
        total_experiences: z.number().int().min(0).default(0),

        /** アクティブな Experience 数 */
        active_experiences: z.number().int().min(0).default(0),

        /** 総予約数 */
        total_bookings: z.number().int().min(0).default(0),

        /** 総売上（単位: 円） */
        total_revenue: z.number().min(0).default(0),

        /** 平均評価 */
        average_rating: z.number().min(1).max(5).optional(),

        /** 初回 Experience 公開日時 */
        first_experience_at: z.date().optional(),

        /** 最終 Experience 更新日時 */
        last_experience_update_at: z.date().optional(),
    }).default({}),

    /** プラットフォーム設定（非個人情報） */
    platform_settings: z.object({
        /** 公開設定 */
        visibility: z.enum(['public', 'unlisted', 'private']).default('public'),

        /** 自動承認設定 */
        auto_approve_bookings: z.boolean().default(true),

        /** 通知設定 */
        notifications: z.object({
            new_bookings: z.boolean().default(true),
            cancellations: z.boolean().default(true),
            reviews: z.boolean().default(true),
            system_updates: z.boolean().default(true),
        }).default({}),

        /** 決済設定 */
        payment_settings: z.object({
            /** Stripe Connect Account ID */
            stripe_account_id: z.string().optional(),

            /** 手数料設定受諾フラグ */
            fee_structure_accepted: z.boolean().default(false),

            /** 自動振込設定 */
            auto_payout_enabled: z.boolean().default(false),
        }).default({}),
    }).default({}),
});

export type DbOrganizationEntity = z.infer<typeof dbOrganizationEntitySchema>;

/**
 * DB Organization User Entity - Organization 配下ユーザーのプラットフォーム内データ
 * 個人情報は WorkOS で管理、DBには紐づけと権限データのみ
 */
export const dbOrganizationUserEntitySchema = z.object({
    /** プラットフォーム内でのユニークID（UUID） */
    id: z.string().uuid(),

    /** DB Organization ID */
    organization_id: z.string().uuid(),

    /** WorkOS User ID（外部キー、個人情報は WorkOS で管理） */
    workos_user_id: z.string(),

    /** 作成日時 */
    created_at: z.date(),

    /** 最終更新日時 */
    updated_at: z.date(),

    /** ユーザー状態（プラットフォーム固有） */
    status: z.enum(['active', 'inactive', 'suspended']).default('active'),

    /** プラットフォーム内での統計情報（非個人情報） */
    stats: z.object({
        /** 作成した Experience 数 */
        created_experiences: z.number().int().min(0).default(0),

        /** 管理した予約数 */
        managed_bookings: z.number().int().min(0).default(0),

        /** 最終ログイン日時 */
        last_login_at: z.date().optional(),

        /** 初回 Experience 作成日時 */
        first_experience_created_at: z.date().optional(),
    }).default({}),

    /** プラットフォーム設定（非個人情報） */
    platform_settings: z.object({
        /** 通知設定 */
        notifications: z.object({
            new_bookings: z.boolean().default(true),
            cancellations: z.boolean().default(true),
            system_updates: z.boolean().default(true),
        }).default({}),

        /** ダッシュボード設定 */
        dashboard_preferences: z.object({
            default_view: z.enum(['calendar', 'list', 'analytics']).default('calendar'),
            show_stats: z.boolean().default(true),
        }).default({}),
    }).default({}),
});

export type DbOrganizationUserEntity = z.infer<typeof dbOrganizationUserEntitySchema>;

/**
 * User Lookup Result - Auth0 情報付きユーザー情報
 * DB データと Auth0 の個人情報を結合した読み取り専用ビュー
 */
export const userLookupResultSchema = z.object({
    /** DB User Entity */
    db_user: dbUserEntitySchema,

    /** Auth0 User Summary（個人情報は含まない要約のみ） */
    auth0_summary: z.object({
        user_id: z.string(),
        email_verified: z.boolean(),
        blocked: z.boolean(),
        last_login: z.string().datetime().optional(),
        created_at: z.string().datetime(),
    }),

    /** 個人情報取得の可否フラグ */
    can_access_personal_info: z.boolean(),
});

export type UserLookupResult = z.infer<typeof userLookupResultSchema>;

/**
 * Organization Lookup Result - WorkOS 情報付き Organization 情報
 * DB データと WorkOS の企業情報を結合した読み取り専用ビュー
 */
export const organizationLookupResultSchema = z.object({
    /** DB Organization Entity */
    db_organization: dbOrganizationEntitySchema,

    /** WorkOS Organization Summary（企業情報は含まない要約のみ） */
    workos_summary: z.object({
        id: z.string(),
        name: z.string(),
        verified_domain_count: z.number().int(),
        active_user_count: z.number().int(),
        enterprise_enabled: z.boolean(),
        created_at: z.string().datetime(),
    }),

    /** 企業情報取得の可否フラグ */
    can_access_organization_info: z.boolean(),
});

export type OrganizationLookupResult = z.infer<typeof organizationLookupResultSchema>;

/**
 * DB Entity Create Inputs - 新規作成用の入力型
 */
export const dbUserCreateInputSchema = dbUserEntitySchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    stats: true,
}).partial({ platform_settings: true });

export const dbOrganizationCreateInputSchema = dbOrganizationEntitySchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    stats: true,
}).partial({ platform_settings: true });

export const dbOrganizationUserCreateInputSchema = dbOrganizationUserEntitySchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    stats: true,
}).partial({ platform_settings: true });

export type DbUserCreateInput = z.infer<typeof dbUserCreateInputSchema>;
export type DbOrganizationCreateInput = z.infer<typeof dbOrganizationCreateInputSchema>;
export type DbOrganizationUserCreateInput = z.infer<typeof dbOrganizationUserCreateInputSchema>;

/**
 * Privacy Compliance Types - GDPR対応用
 */
export const privacyComplianceRequestSchema = z.object({
    /** リクエストタイプ */
    request_type: z.enum(['data_export', 'data_deletion', 'data_portability']),

    /** Auth0 User ID または WorkOS User ID */
    user_id: z.string(),

    /** ユーザータイプ */
    user_type: z.enum(['end_user', 'organization_user']),

    /** リクエスト日時 */
    requested_at: z.date(),

    /** 処理状態 */
    status: z.enum(['pending', 'processing', 'completed', 'failed']),

    /** 処理完了日時 */
    completed_at: z.date().optional(),

    /** エラー情報 */
    error_message: z.string().optional(),
});

export type PrivacyComplianceRequest = z.infer<typeof privacyComplianceRequestSchema>;

/**
 * DB Integration Error Types
 */
export enum DbIntegrationErrorCode {
    AUTH0_USER_NOT_FOUND = 'AUTH0_USER_NOT_FOUND',
    WORKOS_ORGANIZATION_NOT_FOUND = 'WORKOS_ORGANIZATION_NOT_FOUND',
    WORKOS_USER_NOT_FOUND = 'WORKOS_USER_NOT_FOUND',
    DB_USER_NOT_FOUND = 'DB_USER_NOT_FOUND',
    DB_ORGANIZATION_NOT_FOUND = 'DB_ORGANIZATION_NOT_FOUND',
    REFERENCE_INTEGRITY_ERROR = 'REFERENCE_INTEGRITY_ERROR',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',
}

export interface DbIntegrationError {
    code: DbIntegrationErrorCode;
    message: string;
    details?: unknown;
}