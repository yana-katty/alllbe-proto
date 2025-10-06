/**
 * Logger 型定義
 * 
 * Winston と互換性のある Logger インターフェース
 */

export interface LoggerConfig {
    /** 本番環境かどうか */
    isProduction: boolean;
    /** ログレベル（デフォルト: production では 'info', development では 'debug'） */
    level?: string;
    /** ログファイルパス（オプション） */
    logFilePath?: string;
    /** すべてのログエントリーに追加されるメタデータ */
    defaultMeta?: Record<string, any>;
}

export interface Logger {
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    http(message: string, meta?: any): void;
    verbose(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    silly(message: string, meta?: any): void;
    log(level: string, message: string, meta?: any): void;
}
