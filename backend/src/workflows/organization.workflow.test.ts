/**
 * Organization Workflow テスト
 * 
 * Temporal Workflowのテストパターン:
 * 1. TestWorkflowEnvironment でテスト環境を作成
 * 2. Activity をモックして Workflow のロジックのみをテスト
 * 3. Worker.runUntil() で Workflow 完了まで待機
 * 4. 成功ケース・エラーケースを包括的にテスト
 * 
 * @see https://docs.temporal.io/develop/typescript/testing-suite
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { ApplicationFailure } from '@temporalio/common';
import { randomUUID } from 'crypto';
import type { Organization } from '../activities/db/schema';
import type { OrganizationCreateInput } from '../activities/db/models/organization';
import { OrganizationErrorType } from '../activities/db/models/organization';
import type { WorkosOrganization } from '../activities/auth/workos/types';

describe('Organization Workflows', () => {
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
            workflowsPath: require.resolve('./organization.ts'),
            activities: mockActivities,
            bundlerOptions: {

            },
        });
    };

    describe('createOrganizationWithWorkosWorkflow', () => {
        it('should create organization with WorkOS successfully', async () => {
            // テストデータの準備
            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Organization',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                    contact: {
                        email: 'contact@example.com',
                    },
                },
            };

            const mockDBOrg: Organization = {
                id: 'workos-org-123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // モックアクティビティの定義（vi.fn()を使用）
            const createWorkosOrganizationActivity = vi.fn().mockResolvedValue(mockWorkosOrg);
            const insertOrganization = vi.fn().mockResolvedValue(mockDBOrg);
            const deleteWorkosOrganizationActivity = vi.fn().mockResolvedValue(true);

            const worker = await createTestWorker({
                createWorkosOrganizationActivity,
                insertOrganization,
                deleteWorkosOrganizationActivity,
            });

            // Workflow実行
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [
                        {
                            name: 'Test Organization',
                            domains: ['example.com'],
                        },
                    ],
                })
            );

            // アサーション: 戻り値の検証
            expect(result).toBeDefined();
            expect(result.id).toBe('workos-org-123');

            // アサーション: モック関数が期待通りに呼ばれたか検証
            expect(createWorkosOrganizationActivity).toHaveBeenCalledTimes(1);
            expect(createWorkosOrganizationActivity).toHaveBeenCalledWith({
                name: 'Test Organization',
                domains: ['example.com'],
            });

            expect(insertOrganization).toHaveBeenCalledTimes(1);
            expect(insertOrganization).toHaveBeenCalledWith({
                id: 'workos-org-123',
            });

            // 補償処理は呼ばれない（成功時）
            expect(deleteWorkosOrganizationActivity).not.toHaveBeenCalled();
        });

        it('should compensate when DB creation fails after WorkOS creation', async () => {
            // テストデータの準備
            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Organization',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                metadata: {
                    contact: {
                        email: 'contact@example.com',
                    },
                },
            };

            // モックアクティビティの定義（vi.fn()を使用）
            // - WorkOS組織作成は成功
            // - DB組織作成は失敗（DATABASE_ERROR）
            // - 補償処理でWorkOS組織削除が呼ばれることを検証
            const createWorkosOrganizationActivity = vi.fn().mockResolvedValue(mockWorkosOrg);
            const insertOrganization = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Database error',
                    type: OrganizationErrorType.DATABASE_ERROR,
                    nonRetryable: false,
                })
            );
            const deleteWorkosOrganizationActivity = vi.fn().mockResolvedValue(true);

            const worker = await createTestWorker({
                createWorkosOrganizationActivity,
                insertOrganization,
                deleteWorkosOrganizationActivity,
            });

            // Workflow実行（エラーが期待される）
            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [
                            {
                                name: 'Test Organization',
                                email: 'test@example.com',
                                domains: ['example.com'],
                            },
                        ],
                    })
                )
            ).rejects.toThrow();

            // アサーション: モック関数が期待通りに呼ばれたか検証
            expect(createWorkosOrganizationActivity).toHaveBeenCalledTimes(1);
            expect(insertOrganization).toHaveBeenCalledTimes(3); // 3回リトライ

            // アサーション: 補償処理が実行されたことを確認
            expect(deleteWorkosOrganizationActivity).toHaveBeenCalledTimes(1);
            expect(deleteWorkosOrganizationActivity).toHaveBeenCalledWith('workos-org-123');
        });

        it('should create organization with admin user', async () => {
            // テストデータの準備
            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Organization',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                metadata: {
                    contact: {
                        email: 'contact@example.com',
                    },
                },
            };

            const mockDBOrg: Organization = {
                id: 'workos-org-123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockUser = {
                id: 'user-123',
                email: 'admin@example.com',
                firstName: 'Admin',
                lastName: 'User',
            };

            const mockMembership = {
                id: 'membership-123',
            };

            // モックアクティビティの定義（vi.fn()を使用）
            // - WorkOS組織作成成功
            // - DB組織作成成功
            // - 管理者ユーザー作成成功
            // - 組織メンバーシップ作成成功
            const createWorkosOrganizationActivity = vi.fn().mockResolvedValue(mockWorkosOrg);
            const insertOrganization = vi.fn().mockResolvedValue(mockDBOrg);
            const createWorkosUserActivity = vi.fn().mockResolvedValue(mockUser);
            const createWorkosOrganizationMembershipActivity = vi.fn().mockResolvedValue(mockMembership);
            const deleteWorkosOrganizationActivity = vi.fn().mockResolvedValue(true);

            const worker = await createTestWorker({
                createWorkosOrganizationActivity,
                insertOrganization,
                createWorkosUserActivity,
                createWorkosOrganizationMembershipActivity,
                deleteWorkosOrganizationActivity,
            });

            // Workflow実行（管理者ユーザー付き）
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [
                        {
                            name: 'Test Organization',
                            domains: ['example.com'],
                            adminUser: {
                                email: 'admin@example.com',
                                firstName: 'Admin',
                                lastName: 'User',
                            },
                        },
                    ],
                })
            );

            // アサーション: 戻り値の検証
            expect(result).toBeDefined();
            expect(result.id).toBe('workos-org-123');

            // アサーション: 各モック関数が期待通りに呼ばれたか検証
            expect(createWorkosOrganizationActivity).toHaveBeenCalledTimes(1);
            expect(insertOrganization).toHaveBeenCalledTimes(1);

            // 管理者ユーザー作成が呼ばれ、引数が正しいことを確認
            expect(createWorkosUserActivity).toHaveBeenCalledTimes(1);
            expect(createWorkosUserActivity).toHaveBeenCalledWith({
                email: 'admin@example.com',
                firstName: 'Admin',
                lastName: 'User',
                emailVerified: false,
            });

            // メンバーシップ作成が呼ばれ、引数が正しいことを確認
            expect(createWorkosOrganizationMembershipActivity).toHaveBeenCalledTimes(1);
            expect(createWorkosOrganizationMembershipActivity).toHaveBeenCalledWith({
                organizationId: 'workos-org-123',
                userId: 'user-123',
            });
        });

        it('should fail when WorkOS organization creation fails', async () => {
            // モックアクティビティの定義（vi.fn()を使用）
            // - WorkOS組織作成は失敗（INVALID_INPUTエラー）
            const createWorkosOrganizationActivity = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Invalid domain',
                    type: OrganizationErrorType.INVALID_INPUT,
                    nonRetryable: true,
                })
            );

            const worker = await createTestWorker({
                createWorkosOrganizationActivity,
            });

            // Workflow実行（エラーが期待される）
            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [
                            {
                                name: 'Test Organization',
                                domains: ['invalid'],
                            },
                        ],
                    })
                )
            ).rejects.toThrow();

            // アサーション: モック関数が呼ばれたか検証
            expect(createWorkosOrganizationActivity).toHaveBeenCalledTimes(1);
            expect(createWorkosOrganizationActivity).toHaveBeenCalledWith({
                name: 'Test Organization',
                domains: ['invalid'],
            });
        });


    })
});