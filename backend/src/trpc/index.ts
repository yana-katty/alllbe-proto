/**
 * tRPC エントリーポイント
 * CRUD処理用のHTTPサーバー
 */

import { router } from './base';
import { organizationRouter } from './organization';

/**
 * App Router - 全てのtRPCルーターを統合
 */
export const appRouter = router({
    organization: organizationRouter,
});

export type AppRouter = typeof appRouter;

