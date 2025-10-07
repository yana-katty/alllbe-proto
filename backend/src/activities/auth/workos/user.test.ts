/**
 * WorkOS Organization User Activities Integration Tests
 * 
 * このテストは実際の WorkOS API を使用した統合テストです。
 * テスト実行前に環境変数の設定が必要です。
 * 
 * 必要な環境変数:
 * - WORKOS_API_KEY (sk_test_xxx)
 * - WORKOS_CLIENT_ID (client_xxx)
 * 
 * 環境変数の設定方法:
 * 1. backend/.env.test ファイルを作成
 * 2. 以下の形式で環境変数を設定:
 *    WORKOS_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx
 * 
 * 注意:
 * - Test環境のAPIキーを使用してください（sk_test_で始まるキー）
 * - 本番環境のキーは絶対に使用しないでください
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    getWorkosConfigFromEnv,
    createWorkosClient,
} from './workosClient';
import {
    getWorkosOrganizationUser,
    getWorkosUserSummary,
    createWorkosUser,
    createWorkosOrganizationMembership,
    updateWorkosUser,
    deleteWorkosUser,
    listWorkosOrganizationUsers,
    checkWorkosOrganizationMembership,
    WorkosUserErrorType,
} from './user';
import {
    createWorkosOrganization,
    deleteWorkosOrganization,
} from './organization';
import type { WorkOS } from '@workos-inc/node';

describe('WorkOS Organization User Activities (Integration)', () => {
    let workosClient: WorkOS;

    // テスト用Organization ID（全テストで共有）
    let testOrganizationId: string;
    let testOrganizationName: string;

    // テスト用User名のプレフィックス
    const TEST_USER_PREFIX = 'alllbe-test-user';

    // 作成されたUserのIDを追跡（クリーンアップ用）
    const createdUserIds: string[] = [];

    /**
     * テスト用のUser emailを生成
     */
    const generateTestUserEmail = (suffix: string): string => {
        return `${TEST_USER_PREFIX}-${suffix}-${Date.now()}@example.com`;
    };

    /**
     * テスト用Userのクリーンアップ
     */
    const cleanupTestUsers = async (): Promise<void> => {
        console.log('🧹 Cleaning up test users...');

        for (const userId of createdUserIds) {
            try {
                const deleteFn = deleteWorkosUser(workosClient);
                await deleteFn(userId);
                console.log(`✓ Deleted test user: ${userId}`);
            } catch (error) {
                console.log(`ℹ Failed to delete user ${userId}:`, error);
            }
        }

        console.log('✨ User cleanup completed');
    };

    /**
     * テスト用Organizationのクリーンアップ
     */
    const cleanupTestOrganization = async (): Promise<void> => {
        if (testOrganizationId) {
            console.log('🧹 Cleaning up test organization...');
            try {
                const deleteFn = deleteWorkosOrganization(workosClient);
                await deleteFn(testOrganizationId);
                console.log(`✓ Deleted test organization: ${testOrganizationId}`);
            } catch (error) {
                console.log(`ℹ Failed to delete organization ${testOrganizationId}:`, error);
            }
        }
    };

    beforeAll(async () => {
        try {
            const config = getWorkosConfigFromEnv();
            console.log('WorkOS Config:', {
                apiKey: config.apiKey.slice(0, 10) + '...',
                clientId: config.clientId,
            });
            workosClient = createWorkosClient(config);

            // テスト用Organizationを作成
            const createOrgFn = createWorkosOrganization(workosClient);
            testOrganizationName = `alllbe-test-org-user-tests-${Date.now()}`;
            const org = await createOrgFn({
                name: testOrganizationName,
                domains: [],
            });
            testOrganizationId = org.id;
            console.log(`✓ Created test organization: ${testOrganizationName} (${testOrganizationId})`);
        } catch (error) {
            console.error('Failed to initialize WorkOS client:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // テスト後にクリーンアップ
        await cleanupTestUsers();
        await cleanupTestOrganization();
    });

    describe('createWorkosUser', () => {
        it('should create user successfully', async () => {
            const createFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('create');

            const input = {
                email,
                firstName: 'Test',
                lastName: 'User',
                emailVerified: false,
            };

            try {
                const result = await createFn(input);
                createdUserIds.push(result.id);

                expect(result.id).toBeDefined();
                expect(result.email).toBe(email);
                expect(result.first_name).toBe('Test');
                expect(result.last_name).toBe('User');
                expect(result.state).toBe('pending'); // emailVerified: false
                expect(result.created_at).toBeDefined();
                expect(result.updated_at).toBeDefined();

                console.log(`✓ Created user: ${result.email} (${result.id})`);
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    console.error('WorkOS API Error Details:', {
                        type: error.type,
                        message: error.message,
                        details: error.details,
                    });
                }
                throw error;
            }
        });

        it('should create user with emailVerified=true', async () => {
            const createFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('create-verified');

            const input = {
                email,
                firstName: 'Verified',
                lastName: 'User',
                emailVerified: true,
            };

            const result = await createFn(input);
            createdUserIds.push(result.id);

            expect(result.id).toBeDefined();
            expect(result.email).toBe(email);
            expect(result.state).toBe('active'); // emailVerified: true
            console.log(`✓ Created verified user: ${result.email} (${result.id})`);
        });

        it('should throw WORKOS_INVALID_EMAIL for invalid email format', async () => {
            const createFn = createWorkosUser(workosClient);

            const input = {
                email: 'invalid-email-format',
                firstName: 'Invalid',
                lastName: 'Email',
                emailVerified: false,
            };

            await expect(createFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await createFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                const failureError = error as ApplicationFailure;
                expect([
                    WorkosUserErrorType.INVALID_EMAIL,
                    WorkosUserErrorType.API_ERROR,
                ]).toContain(failureError.type);
            }
        });
    });

    describe('getWorkosOrganizationUser', () => {
        it('should get user by ID', async () => {
            // まずUserを作成
            const createFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('get-by-id');
            const created = await createFn({
                email,
                firstName: 'Get',
                lastName: 'Test',
                emailVerified: true,
            });
            createdUserIds.push(created.id);

            // Userを取得
            const getFn = getWorkosOrganizationUser(workosClient);
            const result = await getFn(created.id);

            expect(result.id).toBe(created.id);
            expect(result.email).toBe(email);
            expect(result.first_name).toBe('Get');
            expect(result.last_name).toBe('Test');
            expect(result.created_at).toBeDefined();
        });

        it('should throw WORKOS_USER_NOT_FOUND when user does not exist', async () => {
            const getFn = getWorkosOrganizationUser(workosClient);
            const nonExistentUserId = 'user_nonexistent123456789';

            await expect(getFn(nonExistentUserId)).rejects.toThrow(ApplicationFailure);

            try {
                await getFn(nonExistentUserId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosUserErrorType.USER_NOT_FOUND
                );
            }
        });
    });

    describe('getWorkosUserSummary', () => {
        it('should get user summary by ID', async () => {
            // まずUserを作成
            const createFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('get-summary');
            const created = await createFn({
                email,
                firstName: 'Summary',
                lastName: 'Test',
                emailVerified: false,
            });
            createdUserIds.push(created.id);

            // サマリーを取得
            const getSummaryFn = getWorkosUserSummary(workosClient);
            const result = await getSummaryFn(created.id);

            expect(result.id).toBe(created.id);
            expect(result.state).toBe('pending');
            expect(result.admin_level).toBeDefined();
            expect(result.created_at).toBeDefined();
        });
    });

    describe('updateWorkosUser', () => {
        it('should update user first name and last name', async () => {
            // まずUserを作成
            const createFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('update');
            const created = await createFn({
                email,
                firstName: 'Old',
                lastName: 'Name',
                emailVerified: true,
            });
            createdUserIds.push(created.id);

            // Userを更新
            const updateFn = updateWorkosUser(workosClient);
            const result = await updateFn({
                userId: created.id,
                firstName: 'New',
                lastName: 'UpdatedName',
            });

            expect(result.id).toBe(created.id);
            expect(result.first_name).toBe('New');
            expect(result.last_name).toBe('UpdatedName');
            expect(result.email).toBe(email); // emailは変更されない
            console.log(`✓ Updated user: ${result.first_name} ${result.last_name}`);
        });

        it('should throw WORKOS_USER_NOT_FOUND when updating non-existent user', async () => {
            const updateFn = updateWorkosUser(workosClient);
            const nonExistentUserId = 'user_nonexistent123456789';

            await expect(updateFn({
                userId: nonExistentUserId,
                firstName: 'New',
                lastName: 'Name',
            })).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn({
                    userId: nonExistentUserId,
                    firstName: 'New',
                    lastName: 'Name',
                });
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosUserErrorType.USER_NOT_FOUND
                );
            }
        });
    });

    describe('listWorkosOrganizationUsers', () => {
        it('should list users in organization', async () => {
            // このテストではWorkOS APIの実際の挙動に依存するため、
            // Organization内にUserがいない場合でも空配列が返ることを確認
            const listFn = listWorkosOrganizationUsers(workosClient);
            const result = await listFn(testOrganizationId, { limit: 10 });

            expect(Array.isArray(result)).toBe(true);
            console.log(`✓ Listed ${result.length} users in organization ${testOrganizationId}`);
        });

        it('should list users with custom limit', async () => {
            const listFn = listWorkosOrganizationUsers(workosClient);
            const result = await listFn(testOrganizationId, { limit: 5 });

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeLessThanOrEqual(5);
        });
    });

    describe('deleteWorkosUser', () => {
        it('should delete user successfully', async () => {
            // まずUserを作成
            const createFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('delete');
            const created = await createFn({
                email,
                firstName: 'Delete',
                lastName: 'Test',
                emailVerified: false,
            });
            const userId = created.id;

            // Userを削除
            const deleteFn = deleteWorkosUser(workosClient);
            const result = await deleteFn(userId);

            expect(result).toBe(true);
            console.log(`✓ Deleted user: ${userId}`);

            // 削除後に取得しようとするとエラー
            const getFn = getWorkosOrganizationUser(workosClient);
            await expect(getFn(userId)).rejects.toThrow(ApplicationFailure);
        });

        it('should throw WORKOS_USER_NOT_FOUND when deleting non-existent user', async () => {
            const deleteFn = deleteWorkosUser(workosClient);
            const nonExistentUserId = 'user_nonexistent123456789';

            await expect(deleteFn(nonExistentUserId)).rejects.toThrow(ApplicationFailure);

            try {
                await deleteFn(nonExistentUserId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosUserErrorType.USER_NOT_FOUND
                );
            }
        });
    });

    describe('createWorkosOrganizationMembership', () => {
        it('should create organization membership', async () => {
            // まずUserを作成
            const createUserFn = createWorkosUser(workosClient);
            const email = generateTestUserEmail('membership');
            const user = await createUserFn({
                email,
                firstName: 'Membership',
                lastName: 'Test',
                emailVerified: true,
            });
            createdUserIds.push(user.id);

            // Membershipを作成
            const createMembershipFn = createWorkosOrganizationMembership(workosClient);
            const result = await createMembershipFn({
                userId: user.id,
                organizationId: testOrganizationId,
            });

            expect(result).toBe(true);
            console.log(`✓ Created membership: user ${user.id} → org ${testOrganizationId}`);
        });
    });

    describe('checkWorkosOrganizationMembership', () => {
        it('should return false for non-existent user', async () => {
            const checkFn = checkWorkosOrganizationMembership(workosClient);
            const result = await checkFn({
                userId: 'user_nonexistent123456789',
                organizationId: testOrganizationId,
            });

            expect(result).toBe(false);
        });
    });
});
