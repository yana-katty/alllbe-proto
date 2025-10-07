/**
 * Auth0 エンドユーザー認証・個人情報管理の型定義
 * 
 * Auth0 がマスターデータとして管理する情報：
 * - エンドユーザーの認証情報
 * - 個人情報（氏名、メール、プロフィール等）
 * - ソーシャルログイン連携情報
 * 
 * DBには Auth0 の user_id のみを保存し、個人情報の実体は Auth0 で管理
 * GDPR対応: 個人情報削除時は Auth0 での削除のみで完了
 */

import { z } from 'zod';
import { ApplicationFailure } from '@temporalio/common';

/**
 * Auth0 User Profile - Auth0 が管理するエンドユーザーの完全なプロフィール情報
 */
export const auth0UserProfileSchema = z.object({
    /** Auth0 固有のユーザーID (auth0|xxx, google-oauth2|xxx 等) */
    user_id: z.string(),

    /** メールアドレス（必須、認証に使用） */
    email: z.string().email(),

    /** メール認証済みフラグ */
    email_verified: z.boolean(),

    /** 表示名・ニックネーム */
    name: z.string().optional(),

    /** 姓 */
    family_name: z.string().optional(),

    /** 名 */
    given_name: z.string().optional(),

    /** プロフィール画像URL */
    picture: z.string().url().optional(),

    /** ロケール（ja-JP 等） */
    locale: z.string().optional(),

    /** タイムゾーン */
    zoneinfo: z.string().optional(),

    /** 最終ログイン日時 */
    last_login: z.string().datetime().optional(),

    /** アカウント作成日時 */
    created_at: z.string().datetime(),

    /** プロフィール更新日時 */
    updated_at: z.string().datetime(),

    /** ソーシャルログイン連携情報 */
    identities: z.array(z.object({
        provider: z.string(), // google-oauth2, twitter, apple 等
        user_id: z.string(),
        connection: z.string(),
        isSocial: z.boolean(),
    })).optional(),

    /** Auth0 App Metadata（システム管理用） */
    app_metadata: z.object({
        /** プラットフォーム内でのユーザーロール */
        roles: z.array(z.enum(['end_user'])).default(['end_user']),
        /** プライバシー設定 */
        privacy_settings: z.object({
            /** データ処理同意 */
            data_processing_consent: z.boolean().default(false),
            /** マーケティング配信同意 */
            marketing_consent: z.boolean().default(false),
        }).optional(),
    }).optional(),

    /** Auth0 User Metadata（ユーザー編集可能） */
    user_metadata: z.object({
        /** 誕生日 */
        date_of_birth: z.string().optional(),
        /** 性別 */
        gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional(),
        /** 居住地域 */
        location: z.object({
            country: z.string().optional(),
            region: z.string().optional(),
            city: z.string().optional(),
        }).optional(),
        /** 興味・趣向 */
        interests: z.array(z.string()).optional(),
        /** プロフィール公開設定 */
        profile_visibility: z.enum(['public', 'friends', 'private']).default('public'),
    }).optional(),
});

export type Auth0UserProfile = z.infer<typeof auth0UserProfileSchema>;

/**
 * Auth0 User Summary - DB連携で必要最小限の情報
 * 個人情報は含めず、ID と基本的な状態のみ
 */
export const auth0UserSummarySchema = z.object({
    /** Auth0 User ID */
    user_id: z.string(),

    /** メール認証済み状態 */
    email_verified: z.boolean(),

    /** アカウント有効状態 */
    blocked: z.boolean().default(false),

    /** 最終ログイン日時 */
    last_login: z.string().datetime().optional(),

    /** アカウント作成日時 */
    created_at: z.string().datetime(),
});

export type Auth0UserSummary = z.infer<typeof auth0UserSummarySchema>;

/**
 * Auth0 User Creation Input - エンドユーザー登録時の入力
 */
export const auth0UserCreateInputSchema = z.object({
    /** メールアドレス */
    email: z.string().email(),

    /** パスワード（ソーシャルログイン以外） */
    password: z.string().min(8).optional(),

    /** 表示名 */
    name: z.string().optional(),

    /** 姓 */
    family_name: z.string().optional(),

    /** 名 */
    given_name: z.string().optional(),

    /** データ処理同意（必須） */
    data_processing_consent: z.boolean().refine(val => val === true, {
        message: "Data processing consent is required"
    }),

    /** マーケティング配信同意 */
    marketing_consent: z.boolean().default(false),
});

export type Auth0UserCreateInput = z.infer<typeof auth0UserCreateInputSchema>;

/**
 * Auth0 User Update Input - プロフィール更新用
 */
export const auth0UserUpdateInputSchema = z.object({
    /** 表示名 */
    name: z.string().optional(),

    /** 姓 */
    family_name: z.string().optional(),

    /** 名 */
    given_name: z.string().optional(),

    /** プロフィール画像URL */
    picture: z.string().url().optional(),

    /** ユーザーメタデータの更新 */
    user_metadata: z.object({
        date_of_birth: z.string().optional(),
        gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional(),
        location: z.object({
            country: z.string().optional(),
            region: z.string().optional(),
            city: z.string().optional(),
        }).optional(),
        interests: z.array(z.string()).optional(),
        profile_visibility: z.enum(['public', 'friends', 'private']).optional(),
    }).optional(),
}).partial();

export type Auth0UserUpdateInput = z.infer<typeof auth0UserUpdateInputSchema>;

/**
 * Auth0 認証トークン情報
 */
export const auth0TokenInfoSchema = z.object({
    /** アクセストークン */
    access_token: z.string(),

    /** IDトークン */
    id_token: z.string(),

    /** リフレッシュトークン */
    refresh_token: z.string().optional(),

    /** トークンタイプ */
    token_type: z.string().default('Bearer'),

    /** 有効期限（秒） */
    expires_in: z.number(),

    /** スコープ */
    scope: z.string().optional(),
});

export type Auth0TokenInfo = z.infer<typeof auth0TokenInfoSchema>;

/**
 * Auth0 Error Types - Auth0 API エラー管理
 * ApplicationFailure.type として使用される
 */
export enum Auth0ErrorType {
    USER_NOT_FOUND = 'AUTH0_USER_NOT_FOUND',
    EMAIL_ALREADY_EXISTS = 'AUTH0_EMAIL_ALREADY_EXISTS',
    INVALID_CREDENTIALS = 'AUTH0_INVALID_CREDENTIALS',
    TOKEN_EXPIRED = 'AUTH0_TOKEN_EXPIRED',
    INSUFFICIENT_SCOPE = 'AUTH0_INSUFFICIENT_SCOPE',
    API_ERROR = 'AUTH0_API_ERROR',
    VALIDATION_ERROR = 'AUTH0_VALIDATION_ERROR',
}

/**
 * Auth0 エラー情報
 * ApplicationFailure 生成に必要な情報を構造化
 */
export interface Auth0ErrorInfo {
    type: Auth0ErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Auth0 エラー作成ファクトリ
 * 
 * @param info - エラー情報
 * @returns ApplicationFailure インスタンス
 * 
 * @example
 * ```typescript
 * throw createAuth0Error({
 *   type: Auth0ErrorType.EMAIL_ALREADY_EXISTS,
 *   message: `Email already exists: ${email}`,
 *   details: { email },
 *   nonRetryable: true,
 * });
 * ```
 */
export const createAuth0Error = (info: Auth0ErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};