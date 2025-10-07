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
import { config } from 'dotenv';
import { Connection, Client } from '@temporalio/client';
import { appRouter } from './trpc';
import type { Context } from './trpc/base';
import { trpcLogger } from './trpc/logger';

// 環境変数の読み込み
config();

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

// Temporal Client のセットアップ（グローバルインスタンス）
let temporalClient: Client | null = null;

async function getTemporalClient(): Promise<Client> {
    if (!temporalClient) {
        const connection = await Connection.connect({
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
        });
        temporalClient = new Client({
            connection,
            namespace: 'default',
        });
        trpcLogger.info('Temporal Client connected', {
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
        });
    }
    return temporalClient;
}

// tRPCエンドポイント
app.use('/trpc/*', trpcServer({
    router: appRouter,
    createContext: async (opts) => {
        // Temporal Client の取得
        const temporal = await getTemporalClient();

        // TODO: 将来的には認証情報をヘッダーから取得
        // const authHeader = opts.req.headers.get('authorization');
        // const user = await validateAuth(authHeader);

        return {
            temporal,
            // user,
        } as Context;
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
    temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
});
