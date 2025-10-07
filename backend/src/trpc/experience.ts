/**
 * Experience tRPC Router
 * 
 * Read操作: Actionsを直接呼び出し
 * CUD操作: Workflowを使用（将来実装予定）
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ApplicationFailure } from '@temporalio/common';
import { getDatabase } from '../activities/db/connection';
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
    /**
     * Experience取得 (ID指定)
     */
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
                throw error;
            }
        }),

    /**
     * Experience一覧取得（検索条件付き）
     */
    list: publicProcedure
        .input(experienceQuerySchema)
        .query(async ({ input }) => {
            try {
                return await experienceActions.listExperiences(input);
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
     * Brand配下のExperience一覧取得
     */
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
                throw error;
            }
        }),

    /**
     * Experience作成
     */
    create: publicProcedure
        .input(experienceCreateSchema)
        .mutation(async ({ input }) => {
            try {
                return await experienceActions.createExperience(input);
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
     * Experience更新
     */
    update: publicProcedure
        .input(z.object({
            id: z.string().uuid(),
            data: experienceUpdateSchema,
        }))
        .mutation(async ({ input }) => {
            try {
                return await experienceActions.updateExperience(input.id, input.data);
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
     * Experience削除
     */
    delete: publicProcedure
        .input(z.string().uuid())
        .mutation(async ({ input }) => {
            try {
                return await experienceActions.deleteExperience(input);
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
