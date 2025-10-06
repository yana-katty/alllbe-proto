// tRPC エントリーポイント用のロガー初期化

import { createLogger } from '@/shared/logger';
import type { Logger } from '@/shared/logger';

/**
 * tRPC サーバー用のロガーを初期化
 * 
 * Winstonベースのロガーを作成し、アプリケーション全体で使用できます。
 */
export function initializeTrpcLogger(): Logger {
    const logger = createLogger({
        isProduction: process.env.NODE_ENV === 'production',
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        logFilePath: process.env.TRPC_LOG_PATH,
        defaultMeta: {
            service: 'trpc',
        },
    });

    logger.info('tRPC logger initialized', {
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'debug',
    });

    return logger;
}

/**
 * グローバルロガーインスタンス（tRPC用）
 * 
 * @example
 * ```typescript
 * import { trpcLogger } from '@/trpc/logger';
 * 
 * trpcLogger.info('Server starting');
 * ```
 */
export const trpcLogger = initializeTrpcLogger();
