/**
 * tRPC エントリーポイント
 * CRUD処理用のHTTPサーバー
 */

import { router } from './base';
import { healthRouter } from './health';
import { organizationRouter } from './organization';
import { brandRouter } from './brand';
import { bookingRouter } from './booking';

/**
 * App Router - 全てのtRPCルーターを統合
 */
export const appRouter = router({
    health: healthRouter,
    organization: organizationRouter,
    brand: brandRouter,
    booking: bookingRouter,
});

export type AppRouter = typeof appRouter;

