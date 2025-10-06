// Temporal エントリーポイント用のロガー初期化
// Runtime と Worker のログを Winston に統合

import { DefaultLogger, Runtime, makeTelemetryFilterString } from '@temporalio/worker';
import { createWinstonLogger } from '@/shared/logger/winston';

/**
 * Temporal Runtime のロガーを初期化
 * 
 * この関数は Worker を作成する前に一度だけ呼び出してください。
 * Runtime.install() は複数回呼び出すとエラーになります。
 * 
 * @example
 * ```typescript
 * import { initializeTemporalRuntime } from '@/temporal/logger';
 * 
 * // Worker 作成前に初期化
 * initializeTemporalRuntime();
 * 
 * const worker = await Worker.create({
 *   // ...
 * });
 * ```
 */
export function initializeTemporalRuntime(): void {
    const winstonLogger = createWinstonLogger({
        isProduction: process.env.NODE_ENV === 'production',
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        logFilePath: process.env.TEMPORAL_LOG_PATH,
        defaultMeta: {
            service: 'temporal',
        },
    });

    // Rust Core runtime にロガーを設定
    Runtime.install({
        logger: new DefaultLogger('DEBUG', (entry) => {
            // Temporal のログエントリーを Winston に転送
            const label = entry.meta?.activityId
                ? 'activity'
                : entry.meta?.workflowId
                    ? 'workflow'
                    : 'worker';

            winstonLogger.log({
                label,
                level: entry.level.toLowerCase(),
                message: entry.message,
                timestamp: Number(entry.timestampNanos / 1_000_000n),
                ...entry.meta,
            });
        }),
        telemetryOptions: {
            logging: {
                // Rust Core のログを Node.js ロガーに転送
                forward: {},
                // ログフィルター（本番では WARN 推奨）
                filter: makeTelemetryFilterString({
                    core: process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG'
                }),
            },
        },
    });

    winstonLogger.info('Temporal Runtime initialized', {
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'debug',
    });
}
