/**
 * tRPC Base Setup - ルーターとプロシージャの基本設定
 * 
 * 基本的なtRPCの設定とContext、Router、Procedureの定義。
 * 認証・認可の基盤も含める。
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';
import { ApplicationFailure } from '@temporalio/common';
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
 * Temporal ApplicationFailure.type を tRPC エラーコードにマッピング
 * 
 * ApplicationFailure のエラータイプから適切な tRPC エラーコードに変換します。
 * パターンマッチングで柔軟にマッピング可能です。
 * 
 * @param type - ApplicationFailure.type の値（例: 'ORGANIZATION_NOT_FOUND'）
 * @returns TRPC_ERROR_CODE_KEY
 * 
 * @example
 * ```typescript
 * try {
 *   await someWorkflow();
 * } catch (error) {
 *   if (error instanceof ApplicationFailure) {
 *     throw new TRPCError({
 *       code: mapTemporalErrorToTRPC(error.type),
 *       message: error.message,
 *       cause: error,
 *     });
 *   }
 * }
 * ```
 */
export function mapTemporalErrorToTRPC(type: string | undefined): TRPC_ERROR_CODE_KEY {
    if (!type) {
        return 'INTERNAL_SERVER_ERROR';
    }

    // NOT_FOUND パターン（末尾が _NOT_FOUND）
    if (type.endsWith('_NOT_FOUND')) {
        return 'NOT_FOUND';
    }

    // ALREADY_EXISTS パターン（末尾が _ALREADY_EXISTS）
    if (type.endsWith('_ALREADY_EXISTS')) {
        return 'CONFLICT';
    }

    // INVALID_INPUT パターン（末尾が _INVALID_INPUT または _INVALID_EMAIL など）
    if (type.endsWith('_INVALID_INPUT') || type.endsWith('_INVALID_EMAIL') || type.endsWith('_INVALID_DOMAIN')) {
        return 'BAD_REQUEST';
    }

    // UNAUTHORIZED パターン（末尾が _UNAUTHORIZED または _INSUFFICIENT_PERMISSIONS）
    if (type.endsWith('_UNAUTHORIZED') || type.endsWith('_INSUFFICIENT_PERMISSIONS')) {
        return 'UNAUTHORIZED';
    }

    // DATABASE_ERROR パターン（末尾が _DATABASE_ERROR）
    if (type.endsWith('_DATABASE_ERROR')) {
        return 'INTERNAL_SERVER_ERROR';
    }

    // API_ERROR パターン（末尾が _API_ERROR, _WORKOS_ERROR, _AUTH0_ERROR など）
    if (type.endsWith('_API_ERROR') || type.endsWith('_WORKOS_ERROR') || type.endsWith('_AUTH0_ERROR')) {
        return 'INTERNAL_SERVER_ERROR';
    }

    // デフォルト
    return 'INTERNAL_SERVER_ERROR';
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
