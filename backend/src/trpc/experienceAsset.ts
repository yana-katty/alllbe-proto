/**
 * ExperienceAsset tRPC Router
 * 
 * Read操作: Actionsを直接呼び出し
 * CUD操作: Temporal Workflowを使用
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ApplicationFailure, WorkflowIdReusePolicy } from '@temporalio/common';
import { getDatabase } from '../activities/db/connection';
import {
    createExperienceAssetActions,
} from '../actions/experienceAsset';
import {
    insertExperienceAsset,
    findExperienceAssetById,
    listExperienceAssets,
    listExperienceAssetsByExperience,
    updateExperienceAsset,
    removeExperienceAsset,
    experienceAssetCreateSchema,
    experienceAssetUpdateSchema,
    experienceAssetQuerySchema,
} from '../activities/db/models/experienceAssets';
import {
    createExperienceAssetWorkflow,
    updateExperienceAssetWorkflow,
    deleteExperienceAssetWorkflow,
} from '../workflows/experienceAsset';

// DB接続を取得
const db = getDatabase();

// Actions を生成（依存注入）
const assetActions = createExperienceAssetActions({
    insertExperienceAssetActivity: insertExperienceAsset(db),
    findExperienceAssetByIdActivity: findExperienceAssetById(db),
    listExperienceAssetsActivity: listExperienceAssets(db),
    listExperienceAssetsByExperienceActivity: listExperienceAssetsByExperience(db),
    updateExperienceAssetActivity: updateExperienceAsset(db),
    removeExperienceAssetActivity: removeExperienceAsset(db),
});

export const experienceAssetRouter = router({
    /**
     * ExperienceAsset取得 (ID指定)
     */
    getById: publicProcedure
        .input(z.string().uuid())
        .query(async ({ input }) => {
            try {
                return await assetActions.getExperienceAssetById(input);
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }
                throw error;
            }
        }),

    /**
     * ExperienceAsset一覧取得（検索条件付き）
     */
    list: publicProcedure
        .input(experienceAssetQuerySchema)
        .query(async ({ input }) => {
            try {
                return await assetActions.listExperienceAssets(input);
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }
                throw error;
            }
        }),

    /**
     * Experience配下のExperienceAsset一覧取得
     */
    listByExperience: publicProcedure
        .input(z.object({
            experienceId: z.string().uuid(),
            contentTiming: z.enum(['before', 'after', 'anytime']).optional(),
            category: z.enum(['story', 'making', 'guide', 'column', 'interview', 'other']).optional(),
            accessLevel: z.enum(['public', 'ticket_holder', 'attended']).optional(),
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
        }))
        .query(async ({ input }) => {
            try {
                const { experienceId, ...params } = input;
                return await assetActions.listExperienceAssetsByExperience(experienceId, params);
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }
                throw error;
            }
        }),

    /**
     * ExperienceAsset作成
     */
    create: publicProcedure
        .input(experienceAssetCreateSchema)
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `experience-asset-create-${input.experienceId}`;

                const handle = await ctx.temporal.workflow.start(createExperienceAssetWorkflow, {
                    args: [input],
                    taskQueue: 'main',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                return await handle.result();
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }
                throw error;
            }
        }),

    /**
     * ExperienceAsset更新
     */
    update: publicProcedure
        .input(z.object({
            id: z.string().uuid(),
            data: experienceAssetUpdateSchema,
        }))
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `experience-asset-update-${input.id}`;

                const handle = await ctx.temporal.workflow.start(updateExperienceAssetWorkflow, {
                    args: [input.id, input.data],
                    taskQueue: 'main',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                return await handle.result();
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }
                throw error;
            }
        }),

    /**
     * ExperienceAsset削除
     */
    delete: publicProcedure
        .input(z.string().uuid())
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `experience-asset-delete-${input}`;

                const handle = await ctx.temporal.workflow.start(deleteExperienceAssetWorkflow, {
                    args: [input],
                    taskQueue: 'main',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                return await handle.result();
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }
                throw error;
            }
        }),
});
