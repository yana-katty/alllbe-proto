/**
 * tRPC エントリーポイント
 * CRUD処理用のHTTPサーバー
 */

import { router } from './base';
import { healthRouter } from './health';
import { organizationRouter } from './organization';
import { brandRouter } from './brand';
import { experienceRouter } from './experience';
import { experienceAssetRouter } from './experienceAsset';
import { bookingRouter } from './booking';
import { endUserRouter } from './endUser';

/**
 * App Router - 全てのtRPCルーターを統合
 */
export const appRouter = router({
    health: healthRouter,
    organization: organizationRouter,
    brand: brandRouter,
    experience: experienceRouter,
    experienceAsset: experienceAssetRouter,
    booking: bookingRouter,
    endUser: endUserRouter,
});

export type AppRouter = typeof appRouter;

