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
import { ok, err, Result } from 'neverthrow';
import type { Organization } from '../activities/db/schema';
import type {
    OrganizationCreateInput,
    OrganizationUpdateInput,
    OrganizationError,
} from '../activities/db/models/organization';
import { OrganizationErrorCode } from '../activities/db/models/organization';
import type { WorkosOrganization } from '../activities/auth/workos/types';

/**
 * モック Activity の型定義
 */
interface MockActivities {
    // DB Activities: Promise<Result<T, E>> パターン
    insertOrganization?: (input: OrganizationCreateInput) => Promise<Result<Organization, OrganizationError>>;
    updateOrganization?: (id: string, patch: OrganizationUpdateInput) => Promise<Result<Organization | null, OrganizationError>>;
    removeOrganization?: (id: string) => Promise<Result<boolean, OrganizationError>>;
    // WorkOS Activities: Promise<{ok, value, error}> パターン
    createWorkosOrganizationActivity?: (input: any) => Promise<{ ok: true; value: WorkosOrganization } | { ok: false; error: any }>;
    deleteWorkosOrganizationActivity?: (id: string) => Promise<{ ok: true; value: boolean } | { ok: false; error: any }>;
    createWorkosUserActivity?: (input: any) => Promise<{ ok: true; value: any } | { ok: false; error: any }>;
    createWorkosOrganizationMembershipActivity?: (input: any) => Promise<{ ok: true; value: any } | { ok: false; error: any }>;
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
                id: 'workos-org-123', // WorkOS Organization ID を主キーとして使用
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockActivities: MockActivities = {
                createWorkosOrganizationActivity: async () => ({ ok: true, value: mockWorkosOrg }),
                insertOrganization: async () => ok(mockDBOrg),
                deleteWorkosOrganizationActivity: async () => ({ ok: true, value: true }),
            };

            const worker = await createTestWorker(mockActivities);

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

            expect(result).toBeDefined();
            expect(result.id).toBe('workos-org-123'); // WorkOS Organization ID が id として保存される
        });

        // it('should compensate when DB creation fails after WorkOS creation', async () => {
        //     const mockWorkosOrg: WorkosOrganization = {
        //         id: 'workos-org-123',
        //         name: 'Test Organization',
        //         domains: [{ domain: 'example.com', state: 'verified' }],
        //         created_at: '2024-01-01T00:00:00Z',
        //         updated_at: '2024-01-01T00:00:00Z',
        //         metadata: {
        //             contact: {
        //                 email: 'contact@example.com',
        //             },
        //         },
        //     };

        //     let workosDeleted = false;

        //     const mockActivities: MockActivities = {
        //         createWorkosOrganizationActivity: async () => ({ ok: true, value: mockWorkosOrg }),
        //         insertOrganization: async () => {
        //             return err({
        //                 code: OrganizationErrorCode.DATABASE,
        //                 message: 'Database error',
        //             });
        //         },
        //         deleteWorkosOrganizationActivity: async (id: string) => {
        //             if (id === 'workos-org-123') {
        //                 workosDeleted = true;
        //             }
        //             return { ok: true, value: true };
        //         },
        //     };

        //     const worker = await createTestWorker(mockActivities);

        //     await expect(
        //         worker.runUntil(
        //             testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
        //                 workflowId: randomUUID(),
        //                 taskQueue: 'test',
        //                 args: [
        //                     {
        //                         name: 'Test Organization',
        //                         email: 'test@example.com',
        //                         domains: ['example.com'],
        //                     },
        //                 ],
        //             })
        //         )
        //     ).rejects.toThrow();

        //     // 補償処理が実行されたことを確認
        //     expect(workosDeleted).toBe(true);
        // });

        // it('should create organization with admin user', async () => {
        //     const mockWorkosOrg: WorkosOrganization = {
        //         id: 'workos-org-123',
        //         name: 'Test Organization',
        //         domains: [{ domain: 'example.com', state: 'verified' }],
        //         created_at: '2024-01-01T00:00:00Z',
        //         updated_at: '2024-01-01T00:00:00Z',
        //         metadata: {
        //             contact: {
        //                 email: 'contact@example.com',
        //             },
        //         },
        //     };

        //     const mockUser = {
        //         id: 'user-123',
        //         email: 'admin@example.com',
        //         firstName: 'Admin',
        //         lastName: 'User',
        //     };

        //     let userCreated = false;
        //     let membershipCreated = false;

        //     const mockActivities: MockActivities = {
        //         createWorkosOrganizationActivity: async () => ({ ok: true, value: mockWorkosOrg }),
        //         insertOrganization: async (input: OrganizationCreateInput) => {
        //             return ok({
        //                 id: input.id, // 新スキーマ: WorkOS Organization ID
        //                 isActive: true,
        //                 createdAt: new Date(),
        //                 updatedAt: new Date(),
        //             });
        //         },
        //         createWorkosUserActivity: async () => {
        //             userCreated = true;
        //             return { ok: true, value: mockUser };
        //         },
        //         createWorkosOrganizationMembershipActivity: async () => {
        //             membershipCreated = true;
        //             return { ok: true, value: { id: 'membership-123' } };
        //         },
        //         deleteWorkosOrganizationActivity: async () => ({ ok: true, value: true }),
        //     };

        //     const worker = await createTestWorker(mockActivities);

        //     const result = await worker.runUntil(
        //         testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
        //             workflowId: randomUUID(),
        //             taskQueue: 'test',
        //             args: [
        //                 {
        //                     name: 'Test Organization',
        //                     domains: ['example.com'],
        //                     adminUser: {
        //                         email: 'admin@example.com',
        //                         firstName: 'Admin',
        //                         lastName: 'User',
        //                     },
        //                 },
        //             ],
        //         })
        //     );

        //     expect(result).toBeDefined();
        //     expect(userCreated).toBe(true);
        //     expect(membershipCreated).toBe(true);
        // });

        // it('should fail when WorkOS organization creation fails', async () => {
        //     const mockActivities: MockActivities = {
        //         createWorkosOrganizationActivity: async () => {
        //             return {
        //                 ok: false, error: {
        //                     code: OrganizationErrorCode.INVALID,
        //                     message: 'Invalid domain',
        //                 }
        //             };
        //         },
        //     };

        //     const worker = await createTestWorker(mockActivities);

        //     await expect(
        //         worker.runUntil(
        //             testEnv.client.workflow.execute('createOrganizationWithWorkosWorkflow', {
        //                 workflowId: randomUUID(),
        //                 taskQueue: 'test',
        //                 args: [
        //                     {
        //                         name: 'Test Organization',
        //                         domains: ['invalid'],
        //                     },
        //                 ],
        //             })
        //         )
        //     ).rejects.toThrow();
        // });


    })
});