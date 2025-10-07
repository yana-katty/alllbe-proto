/**
 * Organization tRPC Router
 * 
 * Read操作: Organization Actions を使用（DB + WorkOS 統合データ）
 * CUD操作: Temporal Workflow Client を使用
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Connection, Client, WorkflowIdReusePolicy } from '@temporalio/client';
import { ApplicationFailure } from '@temporalio/common';
import {
    createOrganizationWithWorkosWorkflow,
} from '../workflows/organization';
import { organizationCreateSchema, organizationUpdateSchema, organizationQuerySchema } from '../activities/db/models/organization';
// Actions は使用していないためコメントアウト
// import { createOrganizationActions } from '../actions/organization';

// Temporal Client (シングルトン)
let temporalClient: Client | null = null;

async function getTemporalClient(): Promise<Client> {
    if (!temporalClient) {
        const connection = await Connection.connect({
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
        });
        temporalClient = new Client({ connection });
    }
    return temporalClient;
}

export const organizationRouter = router({
    // ============================================
    // Read Operations (Query) - Organization Actions 使用
    // ============================================

    /**
     * ID指定でOrganizationを取得 (WorkOSデータ統合)
     */
    getById: publicProcedure
        .input(z.string().uuid())
        .query(async ({ input }) => {
            // TODO: WorkOS統合版のActions実装後に有効化
            throw new TRPCError({
                code: 'NOT_IMPLEMENTED',
                message: 'WorkOS integration pending',
            });
        }),

    /**
     * Email指定でOrganizationを取得 (WorkOSデータ統合)
     */
    getByEmail: publicProcedure
        .input(z.string().email())
        .query(async ({ input }) => {
            // TODO: WorkOS統合版のActions実装後に有効化
            throw new TRPCError({
                code: 'NOT_IMPLEMENTED',
                message: 'WorkOS integration pending',
            });
        }),

    /**
     * WorkOS ID指定でOrganizationを取得 (WorkOSデータ統合)
     */
    getByWorkosId: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            // TODO: WorkOS統合版のActions実装後に有効化
            throw new TRPCError({
                code: 'NOT_IMPLEMENTED',
                message: 'WorkOS integration pending',
            });
        }),

    /**
     * Organization一覧を取得 (WorkOSデータ統合)
     */
    list: publicProcedure
        .input(organizationQuerySchema)
        .query(async ({ input }) => {
            // TODO: WorkOS統合版のActions実装後に有効化
            throw new TRPCError({
                code: 'NOT_IMPLEMENTED',
                message: 'WorkOS integration pending',
            });
        }),

    // ============================================
    // CUD Operations (Mutation via Workflow)
    // ============================================

    /**
     * Organizationを作成 (WorkOS連携版)
     * 
     * ApplicationFailure のエラーハンドリング例:
     * - WorkOS Organization 作成失敗
     * - DB Organization 作成失敗
     * - 管理者ユーザー作成失敗（警告のみ）
     */
    createWithWorkos: publicProcedure
        .input(z.object({
            name: z.string(),
            domains: z.array(z.string()),
            adminUser: z.object({
                email: z.string().email(),
                firstName: z.string(),
                lastName: z.string(),
            }).optional(),
        }))
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `organization-workos-create-${input.name}-${Date.now()}`;

                const handle = await client.workflow.start(createOrganizationWithWorkosWorkflow, {
                    args: [input],
                    taskQueue: 'default',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
                });

                return await handle.result();
            } catch (error) {
                // ApplicationFailure のエラーを tRPC エラーコードにマッピング
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }

                // その他のエラー
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create organization with WorkOS',
                    cause: error,
                });
            }
        }),
});
