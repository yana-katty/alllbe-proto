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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { randomUUID } from 'crypto';
import type { Organization } from '../activities/db/schema';
import type {
    OrganizationCreateInput,
    OrganizationUpdateInput,
    OrganizationError,
} from '../activities/db/models/organization';
import { OrganizationErrorCode } from '../activities/db/models/organization';
import type { WorkosOrganization } from '../activities/auth/workos/types';

/**
 * テスト用の Activity モック型定義
 * 
 * Temporal Activity は neverthrow の Result 型のような形式を返す
 */
type ActivityResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: OrganizationError };

/**
 * モック Activity の型定義
 */
interface MockActivities {
    createOrganizationActivity?: (input: OrganizationCreateInput) => Promise<ActivityResult<Organization>>;
    updateOrganizationActivity?: (id: string, patch: OrganizationUpdateInput) => Promise<ActivityResult<Organization | null>>;
    deleteOrganizationActivity?: (id: string) => Promise<ActivityResult<boolean>>;
    getOrganizationByIdActivity?: (id: string) => Promise<ActivityResult<Organization | null>>;
    getOrganizationByEmailActivity?: (email: string) => Promise<ActivityResult<Organization | null>>;
    listOrganizationsActivity?: (params: any) => Promise<ActivityResult<Organization[]>>;
    // WorkOS Activities
    createWorkosOrganizationActivity?: (input: any) => Promise<ActivityResult<WorkosOrganization>>;
    deleteWorkosOrganizationActivity?: (id: string) => Promise<ActivityResult<boolean>>;
    createWorkosUserActivity?: (input: any) => Promise<ActivityResult<any>>;
    createWorkosOrganizationMembershipActivity?: (input: any) => Promise<ActivityResult<any>>;
}

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
    const createTestWorker = async (mockActivities: MockActivities) => {
        return await Worker.create({
            connection: testEnv.nativeConnection,
            taskQueue: 'test',
            workflowsPath: require.resolve('./organization.ts'),
            activities: mockActivities,
            bundlerOptions: {
                // Drizzle ORM が使用するモジュールを無視（Workflow では実際に使われない）
                // ignoreModules: ['fs', 'path', 'os', 'crypto'],
            },
        });
    };

    describe('createOrganizationWorkflow', () => {
        it('should create organization successfully', async () => {
            // モック Activity の作成 - 成功ケース
            const mockActivities: MockActivities = {
                createOrganizationActivity: async (input: OrganizationCreateInput) => {
                    return {
                        ok: true,
                        value: {
                            id: randomUUID(),
                            name: input.name,
                            email: input.email,
                            description: input.description || null,
                            phone: input.phone || null,
                            website: input.website || null,
                            address: input.address || null,
                            workosOrganizationId: null,
                            isActive: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    };
                },
            };

            // Worker の作成 - モック Activity を注入
            const worker = await createTestWorker(mockActivities);

            // Workflow の実行
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createOrganizationWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [
                        {
                            name: 'Test Organization',
                            email: 'test@example.com',
                            description: 'Test Description',
                        },
                    ],
                })
            );

            // アサーション
            expect(result).toBeDefined();
            expect(result.name).toBe('Test Organization');
            expect(result.email).toBe('test@example.com');
            expect(result.description).toBe('Test Description');
            expect(result.isActive).toBe(true);
        });

        it('should fail when organization creation fails', async () => {
            // モック Activity の作成 - エラーケース
            const mockActivities: MockActivities = {
                createOrganizationActivity: async () => {
                    return {
                        ok: false,
                        error: {
                            code: OrganizationErrorCode.ALREADY_EXISTS,
                            message: 'Organization with this email already exists',
                        },
                    };
                },
            };

            const worker = await createTestWorker(mockActivities);

            // Workflow の実行 - エラーが期待される
            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute('createOrganizationWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [
                            {
                                name: 'Test Organization',
                                email: 'existing@example.com',
                            },
                        ],
                    })
                )
            ).rejects.toThrow();
        });
    });

    describe('createOrganizationWithWorkosWorkflow', () => {
        it('should create organization with WorkOS successfully', async () => {
            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Organization',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const mockActivities: MockActivities = {
                createWorkosOrganizationActivity: async () => {
                    return {
                        ok: true,
                        value: mockWorkosOrg,
                    };
                },
                createOrganizationActivity: async (input: OrganizationCreateInput) => {
                    return {
                        ok: true,
                        value: {
                            id: randomUUID(),
                            name: input.name,
                            email: input.email,
                            description: input.description || null,
                            phone: input.phone || null,
                            website: input.website || null,
                            address: input.address || null,
                            workosOrganizationId: 'workos-org-123',
                            isActive: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    };
                },
            };

            const worker = await createTestWorker(mockActivities);

            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [
                        {
                            name: 'Test Organization',
                            email: 'test@example.com',
                            description: 'Test Description',
                            domains: ['example.com'],
                        },
                    ],
                })
            );

            expect(result).toBeDefined();
            expect(result.name).toBe('Test Organization');
            expect(result.workosOrganizationId).toBe('workos-org-123');
        });

        it('should compensate when DB creation fails after WorkOS creation', async () => {
            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Organization',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            let workosDeleted = false;

            const mockActivities: MockActivities = {
                createWorkosOrganizationActivity: async () => {
                    return {
                        ok: true,
                        value: mockWorkosOrg,
                    };
                },
                createOrganizationActivity: async () => {
                    return {
                        ok: false,
                        error: {
                            code: OrganizationErrorCode.DATABASE,
                            message: 'Database error',
                        },
                    };
                },
                deleteWorkosOrganizationActivity: async (id: string) => {
                    if (id === 'workos-org-123') {
                        workosDeleted = true;
                    }
                    return {
                        ok: true,
                        value: true,
                    };
                },
            };

            const worker = await createTestWorker(mockActivities);

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

            // 補償処理が実行されたことを確認
            expect(workosDeleted).toBe(true);
        });

        it('should create organization with admin user', async () => {
            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Organization',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const mockUser = {
                id: 'user-123',
                email: 'admin@example.com',
                firstName: 'Admin',
                lastName: 'User',
            };

            let userCreated = false;
            let membershipCreated = false;

            const mockActivities: MockActivities = {
                createWorkosOrganizationActivity: async () => {
                    return {
                        ok: true,
                        value: mockWorkosOrg,
                    };
                },
                createOrganizationActivity: async (input: OrganizationCreateInput) => {
                    return {
                        ok: true,
                        value: {
                            id: randomUUID(),
                            name: input.name,
                            email: input.email,
                            description: input.description || null,
                            phone: input.phone || null,
                            website: input.website || null,
                            address: input.address || null,
                            workosOrganizationId: 'workos-org-123',
                            isActive: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    };
                },
                createWorkosUserActivity: async () => {
                    userCreated = true;
                    return {
                        ok: true,
                        value: mockUser,
                    };
                },
                createWorkosOrganizationMembershipActivity: async () => {
                    membershipCreated = true;
                    return {
                        ok: true,
                        value: { id: 'membership-123' },
                    };
                },
            };

            const worker = await createTestWorker(mockActivities);

            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [
                        {
                            name: 'Test Organization',
                            email: 'test@example.com',
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

            expect(result).toBeDefined();
            expect(userCreated).toBe(true);
            expect(membershipCreated).toBe(true);
        });

        it('should fail when WorkOS organization creation fails', async () => {
            const mockActivities: MockActivities = {
                createWorkosOrganizationActivity: async () => {
                    return {
                        ok: false,
                        error: {
                            code: OrganizationErrorCode.INVALID,
                            message: 'Invalid domain',
                        },
                    };
                },
            };

            const worker = await createTestWorker(mockActivities);

            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [
                            {
                                name: 'Test Organization',
                                email: 'test@example.com',
                                domains: ['invalid'],
                            },
                        ],
                    })
                )
            ).rejects.toThrow();
        });


    })
});