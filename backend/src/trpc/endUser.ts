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
import { ApplicationFailure } from '@temporalio/common';
import { router, publicProcedure } from './base';
import { auth0UserCreateInputSchema, auth0UserUpdateInputSchema } from '../activities/auth/auth0/types';
import { getEndUser } from '../actions/endUser';
import { getAuth0User, findAuth0UserByEmail } from '../activities/auth/auth0/user';
import { findUserById } from '../activities/db/models/user';
import { getDatabase } from '../activities/db/connection';
import { getAuth0ConfigFromEnv, createAuth0ManagementClient } from '../activities/auth/auth0/auth0Client';

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

    // ApplicationFailure の場合、詳細情報を含める
    if (error instanceof ApplicationFailure) {
        const errorType = error.type || 'UNKNOWN';
        const errorMessage = error.message || 'No message provided';

        // AUTH0_EMAIL_ALREADY_EXISTS などの特定エラータイプを判定
        if (errorType.includes('ALREADY_EXISTS')) {
            return new TRPCError({
                code: 'CONFLICT',
                message: `${operation} failed: ${errorMessage} (${errorType})`,
                cause: error,
            });
        }

        if (errorType.includes('NOT_FOUND')) {
            return new TRPCError({
                code: 'NOT_FOUND',
                message: `${operation} failed: ${errorMessage} (${errorType})`,
                cause: error,
            });
        }

        // その他の ApplicationFailure
        return new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `${operation} failed: ${errorMessage} (${errorType})`,
            cause: error,
        });
    }

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
        .mutation(async ({ input, ctx }) => {
            try {
                const email = input.auth0_data?.email || crypto.randomUUID();
                const workflowId = `enduser-create-${email}`;

                const handle = await ctx.temporal.workflow.start('createEndUserWorkflow', {
                    workflowId,
                    taskQueue: 'main',
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
                // エラー詳細をログ出力
                console.error('EndUser creation error details:', {
                    error,
                    message: error instanceof Error ? error.message : 'Unknown',
                    type: error instanceof ApplicationFailure ? error.type : 'Not ApplicationFailure',
                    cause: error instanceof Error ? error.cause : undefined,
                });
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
        .mutation(async ({ input, ctx }) => {
            // Use ctx.temporal instead

            try {
                const workflowId = `user-${input.userId}`;

                const handle = await ctx.temporal.workflow.signalWithStart('updateEndUserWorkflow', {
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
        .mutation(async ({ input, ctx }) => {
            // Use ctx.temporal instead

            try {
                const workflowId = `user-${input.userId}`;

                const handle = await ctx.temporal.workflow.start('deleteEndUserWorkflow', {
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
     * EndUser取得 - Actions層で直接実装
     */
    get: publicProcedure
        .input(endUserLookupInputSchema)
        .query(async ({ input }) => {
            try {
                // Auth0 Client と DB を準備
                const auth0Config = getAuth0ConfigFromEnv();
                const auth0Client = createAuth0ManagementClient(auth0Config);
                const db = getDatabase();

                // Actions層の getEndUser を呼び出し（email 検索対応）
                const action = getEndUser({
                    getAuth0UserActivity: getAuth0User(auth0Client),
                    findUserById: findUserById(db),
                    findAuth0UserByEmail: findAuth0UserByEmail(auth0Client),
                });

                const result = await action(input);

                if (!result) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'EndUser not found',
                    });
                }

                return {
                    success: true,
                    data: result,
                };

            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }

                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `EndUser retrieval failed: ${message}`,
                });
            }
        }),
});