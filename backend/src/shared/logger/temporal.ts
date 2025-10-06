// Temporal のログを共通インターフェースに変換するアダプター
// @temporalio/activity と @temporalio/workflow の log を使用

import type { Logger, LogMetadata } from './types';

/**
 * Temporal のログインターフェース
 * @temporalio/activity と @temporalio/workflow の log
 */
interface TemporalLog {
    debug(message: string, attrs?: Record<string, unknown>): void;
    info(message: string, attrs?: Record<string, unknown>): void;
    warn(message: string, attrs?: Record<string, unknown>): void;
    error(message: string, attrs?: Record<string, unknown>): void;
}

/**
 * Temporal のログを共通 Logger インターフェースに変換するアダプター
 * 
 * Activity と Workflow で使用:
 * ```typescript
 * // Activity
 * import { log as temporalLog } from '@temporalio/activity';
 * import { createTemporalLogger } from '@/shared/logger/temporal';
 * 
 * const logger = createTemporalLogger(temporalLog);
 * 
 * export async function myActivity() {
 *   logger.info('Activity started');
 *   // 共有コードに logger を渡すことができる
 *   await sharedFunction({ logger });
 * }
 * ```
 * 
 * ```typescript
 * // Workflow
 * import { log as temporalLog } from '@temporalio/workflow';
 * import { createTemporalLogger } from '@/shared/logger/temporal';
 * 
 * const logger = createTemporalLogger(temporalLog);
 * 
 * export async function myWorkflow() {
 *   logger.info('Workflow started');
 * }
 * ```
 */
export class TemporalLoggerAdapter implements Logger {
    constructor(
        private temporalLog: TemporalLog,
        private context: LogMetadata = {}
    ) { }

    debug(message: string, meta?: LogMetadata): void {
        this.temporalLog.debug(message, this.mergeContext(meta));
    }

    info(message: string, meta?: LogMetadata): void {
        this.temporalLog.info(message, this.mergeContext(meta));
    }

    warn(message: string, meta?: LogMetadata): void {
        this.temporalLog.warn(message, this.mergeContext(meta));
    }

    error(message: string, meta?: LogMetadata): void {
        this.temporalLog.error(message, this.mergeContext(meta));
    }

    child(context: LogMetadata): Logger {
        return new TemporalLoggerAdapter(
            this.temporalLog,
            this.mergeContext(context)
        );
    }

    private mergeContext(meta?: LogMetadata): LogMetadata {
        return { ...this.context, ...meta };
    }
}

/**
 * Temporal のログを共通 Logger インターフェースに変換
 * 
 * @param temporalLog - @temporalio/activity または @temporalio/workflow の log
 * @returns 共通 Logger インターフェース
 * 
 * @example
 * ```typescript
 * import { log } from '@temporalio/activity';
 * import { createTemporalLogger } from '@/shared/logger/temporal';
 * 
 * const logger = createTemporalLogger(log);
 * logger.info('Hello from activity');
 * ```
 */
export function createTemporalLogger(temporalLog: TemporalLog): Logger {
    return new TemporalLoggerAdapter(temporalLog);
}
