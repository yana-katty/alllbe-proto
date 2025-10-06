/**
 * WorkOS Client 初期化・設定
 * 
 * WorkOS API へのアクセスを提供する共通クライアント
 * Organization 管理、SSO、Enterprise 機能の統合
 * 
 * 依存注入パターン:
 * - Activity内で環境変数を直接読み込まない
 * - Worker起動時やtRPC context作成時に設定を読み込む
 * - 本番環境での設定漏れを起動時に検出
 */

import { WorkOS } from '@workos-inc/node';

/**
 * WorkOS 設定型定義
 */
export interface WorkosConfig {
    /** WorkOS API Key */
    apiKey: string;
    /** WorkOS Client ID */
    clientId: string;
}

/**
 * 環境変数から WorkOS 設定を取得
 * 
 * ⚠️ 注意: この関数は Activity 内では呼び出さない
 * Worker起動時やtRPC context作成時に呼び出して、依存注入する
 * 
 * @returns WorkosConfig
 * @throws 必須の環境変数が設定されていない場合（起動時にエラーとなる）
 */
export const getWorkosConfigFromEnv = (): WorkosConfig => {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;

    if (!apiKey || !clientId) {
        throw new Error(
            'Missing WorkOS configuration. Please set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.'
        );
    }

    return {
        apiKey,
        clientId,
    };
};

/**
 * WorkOS Client のファクトリー関数
 * 
 * @param config - WorkOS 設定（必須）
 * @returns WorkOS インスタンス
 */
export const createWorkosClient = (config: WorkosConfig): WorkOS => {
    return new WorkOS(config.apiKey, {
        clientId: config.clientId,
    });
};
