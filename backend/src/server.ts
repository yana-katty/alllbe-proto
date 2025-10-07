/**
 * tRPC Server - E2E Testing用HTTPサーバー
 * 
 * HonoベースのtRPCサーバー。
 * Temporal Workflowsを呼び出し、CRUD処理を提供。
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { cors } from 'hono/cors';
import { appRouter } from './trpc';
import type { Context } from './trpc/base';
import { trpcLogger } from './trpc/logger';

const app = new Hono();

// CORS設定
app.use('/*', cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
}));

// ヘルスチェックエンドポイント
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'alllbe-trpc-server'
    });
});

// tRPCエンドポイント
app.use('/trpc/*', trpcServer({
    router: appRouter,
    createContext: async () => {
        // TODO: 認証情報の取得
        return {} as Context;
    },
}));

const port = Number(process.env.PORT) || 4000;

// サーバー起動
serve({
    fetch: app.fetch,
    port,
});

trpcLogger.info(`tRPC Server started`, {
    port,
    url: `http://localhost:${port}`,
    trpcEndpoint: `http://localhost:${port}/trpc`,
    healthEndpoint: `http://localhost:${port}/health`,
});
