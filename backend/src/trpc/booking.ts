/**
 * Booking tRPC Router
 * 
 * Read操作: Booking Actions を使用（DB操作 + ビジネスロジック）
 * CUD操作: Temporal Workflow Client を使用
 * 
 * @see .github/instructions/booking-flow.instructions.md
 */

import { router, publicProcedure, mapTemporalErrorToTRPC } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Connection, Client, WorkflowIdReusePolicy } from '@temporalio/client';
import { ApplicationFailure } from '@temporalio/common';
import {
    createBookingWorkflow,
    checkInWithQRCodeWorkflow,
    cancelBookingWorkflow,
} from '../workflows/booking';
import {
    bookingCreateSchema,
    bookingUpdateSchema,
    bookingIdSchema,
    bookingQuerySchema,
} from '../activities/db/models/booking';
import {
    getBookingById,
    listBookingsByUserAction,
    listBookingsByExperienceAction,
    listAttendedBookingsByUserAction,
    hasUserAttendedExperienceAction,
} from '../actions/booking';
import { getDatabase } from '../activities/db/connection';
import {
    findBookingById,
    listBookingsByUser,
    listBookingsByExperience,
    listAttendedBookingsByUser,
    hasUserAttendedExperience,
} from '../activities/db/models/booking';

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

// Booking Actions の依存関数（シングルトン）
const db = getDatabase();
const bookingActionDeps = {
    findBookingById: findBookingById(db),
    listBookingsByUser: listBookingsByUser(db),
    listBookingsByExperience: listBookingsByExperience(db),
    listAttendedBookingsByUser: listAttendedBookingsByUser(db),
    hasUserAttendedExperience: hasUserAttendedExperience(db),
};

export const bookingRouter = router({
    // ============================================
    // Read Operations (Query) - Booking Actions 使用
    // ============================================

    /**
     * ID指定でBookingを取得
     */
    getById: publicProcedure
        .input(z.string().uuid())
        .query(async ({ input }) => {
            try {
                const booking = await getBookingById({ findBookingById: bookingActionDeps.findBookingById })(input);
                if (!booking) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Booking not found: ${input}`,
                    });
                }
                return booking;
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
                    message: error instanceof Error ? error.message : 'Failed to get booking',
                    cause: error,
                });
            }
        }),

    /**
     * ユーザーのBooking一覧を取得
     */
    listMine: publicProcedure
        .input(z.object({
            userId: z.string().uuid(),
            status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).optional(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
            try {
                const { userId, ...params } = input;
                const bookings = await listBookingsByUserAction({
                    listBookingsByUser: bookingActionDeps.listBookingsByUser
                })(userId, params);
                return bookings;
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
                    message: error instanceof Error ? error.message : 'Failed to list bookings',
                    cause: error,
                });
            }
        }),

    /**
     * ExperienceのBooking一覧を取得
     */
    listByExperience: publicProcedure
        .input(z.object({
            experienceId: z.string().uuid(),
            status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).optional(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
            try {
                const { experienceId, ...params } = input;
                const bookings = await listBookingsByExperienceAction({
                    listBookingsByExperience: bookingActionDeps.listBookingsByExperience
                })(experienceId, params);
                return bookings;
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
                    message: error instanceof Error ? error.message : 'Failed to list bookings by experience',
                    cause: error,
                });
            }
        }),

    /**
     * ユーザーの体験済みBooking一覧を取得
     */
    listAttended: publicProcedure
        .input(z.object({
            userId: z.string().uuid(),
        }))
        .query(async ({ input }) => {
            try {
                const bookings = await listAttendedBookingsByUserAction({
                    listAttendedBookingsByUser: bookingActionDeps.listAttendedBookingsByUser
                })(input.userId);
                return bookings;
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
                    message: error instanceof Error ? error.message : 'Failed to list attended bookings',
                    cause: error,
                });
            }
        }),

    /**
     * ユーザーが特定のExperienceを体験済みかチェック
     */
    hasAttended: publicProcedure
        .input(z.object({
            userId: z.string().uuid(),
            experienceId: z.string().uuid(),
        }))
        .query(async ({ input }) => {
            try {
                const hasAttended = await hasUserAttendedExperienceAction({
                    hasUserAttendedExperience: bookingActionDeps.hasUserAttendedExperience
                })(input.userId, input.experienceId);
                return { hasAttended };
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
                    message: error instanceof Error ? error.message : 'Failed to check attendance',
                    cause: error,
                });
            }
        }),

    // ============================================
    // Write Operations (Mutation) - Temporal Workflow 使用
    // ============================================

    /**
     * Bookingを作成
     */
    create: publicProcedure
        .input(bookingCreateSchema)
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `booking-create-${input.userId}-${Date.now()}`;

                const booking = await client.workflow.execute(createBookingWorkflow, {
                    args: [input],
                    taskQueue: 'default',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE,
                    workflowExecutionTimeout: '5m',
                });

                return booking;
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
                    message: error instanceof Error ? error.message : 'Failed to create booking',
                    cause: error,
                });
            }
        }),

    /**
     * QRコードでチェックイン
     */
    checkIn: publicProcedure
        .input(z.object({ qrCode: z.string() }))
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `booking-checkin-${input.qrCode}-${Date.now()}`;

                const booking = await client.workflow.execute(checkInWithQRCodeWorkflow, {
                    args: [input.qrCode],
                    taskQueue: 'default',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE,
                    workflowExecutionTimeout: '2m',
                });

                return booking;
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
                    message: error instanceof Error ? error.message : 'Failed to check in',
                    cause: error,
                });
            }
        }),

    /**
     * Bookingをキャンセル
     */
    cancel: publicProcedure
        .input(z.object({
            bookingId: z.string().uuid(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `booking-cancel-${input.bookingId}-${Date.now()}`;

                const booking = await client.workflow.execute(cancelBookingWorkflow, {
                    args: [input.bookingId, input.reason],
                    taskQueue: 'default',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE,
                    workflowExecutionTimeout: '2m',
                });

                return booking;
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
                    message: error instanceof Error ? error.message : 'Failed to cancel booking',
                    cause: error,
                });
            }
        }),
});
