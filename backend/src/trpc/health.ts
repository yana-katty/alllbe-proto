/**
 * Health Check Router - E2E Testing用
 * 
 * WorkOS/Auth0不要のpublicルート。
 * curl -> tRPC -> Temporal -> Worker -> PostgreSQL の全パスをテストできる。
 */

import { z } from 'zod';
import { router, publicProcedure } from './base';
import { Connection, Client } from '@temporalio/client';
import { ApplicationFailure } from '@temporalio/common';
import { trpcLogger } from './logger';
import { getDatabase } from '../activities/db/connection';
import { sql } from 'drizzle-orm';
import { createBrandWorkflow } from '../workflows/brand';

// Temporal Client の初期化（シングルトン）
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
    }
    return temporalClient;
}

/**
 * Health Check Router
 */
export const healthRouter = router({
    /**
     * 基本的なヘルスチェック
     */
    ping: publicProcedure
        .query(() => {
            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: 'alllbe-backend',
            };
        }),

    /**
     * データベース接続チェック
     */
    dbCheck: publicProcedure
        .query(async () => {
            try {
                const db = getDatabase();
                // 簡単なクエリでDB接続を確認
                await db.execute(sql`SELECT 1 as test`);

                return {
                    status: 'ok',
                    message: 'Database connection successful',
                    timestamp: new Date().toISOString(),
                };
            } catch (error) {
                trpcLogger.error('Database connection failed', { error });
                throw new Error('Database connection failed');
            }
        }),

    /**
     * Organizationリスト取得テスト
     * DB -> tRPC のシンプルなパス確認
     */
    listOrganizations: publicProcedure
        .query(async () => {
            try {
                const db = getDatabase();
                const orgs = await db.execute(
                    sql`SELECT id, is_active, created_at FROM organizations LIMIT 10`
                );

                return {
                    status: 'ok',
                    message: 'Organizations fetched successfully',
                    count: orgs.rows.length,
                    organizations: orgs.rows,
                    timestamp: new Date().toISOString(),
                };
            } catch (error) {
                trpcLogger.error('Failed to fetch organizations', { error });
                throw new Error(`Failed to fetch organizations: ${error}`);
            }
        }),

    /**
     * Temporal Workflow テスト（Brand作成）
     * curl -> tRPC -> Temporal -> Worker -> PostgreSQL の全パスを検証
     * 
     * 注意: このエンドポイントはテスト用です。
     * 事前に organizations テーブルに 'test_org_001' を追加しておく必要があります。
     */
    workflowTest: publicProcedure
        .input(z.object({
            organizationId: z.string().default('test_org_001'),
            brandName: z.string().default('Test Brand'),
        }))
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `health-brand-${Date.now()}`;

                trpcLogger.info('Starting Brand creation workflow', {
                    workflowId,
                    organizationId: input.organizationId,
                    brandName: input.brandName,
                });

                const handle = await client.workflow.start(createBrandWorkflow, {
                    args: [
                        {
                            organizationId: input.organizationId,
                            name: input.brandName,
                            description: 'E2E Test Brand',
                            isDefault: false,
                        },
                        'standard',
                    ],
                    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
                    workflowId,
                });

                const result = await Promise.race([
                    handle.result(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Workflow timeout after 10s')), 10000)
                    ),
                ]);

                return {
                    status: 'ok',
                    message: 'Temporal workflow executed successfully',
                    workflowId,
                    result,
                    timestamp: new Date().toISOString(),
                };
            } catch (error) {
                trpcLogger.error('Temporal workflow failed', { error });

                if (error instanceof ApplicationFailure) {
                    throw new Error(`Workflow failed (${error.type}): ${error.message}`);
                }

                throw new Error(`Temporal workflow failed: ${error}`);
            }
        }),

    /**
     * 完全なE2Eテスト
     * curl -> tRPC -> Database の基本パスを検証
     */
    e2eTest: publicProcedure
        .query(async () => {
            const results: Record<string, any> = {};

            // 1. Database Check
            try {
                const db = getDatabase();
                await db.execute(sql`SELECT 1`);
                results.database = { status: 'ok', message: 'Database connection successful' };
            } catch (error) {
                results.database = { status: 'error', message: `Database error: ${error}` };
            }

            // 2. Database Query Check (Organizations table)
            try {
                const db = getDatabase();
                const orgs = await db.execute(
                    sql`SELECT COUNT(*) as count FROM organizations`
                );
                results.databaseQuery = {
                    status: 'ok',
                    message: 'Database query successful',
                    organizationCount: orgs.rows[0]?.count || 0,
                };
            } catch (error) {
                results.databaseQuery = {
                    status: 'error',
                    message: `Database query error: ${error}`
                };
            }

            // 3. Temporal Connection Check
            try {
                await getTemporalClient();
                results.temporal = {
                    status: 'ok',
                    message: 'Temporal connection successful',
                };
            } catch (error) {
                results.temporal = {
                    status: 'error',
                    message: `Temporal connection error: ${error}`
                };
            }

            // 4. Overall Status
            const allOk = Object.values(results).every(r => r.status === 'ok');

            return {
                status: allOk ? 'ok' : 'partial',
                message: allOk
                    ? 'All E2E tests passed'
                    : 'Some E2E tests failed',
                results,
                timestamp: new Date().toISOString(),
            };
        }),
});
