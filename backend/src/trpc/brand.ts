/**
 * Brand tRPC Router
 * 
 * Read操作: Brand Actions を使用（DB操作 + ビジネスロジック）
 * CUD操作: Temporal Workflow Client を使用
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { WorkflowIdReusePolicy } from '@temporalio/client';
import { ApplicationFailure } from '@temporalio/common';
import {
    createBrandWorkflow,
    updateBrandWorkflow,
    deleteBrandWorkflow,
} from '../workflows/brand';
import { brandCreateSchema, brandUpdateSchema } from '../activities/db/models/brand';
import { createBrandActions } from '../actions/brand';
import { getDatabase } from '../activities/db/connection';
import {
    insertBrand,
    findBrandById,
    findBrandsByOrganizationId,
    findDefaultBrandByOrganizationId,
    updateBrand,
    deleteBrand,
    countBrandsByOrganizationId,
} from '../activities/db/models/brand';

// Brand Actions インスタンス（シングルトン）
const db = getDatabase();
const brandActions = createBrandActions({
    insertBrandActivity: insertBrand(db),
    findBrandByIdActivity: findBrandById(db),
    findBrandsByOrganizationIdActivity: findBrandsByOrganizationId(db),
    findDefaultBrandByOrganizationIdActivity: findDefaultBrandByOrganizationId(db),
    updateBrandActivity: updateBrand(db),
    deleteBrandActivity: deleteBrand(db),
    countBrandsByOrganizationIdActivity: countBrandsByOrganizationId(db),
});

export const brandRouter = router({
    // ============================================
    // Read Operations (Query) - Brand Actions 使用
    // ============================================

    /**
     * Organization配下のBrand一覧を取得
     */
    list: publicProcedure
        .input(z.object({
            organizationId: z.string(),
            isActive: z.boolean().optional(),
        }))
        .query(async ({ input }) => {
            try {
                const brands = await brandActions.listBrandsByOrganization(input);
                return brands;
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
                    message: error instanceof Error ? error.message : 'Failed to list brands',
                    cause: error,
                });
            }
        }),

    /**
     * ID指定でBrandを取得
     */
    getById: publicProcedure
        .input(z.string().uuid())
        .query(async ({ input }) => {
            try {
                const brand = await brandActions.getBrandById(input);
                if (!brand) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Brand not found: ${input}`,
                    });
                }
                return brand;
            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get brand',
                    cause: error,
                });
            }
        }),

    /**
     * OrganizationのデフォルトBrandを取得（Standard プラン用）
     */
    getDefault: publicProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ input }) => {
            try {
                const brand = await brandActions.getDefaultBrand(input.organizationId);
                if (!brand) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Default brand not found for organization: ${input.organizationId}`,
                    });
                }
                return brand;
            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }
                if (error instanceof ApplicationFailure) {
                    throw new TRPCError({
                        code: mapTemporalErrorToTRPC(error.type ?? undefined),
                        message: error.message,
                        cause: error,
                    });
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get default brand',
                    cause: error,
                });
            }
        }),

    // ============================================
    // CUD Operations (Mutation via Workflow)
    // ============================================

    /**
     * Brandを作成（Enterprise プラン限定）
     * 
     * ApplicationFailure のエラーハンドリング例:
     * - BRAND_LIMIT_REACHED: プラン制限超過（Standard: 1, Enterprise: 100）
     * - BRAND_ALREADY_EXISTS: 同名Brandが既に存在
     * - BRAND_DATABASE_ERROR: DB操作エラー
     */
    create: publicProcedure
        .input(brandCreateSchema.extend({
            planType: z.enum(['standard', 'enterprise']),
        }))
        .mutation(async ({ input, ctx }) => {
            try {
                // Use ctx.temporal instead
                const workflowId = `brand-create-${input.organizationId}`;

                const handle = await ctx.temporal.workflow.start(createBrandWorkflow, {
                    args: [input],
                    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
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
                    message: error instanceof Error ? error.message : 'Failed to create brand',
                    cause: error,
                });
            }
        }),

    /**
     * Brandを更新
     * 
     * ApplicationFailure のエラーハンドリング例:
     * - BRAND_NOT_FOUND: Brandが存在しない
     * - BRAND_DATABASE_ERROR: DB操作エラー
     */
    update: publicProcedure
        .input(z.object({
            id: z.string().uuid(),
            data: brandUpdateSchema,
        }))
        .mutation(async ({ input, ctx }) => {
            try {
                // Use ctx.temporal instead
                const workflowId = `brand-update-${input.id}`;

                const handle = await ctx.temporal.workflow.start(updateBrandWorkflow, {
                    args: [input.id, input.data],
                    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
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
                    message: error instanceof Error ? error.message : 'Failed to update brand',
                    cause: error,
                });
            }
        }),

    /**
     * Brandを削除（Enterprise プラン限定、依存関係チェック）
     * 
     * ApplicationFailure のエラーハンドリング例:
     * - BRAND_NOT_FOUND: Brandが存在しない
     * - BRAND_HAS_DEPENDENCIES: Experience等が存在するため削除不可
     * - BRAND_IS_DEFAULT: デフォルトBrandのため削除不可
     * - BRAND_DATABASE_ERROR: DB操作エラー
     */
    delete: publicProcedure
        .input(z.string().uuid())
        .mutation(async ({ input, ctx }) => {
            try {
                // Use ctx.temporal instead
                const workflowId = `brand-delete-${input}`;

                const handle = await ctx.temporal.workflow.start(deleteBrandWorkflow, {
                    args: [input],
                    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
                });

                await handle.result();
                return { success: true };
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
                    message: error instanceof Error ? error.message : 'Failed to delete brand',
                    cause: error,
                });
            }
        }),
});
