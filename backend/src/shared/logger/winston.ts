/**
 * Winston ベースのロガー実装
 * 
 * tRPC と Temporal Runtime の両方で使用される共通の Winston 設定
 */

import winston from 'winston';
import type { LoggerConfig, Logger } from './types';

/**
 * Winston ロガーを作成
 * 
 * @param config - ロガー設定
 * @returns Winston Logger インスタンス
 * 
 * @example
 * ```typescript
 * const logger = createWinstonLogger({
 *   isProduction: false,
 *   level: 'debug',
 *   defaultMeta: { service: 'api' }
 * });
 * 
 * logger.info('Server started', { port: 3000 });
 * ```
 */
export function createWinstonLogger(config: LoggerConfig): Logger {
    const { isProduction, level, logFilePath, defaultMeta } = config;

    // デフォルトログレベル
    const logLevel = level || (isProduction ? 'info' : 'debug');

    // フォーマット設定
    const format = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        isProduction
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                    return `${timestamp} [${level}]: ${message} ${metaStr}`;
                })
            )
    );

    // トランスポート設定
    const transports: winston.transport[] = [
        new winston.transports.Console({
            format,
        }),
    ];

    // ファイル出力（オプション）
    if (logFilePath) {
        transports.push(
            new winston.transports.File({
                filename: logFilePath,
                format: winston.format.json(), // ファイルには常に JSON 形式
            })
        );
    }

    return winston.createLogger({
        level: logLevel,
        format,
        defaultMeta,
        transports,
    }) as Logger;
}
