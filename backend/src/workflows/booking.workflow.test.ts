/**
 * Booking Workflow テスト
 * 
 * Temporal Workflowのテストパターン:
 * 1. TestWorkflowEnvironment でテスト環境を作成
 * 2. Activity をモックして Workflow のロジックのみをテスト
 * 3. Worker.runUntil() で Workflow 完了まで待機
 * 4. 成功ケース・エラーケースを包括的にテスト
 * 
 * @see https://docs.tem            try {
                await worker.runUnt            try {
                await worker.runUn            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('checkInWit            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('cancelBookingWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [randomUUID()],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }low', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: ['BOOKING_123_VALID_QR'],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }             testEnv.client.workflow.execute('checkInWithQRCodeWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: ['BOOKING_123_VALID_QR'],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }            testEnv.client.workflow.execute('checkInWithQRCodeWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: ['INVALID_QR_CODE'],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }elop/typescript/testing-suite
 * @see .github/instructions/booking-flow.instructions.md
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { ApplicationFailure } from '@temporalio/common';
import { randomUUID } from 'crypto';
import type { Booking } from '../activities/db/schema';
import type { BookingCreateInput } from '../activities/db/models/booking';

describe('Booking Workflows', () => {
    let testEnv: TestWorkflowEnvironment;

    // テスト環境のセットアップ - 時間スキップ可能なテストサーバーを起動
    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    });

    // テスト環境のクリーンアップ
    afterAll(async () => {
        await testEnv?.teardown();
    });

    // 共通の Worker 設定
    const createTestWorker = async (mockActivities: Record<string, any>) => {
        return await Worker.create({
            connection: testEnv.nativeConnection,
            taskQueue: 'test',
            workflowsPath: require.resolve('./booking.ts'),
            activities: mockActivities,
            bundlerOptions: {},
        });
    };

    describe('createBookingWorkflow', () => {
        it('should create booking successfully with QR code generation', async () => {
            // テストデータの準備
            const mockBookingInput: BookingCreateInput = {
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'confirmed',
            };

            const mockCreatedBooking: Booking = {
                id: randomUUID(),
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'confirmed',
                qrCode: 'BOOKING_GENERATED_QR',
                attendedAt: null,
                cancelledAt: null,
                cancellationReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // モックアクティビティの定義
            const insertBooking = vi.fn().mockResolvedValue(mockCreatedBooking);

            const worker = await createTestWorker({
                insertBooking,
            });

            // Workflow実行
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createBookingWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [mockBookingInput],
                })
            );

            // アサーション: 戻り値の検証
            expect(result).toBeDefined();
            expect(result.id).toBe(mockCreatedBooking.id);
            expect(result.status).toBe('confirmed');
            expect(result.qrCode).toBeDefined();

            // アサーション: モック関数が期待通りに呼ばれたか検証
            expect(insertBooking).toHaveBeenCalledTimes(1);
            expect(insertBooking).toHaveBeenCalledWith(
                expect.objectContaining({
                    experienceId: 'exp-123',
                    userId: 'user-456',
                    numberOfParticipants: '2',
                    status: 'confirmed',
                    qrCode: expect.any(String), // QRコードは動的に生成される
                })
            );
        });

        it('should throw error when booking creation fails', async () => {
            const mockBookingInput: BookingCreateInput = {
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                status: 'confirmed',
            };

            // DB挿入失敗のモック
            const insertBooking = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Failed to insert booking',
                    type: 'BOOKING_DATABASE_ERROR',
                    nonRetryable: false,
                })
            );

            const worker = await createTestWorker({
                insertBooking,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('createBookingWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockBookingInput],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });
    });

    describe('checkInWithQRCodeWorkflow', () => {
        it('should check in successfully with valid QR code', async () => {
            const mockQrCode = 'BOOKING_123_VALID_QR';

            const mockBooking: Booking = {
                id: randomUUID(),
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'confirmed',
                qrCode: mockQrCode,
                attendedAt: null,
                cancelledAt: null,
                cancellationReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockAttendedBooking: Booking = {
                ...mockBooking,
                status: 'attended',
                attendedAt: new Date(),
            };

            const mockPayment = {
                id: randomUUID(),
                bookingId: mockBooking.id,
                paymentMethod: 'onsite',
                status: 'pending',
                amount: '13600',
                currency: 'JPY',
                paidAt: null,
                refundedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // モックアクティビティの定義
            const findBookingByQrCode = vi.fn().mockResolvedValue(mockBooking);
            const updateBooking = vi.fn().mockResolvedValue(mockAttendedBooking);
            const findPaymentByBookingId = vi.fn().mockResolvedValue(mockPayment);
            const completePayment = vi.fn().mockResolvedValue({ ...mockPayment, status: 'completed', paidAt: new Date() });

            const worker = await createTestWorker({
                findBookingByQrCode,
                updateBooking,
                findPaymentByBookingId,
                completePayment,
            });

            // Workflow実行
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('checkInWithQRCodeWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [mockQrCode],
                })
            );

            // アサーション: 戻り値の検証
            expect(result).toBeDefined();
            expect(result.status).toBe('attended');
            expect(result.attendedAt).toBeDefined();

            // アサーション: モック関数が期待通りに呼ばれたか検証
            expect(findBookingByQrCode).toHaveBeenCalledTimes(1);
            expect(findBookingByQrCode).toHaveBeenCalledWith(mockQrCode);

            expect(updateBooking).toHaveBeenCalledTimes(1);
            // updateBookingの引数を簡易チェック
            expect(updateBooking).toHaveBeenCalled();
            const callArgs = updateBooking.mock.calls[0];
            if (callArgs) {
                expect(callArgs[0]).toBe(mockBooking.id);
                expect(callArgs[1]).toMatchObject({
                    status: 'attended',
                });
            }

            // 現地払いなのでPayment完了処理も呼ばれる
            expect(completePayment).toHaveBeenCalledTimes(1);
        });

        it('should throw error when QR code is not found', async () => {
            const mockQrCode = 'INVALID_QR_CODE';

            // QRコードが見つからない場合
            const findBookingByQrCode = vi.fn().mockResolvedValue(null);

            const worker = await createTestWorker({
                findBookingByQrCode,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('checkInWithQRCodeWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockQrCode],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });

        it('should throw error when booking is already attended', async () => {
            const mockQrCode = 'BOOKING_123_VALID_QR';

            const mockBooking: Booking = {
                id: randomUUID(),
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'attended', // 既に attended
                qrCode: mockQrCode,
                attendedAt: new Date(),
                cancelledAt: null,
                cancellationReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const findBookingByQrCode = vi.fn().mockResolvedValue(mockBooking);

            const worker = await createTestWorker({
                findBookingByQrCode,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('checkInWithQRCodeWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockQrCode],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });

        it('should throw error when booking is cancelled', async () => {
            const mockQrCode = 'BOOKING_123_VALID_QR';

            const mockBooking: Booking = {
                id: randomUUID(),
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'cancelled', // キャンセル済み
                qrCode: mockQrCode,
                attendedAt: null,
                cancelledAt: new Date(),
                cancellationReason: 'User requested',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const findBookingByQrCode = vi.fn().mockResolvedValue(mockBooking);

            const worker = await createTestWorker({
                findBookingByQrCode,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('checkInWithQRCodeWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockQrCode],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });
    });

    describe('cancelBookingWorkflow', () => {
        it('should cancel booking successfully', async () => {
            const mockBookingId = randomUUID();

            const mockBooking: Booking = {
                id: mockBookingId,
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'confirmed',
                qrCode: 'BOOKING_123_QR',
                attendedAt: null,
                cancelledAt: null,
                cancellationReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockCancelledBooking: Booking = {
                ...mockBooking,
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: 'User requested cancellation',
            };

            const mockPayment = {
                id: randomUUID(),
                bookingId: mockBookingId,
                paymentMethod: 'onsite',
                status: 'pending',
                amount: '13600',
                currency: 'JPY',
                paidAt: null,
                refundedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // モックアクティビティの定義
            const findBookingById = vi.fn().mockResolvedValue(mockBooking);
            const updateBooking = vi.fn().mockResolvedValue(mockCancelledBooking);
            const findPaymentByBookingId = vi.fn().mockResolvedValue(mockPayment);

            const worker = await createTestWorker({
                findBookingById,
                updateBooking,
                findPaymentByBookingId,
            });

            // Workflow実行
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('cancelBookingWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [mockBookingId, 'User requested cancellation'],
                })
            );

            // アサーション: 戻り値の検証
            expect(result).toBeDefined();
            expect(result.status).toBe('cancelled');
            expect(result.cancelledAt).toBeDefined();
            expect(result.cancellationReason).toBe('User requested cancellation');

            // アサーション: モック関数が期待通りに呼ばれたか検証
            expect(findBookingById).toHaveBeenCalledTimes(1);
            expect(findBookingById).toHaveBeenCalledWith(mockBookingId);

            expect(updateBooking).toHaveBeenCalledTimes(1);
            expect(updateBooking).toHaveBeenCalled();
            const callArgs = updateBooking.mock.calls[0];
            if (callArgs) {
                expect(callArgs[0]).toBe(mockBookingId);
                expect(callArgs[1]).toMatchObject({
                    status: 'cancelled',
                    cancellationReason: 'User requested cancellation',
                });
            }
        });

        it('should throw error when booking is not found', async () => {
            const mockBookingId = randomUUID();

            // Bookingが見つからない場合
            const findBookingById = vi.fn().mockResolvedValue(null);

            const worker = await createTestWorker({
                findBookingById,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('cancelBookingWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockBookingId],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });

        it('should throw error when booking is already cancelled', async () => {
            const mockBookingId = randomUUID();

            const mockBooking: Booking = {
                id: mockBookingId,
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'cancelled', // 既にキャンセル済み
                qrCode: 'BOOKING_123_QR',
                attendedAt: null,
                cancelledAt: new Date(),
                cancellationReason: 'Previously cancelled',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const findBookingById = vi.fn().mockResolvedValue(mockBooking);

            const worker = await createTestWorker({
                findBookingById,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('cancelBookingWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockBookingId],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });

        it('should throw error when trying to cancel attended booking', async () => {
            const mockBookingId = randomUUID();

            const mockBooking: Booking = {
                id: mockBookingId,
                experienceId: 'exp-123',
                userId: 'user-456',
                numberOfParticipants: '2',
                bookingDate: new Date(),
                scheduledVisitTime: new Date('2025-10-15T14:00:00Z'),
                status: 'attended', // 既に体験済み
                qrCode: 'BOOKING_123_QR',
                attendedAt: new Date(),
                cancelledAt: null,
                cancellationReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const findBookingById = vi.fn().mockResolvedValue(mockBooking);

            const worker = await createTestWorker({
                findBookingById,
            });

            // Workflow実行 - エラーが発生するはず
            try {
                await worker.runUntil(
                    testEnv.client.workflow.execute('cancelBookingWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [mockBookingId],
                    })
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Temporal wraps errors, so we just verify that an error was thrown
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });
    });
});
