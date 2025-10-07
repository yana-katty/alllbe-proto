/**
 * Organization tRPC Router
 * 
 * Read操作: Organization Actions を使用（DB + WorkOS 統合データ）
 * CUD操作: Temporal Workflow Client を使用
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { WorkflowIdReusePolicy } from '@temporalio/client';
import { ApplicationFailure } from '@temporalio/common';
import {
    createOrganizationWithWorkosWorkflow,
    deleteOrganizationWithWorkosWorkflow,
} from '../workflows/organization';
import { organizationCreateSchema, organizationUpdateSchema, organizationQuerySchema } from '../activities/db/models/organization';
import { findOrganizationByWorkosName } from '../actions/organization';
import { listOrganizations as listOrganizationsActivity } from '../activities/db/models/organization';
import { getWorkosOrganization } from '../activities/auth/workos/organization';
import { getDatabase } from '../activities/db/connection';
import { getWorkosConfigFromEnv, createWorkosClient } from '../activities/auth/workos/workosClient';

// DB と WorkOS Client の取得
const db = getDatabase();
const workosConfig = getWorkosConfigFromEnv();
const workosClient = createWorkosClient(workosConfig);

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
     * WorkOS 名前で Organization を検索 (WorkOSデータ統合)
     */
    findByWorkosName: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            try {
                const action = findOrganizationByWorkosName({
                    listOrganizationsActivity: listOrganizationsActivity(db),
                    getWorkosOrganizationActivity: getWorkosOrganization(workosClient),
                });
                const org = await action(input);
                return org; // null または OrganizationWithWorkos
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to find organization by WorkOS name',
                    cause: error,
                });
            }
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
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `organization-workos-create-${input.name}`;

                const handle = await ctx.temporal.workflow.start(createOrganizationWithWorkosWorkflow, {
                    args: [input],
                    taskQueue: 'main',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
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

    /**
     * WorkOS Organization + DB Organization を削除（CASCADE削除）
     * 
     * ApplicationFailure のエラーハンドリング例:
     * - WorkOS Organization 削除失敗
     * - DB Organization 削除失敗
     * - 関連リソース削除失敗
     */
    deleteWithWorkos: publicProcedure
        .input(z.string().min(1, 'Organization ID is required'))
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `organization-workos-delete-${input}-${Date.now()}`;

                const handle = await ctx.temporal.workflow.start(deleteOrganizationWithWorkosWorkflow, {
                    args: [input],
                    taskQueue: 'main',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
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
                    message: error instanceof Error ? error.message : 'Failed to delete organization with WorkOS',
                    cause: error,
                });
            }
        }),
});
