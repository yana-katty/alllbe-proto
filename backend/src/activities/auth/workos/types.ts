/**
 * WorkOS Organization・Enterprise 管理の型定義
 * 
 * WorkOS がマスターデータとして管理する情報：
 * - Organization の詳細情報（企業情報、設定等）
 * - Organization 配下の管理ユーザーの個人情報・権限
 * - SSO 設定・Enterprise 機能
 * 
 * DBには WorkOS の organization_id, user_id のみを保存し、実体は WorkOS で管理
 * GDPR対応: 個人情報削除時は WorkOS での削除のみで完了
 */

import { z } from 'zod';

/**
 * WorkOS Organization - WorkOS が管理する Organization の完全な情報
 */
export const workosOrganizationSchema = z.object({
    /** WorkOS Organization ID */
    id: z.string(),

    /** Organization 名 */
    name: z.string(),

    /** Organization のドメイン（複数可） */
    domains: z.array(z.object({
        domain: z.string(),
        state: z.enum(['verified', 'pending', 'failed']),
    })),

    /** 作成日時 */
    created_at: z.string().datetime(),

    /** 更新日時 */
    updated_at: z.string().datetime(),

    /** Organization の詳細情報 */
    metadata: z.object({
        /** 企業の正式名称 */
        legal_name: z.string().optional(),

        /** 企業の説明 */
        description: z.string().optional(),

        /** 業界 */
        industry: z.string().optional(),

        /** 従業員数 */
        employee_count: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),

        /** 企業ウェブサイト */
        website: z.string().url().optional(),

        /** 本社所在地 */
        headquarters: z.object({
            country: z.string(),
            region: z.string().optional(),
            city: z.string().optional(),
            address: z.string().optional(),
            postal_code: z.string().optional(),
        }).optional(),

        /** 連絡先情報 */
        contact: z.object({
            email: z.string().email(),
            phone: z.string().optional(),
        }),

        /** 請求先情報 */
        billing: z.object({
            company_name: z.string(),
            email: z.string().email(),
            address: z.object({
                line1: z.string(),
                line2: z.string().optional(),
                city: z.string(),
                state: z.string().optional(),
                postal_code: z.string(),
                country: z.string(),
            }),
        }).optional(),

        /** Enterprise 設定 */
        enterprise_settings: z.object({
            /** SSO 必須設定 */
            sso_required: z.boolean().default(false),

            /** ドメイン制限 */
            domain_restriction: z.boolean().default(false),

            /** セッション タイムアウト（分） */
            session_timeout_minutes: z.number().int().min(30).max(1440).default(480),

            /** 二段階認証必須 */
            mfa_required: z.boolean().default(false),
        }).optional(),

        /** プラットフォーム固有設定 */
        platform_settings: z.object({
            /** Experience 作成上限 */
            experience_limit: z.number().int().optional(),

            /** 月間予約上限 */
            monthly_booking_limit: z.number().int().optional(),

            /** カスタムブランディング許可 */
            custom_branding_enabled: z.boolean().default(false),

            /** 高度な分析機能 */
            advanced_analytics_enabled: z.boolean().default(false),

            /** API アクセス許可 */
            api_access_enabled: z.boolean().default(false),
        }).optional(),
    }).optional(),
});

export type WorkosOrganization = z.infer<typeof workosOrganizationSchema>;

/**
 * WorkOS Organization User - WorkOS が管理する Organization 配下のユーザー
 */
export const workosOrganizationUserSchema = z.object({
    /** WorkOS User ID */
    id: z.string(),

    /** WorkOS Organization ID */
    organization_id: z.string(),

    /** メールアドレス */
    email: z.string().email(),

    /** 姓 */
    first_name: z.string(),

    /** 名 */
    last_name: z.string(),

    /** 作成日時 */
    created_at: z.string().datetime(),

    /** 更新日時 */
    updated_at: z.string().datetime(),

    /** ユーザーの状態 */
    state: z.enum(['active', 'inactive', 'pending', 'suspended']),

    /** Organization 内での役職・部署 */
    profile: z.object({
        /** 役職 */
        job_title: z.string().optional(),

        /** 部署 */
        department: z.string().optional(),

        /** 管理者レベル */
        admin_level: z.enum(['super_admin', 'admin', 'manager', 'member']),

        /** 権限設定 */
        permissions: z.array(z.enum([
            'experience.create',
            'experience.edit',
            'experience.delete',
            'experience.publish',
            'booking.view',
            'booking.manage',
            'analytics.view',
            'organization.settings',
            'user.invite',
            'user.manage',
            'billing.view',
            'billing.manage',
        ])),

        /** 連絡先情報 */
        contact: z.object({
            phone: z.string().optional(),
            extension: z.string().optional(),
        }).optional(),

        /** プロフィール情報 */
        bio: z.string().optional(),
        avatar_url: z.string().url().optional(),

        /** 勤務情報 */
        employment: z.object({
            start_date: z.string().date().optional(),
            employee_id: z.string().optional(),
            employment_type: z.enum(['full_time', 'part_time', 'contractor', 'intern']).optional(),
        }).optional(),
    }).optional(),
});

export type WorkosOrganizationUser = z.infer<typeof workosOrganizationUserSchema>;

/**
 * WorkOS Organization Summary - DB連携で必要最小限の情報
 */
export const workosOrganizationSummarySchema = z.object({
    /** WorkOS Organization ID */
    id: z.string(),

    /** Organization 名 */
    name: z.string(),

    /** 認証済みドメイン数 */
    verified_domain_count: z.number().int(),

    /** アクティブユーザー数 */
    active_user_count: z.number().int(),

    /** Enterprise 機能有効状態 */
    enterprise_enabled: z.boolean(),

    /** 作成日時 */
    created_at: z.string().datetime(),
});

export type WorkosOrganizationSummary = z.infer<typeof workosOrganizationSummarySchema>;

/**
 * WorkOS User Summary - DB連携で必要最小限の情報
 */
export const workosUserSummarySchema = z.object({
    /** WorkOS User ID */
    id: z.string(),

    /** WorkOS Organization ID */
    organization_id: z.string(),

    /** 管理者レベル */
    admin_level: z.enum(['super_admin', 'admin', 'manager', 'member']),

    /** ユーザー状態 */
    state: z.enum(['active', 'inactive', 'pending', 'suspended']),

    /** 最終ログイン日時 */
    last_login: z.string().datetime().optional(),

    /** 作成日時 */
    created_at: z.string().datetime(),
});

export type WorkosUserSummary = z.infer<typeof workosUserSummarySchema>;

/**
 * WorkOS Organization Creation Input
 */
export const workosOrganizationCreateInputSchema = z.object({
    /** Organization 名 */
    name: z.string().min(1).max(255),

    /** ドメイン */
    domains: z.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)),

    /** 企業情報 */
    legal_name: z.string().optional(),
    description: z.string().optional(),
    industry: z.string().optional(),
    employee_count: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
    website: z.string().url().optional(),

    /** 連絡先 */
    contact_email: z.string().email(),
    contact_phone: z.string().optional(),

    /** 管理者情報 */
    admin_user: z.object({
        email: z.string().email(),
        first_name: z.string(),
        last_name: z.string(),
        job_title: z.string().optional(),
    }),
});

export type WorkosOrganizationCreateInput = z.infer<typeof workosOrganizationCreateInputSchema>;

/**
 * WorkOS User Invitation Input
 */
export const workosUserInviteInputSchema = z.object({
    /** 招待先メールアドレス */
    email: z.string().email(),

    /** 姓 */
    first_name: z.string(),

    /** 名 */
    last_name: z.string(),

    /** 管理者レベル */
    admin_level: z.enum(['super_admin', 'admin', 'manager', 'member']),

    /** 権限設定 */
    permissions: z.array(z.enum([
        'experience.create',
        'experience.edit',
        'experience.delete',
        'experience.publish',
        'booking.view',
        'booking.manage',
        'analytics.view',
        'organization.settings',
        'user.invite',
        'user.manage',
        'billing.view',
        'billing.manage',
    ])),

    /** 役職・部署 */
    job_title: z.string().optional(),
    department: z.string().optional(),

    /** 招待メッセージ */
    invitation_message: z.string().optional(),
});

export type WorkosUserInviteInput = z.infer<typeof workosUserInviteInputSchema>;

/**
 * WorkOS SSO Connection Information
 */
export const workosConnectionSchema = z.object({
    /** Connection ID */
    id: z.string(),

    /** Organization ID */
    organization_id: z.string(),

    /** Connection タイプ */
    connection_type: z.enum(['saml', 'oidc', 'google', 'microsoft']),

    /** Connection 名 */
    name: z.string(),

    /** 状態 */
    state: z.enum(['active', 'inactive', 'draft']),

    /** ドメイン */
    domains: z.array(z.string()),

    /** 作成日時 */
    created_at: z.string().datetime(),

    /** 更新日時 */
    updated_at: z.string().datetime(),
});

export type WorkosConnection = z.infer<typeof workosConnectionSchema>;

/**
 * WorkOS Error Types
 */
export enum WorkosErrorCode {
    ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    DOMAIN_ALREADY_EXISTS = 'DOMAIN_ALREADY_EXISTS',
    INVALID_DOMAIN = 'INVALID_DOMAIN',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    SSO_NOT_CONFIGURED = 'SSO_NOT_CONFIGURED',
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    API_ERROR = 'API_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface WorkosError {
    code: WorkosErrorCode;
    message: string;
    details?: unknown;
}