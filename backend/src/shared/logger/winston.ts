// Winston ベースのロガー実装
// tRPC と共有コードで使用

import winston from 'winston';
import util from 'util';
import type { Logger, LogMetadata } from './types';

/**
 * Winston ロガーオプション
 */
export interface WinstonLoggerOptions {
    /**
     * 本番環境かどうか
     * - true: JSON形式で出力
     * - false: 人間が読みやすい形式で出力
     */
    isProduction: boolean;

    /**
     * ログファイルのパス（オプション）
     */
    logFilePath?: string;

    /**
     * ログレベル
     * @default 'info'
     */
    level?: string;

    /**
     * デフォルトのメタデータ（すべてのログに追加）
     */
    defaultMeta?: LogMetadata;
}

/**
 * タイムスタンプをISO文字列に変換
 */
function getDateStr(timestamp?: number): string {
    return timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
}

/**
 * 開発環境用のログフォーマット
 * 
 * Winston の内部プロパティ（Symbol）を除外してログを整形します。
 */
const devLogFormat = winston.format.printf((info) => {
    const { level, message, label, timestamp, ...meta } = info;

    const labelStr = label ? `[${label}]` : '';

    // メタデータがある場合のみ表示
    const metaStr = Object.keys(meta).length === 0
        ? ''
        : ` ${util.inspect(meta, false, 4, true)}`;

    return `${getDateStr(timestamp as number)} ${labelStr} ${level}: ${message}${metaStr}`;
});

/**
 * Winston ロガーを作成
 */
export function createWinstonLogger(options: WinstonLoggerOptions): winston.Logger {
    const { isProduction, logFilePath, level = 'info', defaultMeta } = options;

    const transports: winston.transport[] = [
        new winston.transports.Console(),
    ];

    if (logFilePath) {
        transports.push(
            new winston.transports.File({
                filename: logFilePath,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            })
        );
    }

    return winston.createLogger({
        level,
        defaultMeta,
        format: isProduction
            ? winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
            : winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.colorize(),
                devLogFormat
            ),
        transports,
    });
}

/**
 * Winston ロガーを共通 Logger インターフェースにラップ
 */
export class WinstonLoggerAdapter implements Logger {
    constructor(private winstonLogger: winston.Logger) { }

    debug(message: string, meta?: LogMetadata): void {
        this.winstonLogger.debug(message, meta);
    }

    info(message: string, meta?: LogMetadata): void {
        this.winstonLogger.info(message, meta);
    }

    warn(message: string, meta?: LogMetadata): void {
        this.winstonLogger.warn(message, meta);
    }

    error(message: string, meta?: LogMetadata): void {
        this.winstonLogger.error(message, meta);
    }

    child(context: LogMetadata): Logger {
        return new WinstonLoggerAdapter(
            this.winstonLogger.child(context)
        );
    }
}

/**
 * Winston ベースのロガーを作成（共通インターフェース）
 * 
 * @example
 * ```typescript
 * const logger = createLogger({
 *   isProduction: process.env.NODE_ENV === 'production',
 *   logFilePath: './logs/app.log',
 *   level: 'debug',
 * });
 * 
 * logger.info('Application started');
 * logger.debug('Debug information', { userId: '123' });
 * ```
 */
export function createLogger(options: WinstonLoggerOptions): Logger {
    const winstonLogger = createWinstonLogger(options);
    return new WinstonLoggerAdapter(winstonLogger);
}
