/**
 * tRPC Base Setup - ルーターとプロシージャの基本設定
 * 
 * 基本的なtRPCの設定とContext、Router、Procedureの定義。
 * 認証・認可の基盤も含める。
 */

import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

/**
 * tRPC Context
 * リクエストごとに渡されるコンテキスト情報
 */
export interface Context {
    // TODO: 認証情報、DB接続などを追加
    // user?: User;
    // db: Database;
}

/**
 * tRPCインスタンス初期化
 */
const t = initTRPC.context<Context>().create({
    errorFormatter: ({ shape, error }) => ({
        ...shape,
        data: {
            ...shape.data,
            code: error.code,
            httpStatus: getHTTPStatusFromTRPCCode(error.code),
        },
    }),
});

/**
 * tRPCエラーコードをHTTPステータスコードにマッピング
 */
function getHTTPStatusFromTRPCCode(code: string): number {
    switch (code) {
        case 'BAD_REQUEST':
            return 400;
        case 'UNAUTHORIZED':
            return 401;
        case 'FORBIDDEN':
            return 403;
        case 'NOT_FOUND':
            return 404;
        case 'CONFLICT':
            return 409;
        case 'TIMEOUT':
            return 408;
        case 'INTERNAL_SERVER_ERROR':
            return 500;
        default:
            return 500;
    }
}

/**
 * Base Router Creator
 */
export const router = t.router;

/**
 * Middleware Creator
 */
export const middleware = t.middleware;

/**
 * Public Procedure（認証不要）
 */
export const publicProcedure = t.procedure;

/**
 * Auth Required Middleware
 * TODO: 実際の認証システムと連携
 */
const authMiddleware = middleware(async ({ ctx, next }) => {
    // TODO: Auth0/WorkOSによる認証チェック
    // if (!ctx.user) {
    //     throw new TRPCError({
    //         code: 'UNAUTHORIZED',
    //         message: 'Authentication required',
    //     });
    // }

    return next({
        ctx: {
            ...ctx,
            // user: ctx.user,
        },
    });
});

/**
 * Protected Procedure（認証必要）
 */
export const protectedProcedure = publicProcedure.use(authMiddleware);

/**
 * Organization Admin Middleware
 * TODO: WorkOS Organization管理者権限チェック
 */
const orgAdminMiddleware = middleware(async ({ ctx, next }) => {
    // TODO: WorkOS Organization管理者権限のチェック

    return next({
        ctx,
    });
});

/**
 * Organization Admin Procedure（Organization管理者権限必要）
 */
export const orgAdminProcedure = protectedProcedure.use(orgAdminMiddleware);
