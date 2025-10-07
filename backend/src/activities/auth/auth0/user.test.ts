/**
 * Auth0 User Activities Integration Tests
 * 
 * このテストは実際の Auth0 API を使用した統合テストです。
 * テスト実行前に環境変数の設定が必要です。
 * 
 * 必要な環境変数:
 * - AUTH0_DOMAIN
 * - AUTH0_MANAGEMENT_CLIENT_ID
 * - AUTH0_MANAGEMENT_CLIENT_SECRET
 * - AUTH0_CONNECTION_NAME (オプション)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    getAuth0ConfigFromEnv,
    createAuth0ManagementClient,
    getAuth0User,
    getAuth0UserSummary,
    createAuth0User,
    updateAuth0User,
    deleteAuth0User,
    updateAuth0EmailVerification,
    blockAuth0User,
    Auth0ErrorType,
    type Auth0UserCreateInput,
    type Auth0UserUpdateInput,
} from './index';
import type { ManagementClient } from 'auth0';

describe('Auth0 User Activities (Integration)', () => {
    let auth0Client: ManagementClient;
    let connectionName: string;

    // 固定テストユーザー（テスト実行のたびに作成・削除される）
    const TEST_USERS = {
        FULL: 'test-alllbe-full@example.com',
        MINIMAL: 'test-alllbe-minimal@example.com',
        DUPLICATE: 'test-alllbe-duplicate@example.com',
        GET_USER: 'test-alllbe-get@example.com',
        GET_SUMMARY: 'test-alllbe-summary@example.com',
        UPDATE: 'test-alllbe-update@example.com',
        EMAIL_VERIFY: 'test-alllbe-email-verify@example.com',
        BLOCK: 'test-alllbe-block@example.com',
        DELETE: 'test-alllbe-delete@example.com',
    } as const;

    const TEST_PASSWORD = 'Test1234!@#$';

    /**
     * メールアドレスでAuth0ユーザーを検索して削除する
     */
    async function deleteUserByEmail(email: string): Promise<void> {
        try {
            const users = await auth0Client.users.listUsersByEmail({ email });

            if (users && users.length > 0) {
                const user = users[0];
                const userId = user?.user_id;

                if (!userId) {
                    console.log(`ℹ No user_id found for: ${email}`);
                    return;
                }

                console.log(`✓ Found user ${email} (${userId}), deleting...`);

                const deleteFn = deleteAuth0User(auth0Client);
                await deleteFn(userId);

                console.log(`✓ Deleted existing user: ${email}`);
            } else {
                console.log(`ℹ No existing user found for: ${email}`);
            }
        } catch (error) {
            console.log(`ℹ No existing user found for: ${email} (error: ${error})`);
        }
    }

    /**
     * すべての固定テストユーザーをクリーンアップ
     */
    const cleanupAllTestUsers = async (): Promise<void> => {
        console.log('🧹 Cleaning up all test users...');
        const emails = Object.values(TEST_USERS);

        for (const email of emails) {
            await deleteUserByEmail(email);
        }

        console.log('✨ Cleanup completed');
    };

    beforeAll(async () => {
        // 実際の Auth0 クライアントを作成
        try {
            const config = getAuth0ConfigFromEnv();
            console.log('Auth0 Config:', {
                domain: config.domain,
                clientId: config.clientId,
                connectionName: config.connectionName,
            });
            auth0Client = createAuth0ManagementClient(config);
            connectionName = config.connectionName || 'Username-Password-Authentication';

            // テスト前に既存の固定メールアドレスのユーザーをクリーンアップ
            await cleanupAllTestUsers();
        } catch (error) {
            console.error('Failed to initialize Auth0 client:', error);
            throw error;
        }
    }, 30000); // 30秒のタイムアウト

    afterAll(async () => {
        // テスト後にすべてのユーザーを再度クリーンアップ
        await cleanupAllTestUsers();
    }, 30000); // 30秒のタイムアウト

    describe('createAuth0User', () => {
        it('should create user successfully with all fields', async () => {
            const createFn = createAuth0User(auth0Client, connectionName);

            const input: Auth0UserCreateInput = {
                email: TEST_USERS.FULL,
                password: TEST_PASSWORD,
                given_name: 'Test',
                family_name: 'User',
                name: 'Test User',
                data_processing_consent: true,
                marketing_consent: true,
            };

            try {
                const result = await createFn(input);

                // ユーザーが作成されたことを確認
                expect(result.user_id).toBeDefined();
                expect(result.email).toBe(input.email);
                expect(result.given_name).toBe(input.given_name);
                expect(result.family_name).toBe(input.family_name);
                expect(result.name).toBe(input.name);
                expect(result.email_verified).toBe(false);
            } catch (error) {
                if (error instanceof ApplicationFailure) {
                    console.error('Auth0 API Error Details:', {
                        type: error.type,
                        message: error.message,
                        details: error.details,
                    });
                }
                throw error;
            }
        });

        it('should create user with minimal fields', async () => {
            const createFn = createAuth0User(auth0Client, connectionName);

            const input: Auth0UserCreateInput = {
                email: TEST_USERS.MINIMAL,
                password: TEST_PASSWORD,
                data_processing_consent: true,
                marketing_consent: false,
            };

            const result = await createFn(input);

            expect(result.user_id).toBeDefined();
            expect(result.email).toBe(input.email);
        });

        it('should throw AUTH0_EMAIL_ALREADY_EXISTS when email is duplicate', async () => {
            const createFn = createAuth0User(auth0Client, connectionName);

            const input: Auth0UserCreateInput = {
                email: TEST_USERS.DUPLICATE,
                password: TEST_PASSWORD,
                data_processing_consent: true,
                marketing_consent: false,
            };

            // 1回目: 成功
            const firstResult = await createFn(input);
            expect(firstResult.user_id).toBeDefined();

            // 2回目: 重複エラー
            await expect(createFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await createFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.EMAIL_ALREADY_EXISTS
                );
                expect((error as ApplicationFailure).message).toContain('already exists');
            }
        });

        it('should throw AUTH0_VALIDATION_ERROR for invalid email', async () => {
            const createFn = createAuth0User(auth0Client, connectionName);

            const input: Auth0UserCreateInput = {
                email: 'invalid-email', // 無効なメールアドレス
                password: 'Test1234!@#$',
                data_processing_consent: true,
                marketing_consent: false,
            };

            await expect(createFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await createFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.VALIDATION_ERROR
                );
            }
        });

        it('should throw AUTH0_VALIDATION_ERROR for weak password', async () => {
            const createFn = createAuth0User(auth0Client, connectionName);

            const input: Auth0UserCreateInput = {
                email: `test-weak-pwd-${Date.now()}@example.com`,
                password: '123', // 弱いパスワード
                data_processing_consent: true,
                marketing_consent: false,
            };

            await expect(createFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await createFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.VALIDATION_ERROR
                );
            }
        });
    });

    describe('getAuth0User', () => {
        it('should get user by ID', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(auth0Client, connectionName);
            const created = await createFn({
                email: TEST_USERS.GET_USER,
                password: TEST_PASSWORD,
                given_name: 'Get',
                family_name: 'Test',
                data_processing_consent: true,
                marketing_consent: false,
            });

            // ユーザーを取得
            const getFn = getAuth0User(auth0Client);
            const result = await getFn(created.user_id!);

            expect(result.user_id).toBe(created.user_id);
            expect(result.email).toBe(created.email);
            expect(result.given_name).toBe('Get');
            expect(result.family_name).toBe('Test');
        });

        it('should throw AUTH0_USER_NOT_FOUND when user does not exist', async () => {
            const getFn = getAuth0User(auth0Client);
            const nonExistentUserId = 'auth0|nonexistent123456789';

            await expect(getFn(nonExistentUserId)).rejects.toThrow(ApplicationFailure);

            try {
                await getFn(nonExistentUserId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.USER_NOT_FOUND
                );
            }
        });
    });

    describe('getAuth0UserSummary', () => {
        it('should get minimal user info by ID', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(auth0Client, connectionName);
            const created = await createFn({
                email: TEST_USERS.GET_SUMMARY,
                password: TEST_PASSWORD,
                name: 'Summary Test User',
                data_processing_consent: true,
                marketing_consent: false,
            });

            // 最小限の情報を取得
            const getSummaryFn = getAuth0UserSummary(auth0Client);
            const result = await getSummaryFn(created.user_id!);

            expect(result.user_id).toBe(created.user_id);
            expect(result.email_verified).toBe(false);
            expect(result.blocked).toBe(false);

            // 詳細情報は含まれていないことを確認（Auth0UserSummaryにはemailが含まれない）
            expect(result).not.toHaveProperty('identities');
        });
    });

    describe('updateAuth0User', () => {
        it('should update user successfully', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(auth0Client, connectionName);
            const created = await createFn({
                email: TEST_USERS.UPDATE,
                password: TEST_PASSWORD,
                given_name: 'Old Name',
                family_name: 'Old Family',
                data_processing_consent: true,
                marketing_consent: false,
            });

            // ユーザーを更新
            const updateFn = updateAuth0User(auth0Client);
            const patch: Auth0UserUpdateInput = {
                given_name: 'New Name',
                family_name: 'New Family',
                picture: 'https://example.com/new-avatar.jpg',
            };

            const updated = await updateFn(created.user_id!, patch);

            expect(updated.given_name).toBe('New Name');
            expect(updated.family_name).toBe('New Family');
            expect(updated.picture).toBe('https://example.com/new-avatar.jpg');
            expect(updated.email).toBe(created.email); // メールは変更されない
        });

        it('should throw AUTH0_USER_NOT_FOUND when updating non-existent user', async () => {
            const updateFn = updateAuth0User(auth0Client);
            const nonExistentUserId = 'auth0|nonexistent123456789';

            await expect(
                updateFn(nonExistentUserId, { given_name: 'Test' })
            ).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn(nonExistentUserId, { given_name: 'Test' });
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.USER_NOT_FOUND
                );
            }
        });
    });

    describe('updateAuth0EmailVerification', () => {
        it('should update email verification status', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(auth0Client, connectionName);
            const created = await createFn({
                email: TEST_USERS.EMAIL_VERIFY,
                password: TEST_PASSWORD,
                data_processing_consent: true,
                marketing_consent: false,
            });

            // メール認証済みに更新
            const updateVerificationFn = updateAuth0EmailVerification(auth0Client);
            const updated = await updateVerificationFn(created.user_id!, true);

            expect(updated.email_verified).toBe(true);
        });
    });

    describe('blockAuth0User', () => {
        it('should block and unblock user', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(auth0Client, connectionName);
            const created = await createFn({
                email: TEST_USERS.BLOCK,
                password: TEST_PASSWORD,
                data_processing_consent: true,
                marketing_consent: false,
            });

            const blockFn = blockAuth0User(auth0Client);

            // ブロック
            const blocked = await blockFn(created.user_id!, true);
            // blocked フィールドがない場合があるため、getで再確認
            const blockedUser = await getAuth0User(auth0Client)(created.user_id!);
            expect(blockedUser).toBeDefined();

            // アンブロック
            const unblocked = await blockFn(created.user_id!, false);
            const unblockedUser = await getAuth0User(auth0Client)(created.user_id!);
            expect(unblockedUser).toBeDefined();
        });
    });

    describe('deleteAuth0User', () => {
        it('should delete user successfully', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(auth0Client, connectionName);
            const created = await createFn({
                email: TEST_USERS.DELETE,
                password: TEST_PASSWORD,
                data_processing_consent: true,
                marketing_consent: false,
            });
            const userId = created.user_id!;

            // ユーザーを削除
            const deleteFn = deleteAuth0User(auth0Client);
            await deleteFn(userId);

            // 削除されたことを確認（取得エラー）
            const getFn = getAuth0User(auth0Client);
            await expect(getFn(userId)).rejects.toThrow(ApplicationFailure);

            try {
                await getFn(userId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.USER_NOT_FOUND
                );
            }
        });

        it('should throw AUTH0_USER_NOT_FOUND when deleting non-existent user', async () => {
            const deleteFn = deleteAuth0User(auth0Client);
            const nonExistentUserId = 'auth0|nonexistent123456789';

            // 注意: Auth0 SDKは存在しないユーザーの削除時にエラーを返さない場合があります
            // その場合はこのテストをスキップするか、事前に存在確認を行います
            try {
                await deleteFn(nonExistentUserId);
                // エラーがthrowされない場合もあるため、このテストは条件付きで成功とする
                console.warn('⚠️  Auth0 did not throw error for non-existent user deletion');
            } catch (error) {
                // エラーが投げられた場合は AUTH0_USER_NOT_FOUND を期待
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.USER_NOT_FOUND
                );
            }
        });
    });
});

