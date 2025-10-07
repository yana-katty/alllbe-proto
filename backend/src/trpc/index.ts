/**
 * tRPC エントリーポイント
 * CRUD処理用のHTTPサーバー
 */

import { router } from './base';
import { organizationRouter } from './organization';
import { brandRouter } from './brand';

/**
 * App Router - 全てのtRPCルーターを統合
 */
export const appRouter = router({
    organization: organizationRouter,
    brand: brandRouter,
});

export type AppRouter = typeof appRouter;

