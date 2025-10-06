/**
 * EndUser tRPC Router - Auth0エンドユーザー管理
 * 
 * 設計原則:
 * - service/repositoryディレクトリは作成せず、Activityで直接実装
 * - 排他制御はWorkflow Id Reuse PolicyのDuplicateでclient側で管理
 * - 複雑な状態管理やSignal/Updateは使用せず、シンプルな処理フローに留める
 * - 読み取り専用の操作はTemporal経由せず、直接Activityを呼び出し
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Client, WorkflowIdReusePolicy } from '@temporalio/client';
import { router, publicProcedure } from './base';
import { auth0UserCreateInputSchema, auth0UserUpdateInputSchema } from '../activities/auth/auth0/types';

/**
 * EndUser Input Schemas for tRPC
 */
const endUserCreateInputSchema = z.object({
    auth0_data: auth0UserCreateInputSchema.optional(),
    platform_settings: z.record(z.unknown()).optional(),
});

const endUserUpdateInputSchema = z.object({
    auth0_updates: auth0UserUpdateInputSchema.optional(),
    platform_updates: z.record(z.unknown()).optional(),
});

const endUserLookupInputSchema = z.object({
    userId: z.string().optional(),
    auth0_user_id: z.string().optional(),
    platform_user_id: z.string().optional(),
    email: z.string().optional(),
});

/**
 * Temporal Client設定
 */
const createTemporalClient = (): Client => {
    return new Client({
        // TODO: 環境変数での設定
        // namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        // connection: {
        //     address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
        // },
    });
};

/**
 * Workflow実行の共通設定
 */
const defaultWorkflowOptions = {
    taskQueue: 'auth-workflows',
    workflowExecutionTimeout: '10m',
    workflowRunTimeout: '5m',
    workflowTaskTimeout: '30s',
};

/**
 * Temporal Error を tRPC Error にマッピング
 */
const mapTemporalError = (error: unknown, operation: string): TRPCError => {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Temporal特有のエラーを適切なHTTPステータスにマッピング
    if (message.includes('WorkflowExecutionAlreadyStarted')) {
        return new TRPCError({
            code: 'CONFLICT',
            message: `${operation} already in progress`,
        });
    }

    if (message.includes('timeout')) {
        return new TRPCError({
            code: 'TIMEOUT',
            message: `${operation} operation timed out`,
        });
    }

    return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `${operation} failed: ${message}`,
    });
};

/**
 * EndUser tRPC Router
 */
export const endUserRouter = router({
    /**
     * EndUser作成
     */
    create: publicProcedure
        .input(endUserCreateInputSchema)
        .mutation(async ({ input }) => {
            const client = createTemporalClient();

            try {
                const workflowId = crypto.randomUUID();
                const handle = await client.workflow.signalWithStart('createEndUserWorkflow', {
                    workflowId,
                    ...defaultWorkflowOptions,
                    args: [input],
                    signal: 'startCreation',
                    signalArgs: [],
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                const result = await handle.result();
                return {
                    success: true,
                    data: result,
                    workflowId,
                };

            } catch (error) {
                throw mapTemporalError(error, 'EndUser creation');
            }
        }),

    /**
     * EndUser更新
     */
    update: publicProcedure
        .input(z.object({
            userId: z.string(),
            updates: endUserUpdateInputSchema,
        }))
        .mutation(async ({ input }) => {
            const client = createTemporalClient();

            try {
                const workflowId = `user-${input.userId}`;

                const handle = await client.workflow.signalWithStart('updateEndUserWorkflow', {
                    workflowId,
                    ...defaultWorkflowOptions,
                    args: [{
                        auth0_user_id: input.userId,
                        auth0_updates: input.updates.auth0_updates,
                        platform_updates: input.updates.platform_updates,
                    }],
                    signal: 'startUpdate',
                    signalArgs: [],
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                const result = await handle.result();
                return {
                    success: true,
                    data: result,
                    workflowId,
                };

            } catch (error) {
                throw mapTemporalError(error, 'EndUser update');
            }
        }),

    /**
     * EndUser削除
     */
    delete: publicProcedure
        .input(z.object({
            userId: z.string(),
        }))
        .mutation(async ({ input }) => {
            const client = createTemporalClient();

            try {
                const workflowId = `user-${input.userId}`;

                const handle = await client.workflow.start('deleteEndUserWorkflow', {
                    workflowId,
                    ...defaultWorkflowOptions,
                    args: [{ auth0_user_id: input.userId }],
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                const result = await handle.result();
                return {
                    success: true,
                    data: result,
                    workflowId,
                };

            } catch (error) {
                throw mapTemporalError(error, 'EndUser deletion');
            }
        }),

    /**
     * EndUser取得 - 直接Activity呼び出し
     */
    get: publicProcedure
        .input(endUserLookupInputSchema)
        .query(async ({ input }) => {
            try {
                // TODO: Activityを直接呼び出すためのClientを実装
                // 現在はWorkflow経由だが、読み取り専用操作なのでActivityの直接呼び出しに変更予定
                const client = createTemporalClient();

                const identifier = input.auth0_user_id || input.platform_user_id || input.email || '';
                const workflowId = `user-get-${identifier}`;

                const handle = await client.workflow.start('getEndUserWorkflow', {
                    workflowId,
                    ...defaultWorkflowOptions,
                    args: [input],
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                const result = await handle.result();
                return {
                    success: true,
                    data: result,
                    workflowId,
                };

            } catch (error) {
                throw mapTemporalError(error, 'EndUser retrieval');
            }
        }),
});