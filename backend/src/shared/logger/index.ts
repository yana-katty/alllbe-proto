/**
 * 共通 Logger モジュール
 * 
 * このモジュールは Winston ベースのロガー実装を提供し、
 * tRPC と Temporal Runtime の両方で使用されます。
 * 
 * ## 使用方法
 * 
 * ### tRPC での使用
 * ```typescript
 * import { createWinstonLogger } from '@/shared/logger';
 * 
 * const logger = createWinstonLogger({
 *   isProduction: process.env.NODE_ENV === 'production',
 *   defaultMeta: { service: 'trpc' }
 * });
 * ```
 * 
 * ### Temporal Runtime での使用
 * ```typescript
 * import { createWinstonLogger } from '@/shared/logger';
 * import { DefaultLogger, Runtime } from '@temporalio/worker';
 * 
 * const winstonLogger = createWinstonLogger({
 *   isProduction: process.env.NODE_ENV === 'production',
 *   defaultMeta: { service: 'temporal' }
 * });
 * 
 * Runtime.install({
 *   logger: new DefaultLogger('DEBUG', (entry) => {
 *     winstonLogger.log(entry.level.toLowerCase(), entry.message, entry.meta);
 *   })
 * });
 * ```
 */

export { createWinstonLogger } from './winston';
export type { Logger, LoggerConfig } from './types';
