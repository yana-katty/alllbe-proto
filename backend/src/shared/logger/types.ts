// 共通ロガーインターフェース
// tRPC と Temporal の共有コードで使用可能

/**
 * ログレベル
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ログメタデータ
 */
export interface LogMetadata {
    [key: string]: unknown;
}

/**
 * 共通ロガーインターフェース
 * 
 * このインターフェースを依存注入することで、
 * tRPC と Temporal の両方で同じコードを使用できます。
 */
export interface Logger {
    /**
     * DEBUGレベルのログを出力
     */
    debug(message: string, meta?: LogMetadata): void;

    /**
     * INFOレベルのログを出力
     */
    info(message: string, meta?: LogMetadata): void;

    /**
     * WARNレベルのログを出力
     */
    warn(message: string, meta?: LogMetadata): void;

    /**
     * ERRORレベルのログを出力
     */
    error(message: string, meta?: LogMetadata): void;

    /**
     * 子ロガーを作成（コンテキストを追加）
     * 
     * @param context - 追加するコンテキスト情報
     * @returns 新しいロガーインスタンス
     */
    child(context: LogMetadata): Logger;
}

/**
 * ロガーの依存注入用の型
 * 
 * 関数の依存として使用:
 * ```typescript
 * export const createOrganization = (
 *   deps: Pick<OrganizationDeps, 'insertOrganization' | 'logger'>
 * ) => async (input) => {
 *   deps.logger.info('Creating organization', { email: input.email });
 *   // ...
 * }
 * ```
 */
export interface HasLogger {
    logger: Logger;
}
