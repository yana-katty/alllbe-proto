/**
 * Experience tRPC Router
 * 
 * Read操作: Actionsを直接呼び出し
 * CUD操作: Temporal Workflowを使用
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ApplicationFailure } from '@temporalio/common';
import { WorkflowIdReusePolicy } from '@temporalio/client';
import { getDatabase } from '../activities/db/connection';
import {
    createExperienceWorkflow,
    updateExperienceWorkflow,
    publishExperienceWorkflow,
    endExperienceWorkflow,
    archiveExperienceWorkflow,
    deleteExperienceWorkflow,
} from '../workflows/experience';
import {
    createExperienceActions,
} from '../actions/experience';
import {
    insertExperience,
    findExperienceById,
    listExperiences,
    listExperiencesByBrand,
    updateExperience,
    removeExperience,
    experienceCreateSchema,
    experienceUpdateSchema,
    experienceQuerySchema,
} from '../activities/db/models/experience';

// DB接続を取得
const db = getDatabase();

// Actions を生成（依存注入）
const experienceActions = createExperienceActions({
    insertExperienceActivity: insertExperience(db),
    findExperienceByIdActivity: findExperienceById(db),
    listExperiencesActivity: listExperiences(db),
    listExperiencesByBrandActivity: listExperiencesByBrand(db),
    updateExperienceActivity: updateExperience(db),
    removeExperienceActivity: removeExperience(db),
});

export const experienceRouter = router({
    getById: publicProcedure
        .input(z.string().uuid())
        .query(async ({ input }) => {
            try {
                return await experienceActions.getExperienceById(input);
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
                    message: error instanceof Error ? error.message : 'Failed to get experience',
                    cause: error,
                });
            }
        }),

    list: publicProcedure
        .input(experienceQuerySchema)
        .query(async ({ input }) => {
            try {
                return await experienceActions.list(input);
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
                    message: error instanceof Error ? error.message : 'Failed to list experiences',
                    cause: error,
                });
            }
        }),

    listByBrand: publicProcedure
        .input(z.object({
            brandId: z.string().uuid(),
            status: z.enum(['draft', 'published', 'ended', 'archived']).optional(),
            experienceType: z.enum(['scheduled', 'period', 'flexible']).optional(),
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
        }))
        .query(async ({ input }) => {
            try {
                const { brandId, ...params } = input;
                return await experienceActions.listExperiencesByBrand(brandId, params);
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
                    message: error instanceof Error ? error.message : 'Failed to list experiences',
                    cause: error,
                });
            }
        }),

    create: publicProcedure
        .input(experienceCreateSchema)
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `exp-create-${input.brandId}`;
                const handle = await ctx.temporal.workflow.start(createExperienceWorkflow, {
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
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create experience',
                    cause: error,
                });
            }
        }),

    update: publicProcedure
        .input(z.object({ id: z.string().uuid(), data: experienceUpdateSchema }))
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `exp-update-${input.id}`;
                const handle = await ctx.temporal.workflow.start(updateExperienceWorkflow, {
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
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to update experience',
                    cause: error,
                });
            }
        }),

    publish: publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `exp-publish-${input.id}`;
                const handle = await ctx.temporal.workflow.start(publishExperienceWorkflow, {
                    args: [input.id],
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
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to publish experience',
                    cause: error,
                });
            }
        }),

    delete: publicProcedure
        .input(z.string().uuid())
        .mutation(async ({ input, ctx }) => {
            try {
                const workflowId = `exp-delete-${input}`;
                const handle = await ctx.temporal.workflow.start(deleteExperienceWorkflow, {
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
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to delete experience',
                    cause: error,
                });
            }
        }),
});
