/**
 * Temporal エントリーポイント用のロガー初期化
 * 
 * Temporal Runtime と Worker のログを Winston に統合し、
 * Activity と Workflow のログを一元管理します。
 * 
 * ## ログの流れ
 * ```
 * Activity Context Logger (@temporalio/activity)
 *   ↓
 * Workflow Context Logger (@temporalio/workflow)
 *   ↓
 * Temporal Runtime Logger (DefaultLogger)
 *   ↓
 * Winston Logger (このモジュール)
 * ```
 */

import { DefaultLogger, Runtime, makeTelemetryFilterString } from '@temporalio/worker';
import { createWinstonLogger } from '@/shared/logger';

/**
 * Temporal Runtime のロガーを初期化
 * 
 * この関数は Worker を作成する前に**一度だけ**呼び出してください。
 * Runtime.install() を複数回呼び出すとエラーになります。
 * 
 * @throws {Error} Runtime が既に初期化されている場合
 * 
 * @example
 * ```typescript
 * import { initializeTemporalRuntime } from '@/workflows/logger';
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

    // Temporal Runtime にカスタムロガーを設定
    Runtime.install({
        logger: new DefaultLogger('DEBUG', (entry) => {
            // Temporal のログエントリーを Winston に転送
            // Activity/Workflow の Context logger からのログもここを経由
            const label = entry.meta?.activityId
                ? 'activity'
                : entry.meta?.workflowId
                    ? 'workflow'
                    : 'worker';

            winstonLogger.log(entry.level.toLowerCase(), entry.message, {
                label,
                timestamp: entry.timestampNanos ? Number(entry.timestampNanos / 1_000_000n) : Date.now(),
                ...entry.meta,
            });
        }),
        telemetryOptions: {
            logging: {
                // Rust Core のログを Node.js ロガーに転送
                forward: {},
                // ログフィルター（本番では WARN 推奨、開発では DEBUG）
                filter: makeTelemetryFilterString({
                    core: process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG',
                    other: 'INFO',
                }),
            },
        },
    });

    winstonLogger.info('Temporal Runtime initialized', {
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'debug',
    });
}
