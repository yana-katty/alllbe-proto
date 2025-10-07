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
        const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
        const temporalNamespace = process.env.TEMPORAL_NAMESPACE || 'default';
        const temporalApiKey = process.env.TEMPORAL_API_KEY;

        // Temporal Cloud用のTLS設定
        const connectionOptions: Parameters<typeof Connection.connect>[0] = {
            address: temporalAddress,
        };

        // API Keyが設定されている場合はTemporal Cloud接続（TLS有効）
        if (temporalApiKey) {
            connectionOptions.tls = {}; // 空オブジェクトでデフォルトTLS有効化
            connectionOptions.apiKey = temporalApiKey;
        }

        const connection = await Connection.connect(connectionOptions);

        temporalClient = new Client({
            connection,
            namespace: temporalNamespace,
        });
        trpcLogger.info('Temporal Client connected', {
            address: temporalAddress,
            namespace: temporalNamespace,
            cloud: temporalApiKey ? 'Enabled (API Key)' : 'Disabled (Local)',
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
    temporalNamespace: process.env.TEMPORAL_NAMESPACE || 'default',
    temporalCloud: process.env.TEMPORAL_API_KEY ? 'Enabled' : 'Disabled',
    temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
});
