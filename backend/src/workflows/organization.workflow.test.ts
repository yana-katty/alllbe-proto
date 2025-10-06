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


    })
});