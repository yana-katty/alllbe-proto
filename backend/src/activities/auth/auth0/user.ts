/**
 * Auth0 User Activities - エンドユーザー管理
 * 
 * Auth0 Management API を使用したエンドユーザーの CRUD 操作
 * - 個人情報の作成・取得・更新・削除
 * - メール認証状態の管理
 * - アカウントブロック/アンブロック
 * 
 * 依存注入パターン:
 * - Activity内で環境変数を読み込まない
 * - ManagementClient と connectionName を外部から注入
 * - Worker起動時に設定を読み込んで createAuth0UserActivities() を呼び出す
 * 
 * 原則:
 * - ApplicationFailure を使用してエラーハンドリング
 * - try-catch でエラーをキャッチして ApplicationFailure を throw
 * - Auth0 Management Client を依存として受け取る
 */

import { ApplicationFailure } from '@temporalio/common';
import type { ManagementClient } from 'auth0';
import {
    Auth0UserProfile,
    Auth0UserSummary,
    Auth0UserCreateInput,
    Auth0UserUpdateInput,
    Auth0ErrorType,
    createAuth0Error,
    auth0UserProfileSchema,
    auth0UserSummarySchema,
} from './types';

/**
 * Auth0 エラーマッピング - Auth0 API エラーを ApplicationFailure に変換
 */
const mapAuth0Error = (error: unknown): ApplicationFailure => {
    if (typeof error === 'object' && error !== null) {
        const err = error as any;

        // Auth0 API エラーコードのマッピング
        if (err.statusCode === 404) {
            return createAuth0Error({
                type: Auth0ErrorType.USER_NOT_FOUND,
                message: 'User not found in Auth0',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.statusCode === 409 || err.message?.includes('already exists')) {
            return createAuth0Error({
                type: Auth0ErrorType.EMAIL_ALREADY_EXISTS,
                message: 'Email already exists in Auth0',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.statusCode === 400 || err.message?.includes('PasswordStrengthError') || err.message?.includes('invalid')) {
            return createAuth0Error({
                type: Auth0ErrorType.VALIDATION_ERROR,
                message: err.message || 'Validation error',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.statusCode === 401) {
            return createAuth0Error({
                type: Auth0ErrorType.INVALID_CREDENTIALS,
                message: 'Invalid Auth0 credentials',
                details: error,
                nonRetryable: true,
            });
        }

        if (err.statusCode === 403) {
            return createAuth0Error({
                type: Auth0ErrorType.INSUFFICIENT_SCOPE,
                message: 'Insufficient scope for Auth0 operation',
                details: error,
                nonRetryable: true,
            });
        }
    }

    return createAuth0Error({
        type: Auth0ErrorType.API_ERROR,
        message: 'Auth0 API error',
        details: error,
        nonRetryable: false,
    });
};

/**
 * Auth0 User 取得 Activity
 * 
 * 依存注入パターン: ManagementClient を外部から注入
 * 
 * @param client - Auth0 Management Client
 * @returns Activity関数
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 * 
 * @example
 * // Worker 起動時
 * const config = getAuth0ConfigFromEnv();
 * const client = createAuth0ManagementClient(config);
 * 
 * const worker = await Worker.create({
 *   activities: {
 *     getAuth0User: getAuth0User(client),
 *     createAuth0User: createAuth0User(client, config.connectionName),
 *     // ...
 *   },
 * });
 */
export const getAuth0User = (client: ManagementClient) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        try {
            const response = await client.users.get(userId);
            const user = response.data || response;

            return auth0UserProfileSchema.parse({
                user_id: user.user_id,
                email: user.email,
                email_verified: user.email_verified ?? false,
                name: user.name,
                family_name: user.family_name,
                given_name: user.given_name,
                picture: user.picture,
                locale: user.locale,
                zoneinfo: user.zoneinfo,
                last_login: user.last_login,
                created_at: user.created_at,
                updated_at: user.updated_at,
                identities: user.identities,
                app_metadata: user.app_metadata,
                user_metadata: user.user_metadata,
            });
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };

/**
 * Auth0 User Summary 取得 Activity (最小限の情報のみ)
 * 
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const getAuth0UserSummary = (client: ManagementClient) =>
    async (userId: string): Promise<Auth0UserSummary> => {
        try {
            const response = await client.users.get(userId);
            const user = response.data || response;

            return auth0UserSummarySchema.parse({
                user_id: user.user_id,
                email_verified: user.email_verified ?? false,
                blocked: user.blocked ?? false,
                last_login: user.last_login,
                created_at: user.created_at,
            });
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };

/**
 * Auth0 User 作成 Activity
 * 
 * @throws ApplicationFailure (type: AUTH0_EMAIL_ALREADY_EXISTS) - メールアドレスが既に存在する場合
 * @throws ApplicationFailure (type: AUTH0_VALIDATION_ERROR) - バリデーションエラー
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const createAuth0User = (client: ManagementClient, connectionName: string) =>
    async (input: Auth0UserCreateInput): Promise<Auth0UserProfile> => {
        try {
            // Auth0 User 作成データの構築
            const createData = {
                connection: connectionName,
                email: input.email,
                password: input.password,
                name: input.name,
                family_name: input.family_name,
                given_name: input.given_name,
                email_verified: false, // 初期状態は未認証
                app_metadata: {
                    roles: ['end_user'],
                    privacy_settings: {
                        data_processing_consent: input.data_processing_consent,
                        marketing_consent: input.marketing_consent,
                    },
                },
            };

            const response = await client.users.create(createData);

            // Auth0 SDK のレスポンス構造をチェック
            // response.data がない場合は response 自体がユーザーオブジェクト
            const user = response.data || response;

            return auth0UserProfileSchema.parse({
                user_id: user.user_id,
                email: user.email,
                email_verified: user.email_verified ?? false,
                name: user.name,
                family_name: user.family_name,
                given_name: user.given_name,
                picture: user.picture,
                locale: user.locale,
                zoneinfo: user.zoneinfo,
                last_login: user.last_login,
                created_at: user.created_at,
                updated_at: user.updated_at,
                identities: user.identities,
                app_metadata: user.app_metadata,
                user_metadata: user.user_metadata,
            });
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };

/**
 * Auth0 User 更新 Activity
 * 
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_VALIDATION_ERROR) - バリデーションエラー
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const updateAuth0User = (client: ManagementClient) =>
    async (userId: string, input: Auth0UserUpdateInput): Promise<Auth0UserProfile> => {
        try {
            // Auth0 User 更新データの構築
            const updateData = {
                name: input.name,
                family_name: input.family_name,
                given_name: input.given_name,
                picture: input.picture,
                user_metadata: input.user_metadata,
            };

            const response = await client.users.update(userId, updateData);
            const user = response.data || response;

            return auth0UserProfileSchema.parse({
                user_id: user.user_id,
                email: user.email,
                email_verified: user.email_verified ?? false,
                name: user.name,
                family_name: user.family_name,
                given_name: user.given_name,
                picture: user.picture,
                locale: user.locale,
                zoneinfo: user.zoneinfo,
                last_login: user.last_login,
                created_at: user.created_at,
                updated_at: user.updated_at,
                identities: user.identities,
                app_metadata: user.app_metadata,
                user_metadata: user.user_metadata,
            });
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };

/**
 * Auth0 User 削除 Activity (GDPR対応)
 * 
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const deleteAuth0User = (client: ManagementClient) =>
    async (userId: string): Promise<void> => {
        try {
            await client.users.delete(userId);
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };

/**
 * Auth0 User メール認証状態更新 Activity
 * 
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const updateAuth0EmailVerification = (client: ManagementClient) =>
    async (userId: string, emailVerified: boolean): Promise<Auth0UserProfile> => {
        try {
            const updateData = {
                email_verified: emailVerified,
            };

            const response = await client.users.update(userId, updateData);
            const user = response.data || response;

            return auth0UserProfileSchema.parse({
                user_id: user.user_id,
                email: user.email,
                email_verified: user.email_verified ?? false,
                name: user.name,
                family_name: user.family_name,
                given_name: user.given_name,
                picture: user.picture,
                locale: user.locale,
                zoneinfo: user.zoneinfo,
                last_login: user.last_login,
                created_at: user.created_at,
                updated_at: user.updated_at,
                identities: user.identities,
                app_metadata: user.app_metadata,
                user_metadata: user.user_metadata,
            });
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };

/**
 * Auth0 User ブロック/アンブロック Activity
 * 
 * @throws ApplicationFailure (type: AUTH0_USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: AUTH0_API_ERROR) - Auth0 API エラー
 */
export const blockAuth0User = (client: ManagementClient) =>
    async (userId: string, blocked: boolean): Promise<Auth0UserProfile> => {
        try {
            const updateData = {
                blocked,
            };

            const response = await client.users.update(userId, updateData);
            const user = response.data || response;

            return auth0UserProfileSchema.parse({
                user_id: user.user_id,
                email: user.email,
                email_verified: user.email_verified ?? false,
                name: user.name,
                family_name: user.family_name,
                given_name: user.given_name,
                picture: user.picture,
                locale: user.locale,
                zoneinfo: user.zoneinfo,
                last_login: user.last_login,
                created_at: user.created_at,
                updated_at: user.updated_at,
                identities: user.identities,
                app_metadata: user.app_metadata,
                user_metadata: user.user_metadata,
            });
        } catch (error) {
            throw mapAuth0Error(error);
        }
    };
