/**
 * Auth0 Management Client 初期化・設定
 * 
 * Auth0 Management API へのアクセスを提供する共通クライアント
 * 
 * 依存注入パターン:
 * - Activity内で環境変数を直接読み込まない
 * - Worker起動時やtRPC context作成時に設定を読み込む
 * - 本番環境での設定漏れを起動時に検出
 */

import { ManagementClient } from 'auth0';

/**
 * Auth0 設定型定義
 */
export interface Auth0Config {
    /** Auth0 ドメイン（例: your-tenant.auth0.com） */
    domain: string;
    /** Auth0 Management API のクライアント ID */
    clientId: string;
    /** Auth0 Management API のクライアントシークレット */
    clientSecret: string;
    /** Auth0 Database Connection 名（ユーザー作成時に使用） */
    connectionName: string;
}

/**
 * 環境変数から Auth0 設定を取得
 * 
 * ⚠️ 注意: この関数は Activity 内では呼び出さない
 * Worker起動時やtRPC context作成時に呼び出して、依存注入する
 * 
 * @returns Auth0Config
 * @throws 必須の環境変数が設定されていない場合（起動時にエラーとなる）
 */
export const getAuth0ConfigFromEnv = (): Auth0Config => {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
    const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
    const connectionName = process.env.AUTH0_CONNECTION_NAME || 'Username-Password-Authentication';

    if (!domain || !clientId || !clientSecret) {
        throw new Error(
            'Missing Auth0 configuration. Please set AUTH0_DOMAIN, AUTH0_MANAGEMENT_CLIENT_ID, and AUTH0_MANAGEMENT_CLIENT_SECRET environment variables.'
        );
    }

    return {
        domain,
        clientId,
        clientSecret,
        connectionName,
    };
};

/**
 * Auth0 Management Client のファクトリー関数
 * 
 * @param config - Auth0 設定（必須）
 * @returns ManagementClient インスタンス
 */
export const createAuth0ManagementClient = (config: Auth0Config): ManagementClient => {
    return new ManagementClient({
        domain: config.domain,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
    });
};
