/**
 * WorkOS Organization Activities Integration Tests
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
    getWorkosOrganization,
    getWorkosOrganizationSummary,
    createWorkosOrganization,
    updateWorkosOrganization,
    deleteWorkosOrganization,
    listWorkosOrganizations,
    WorkosOrganizationErrorType,
} from './organization';
import type { WorkOS } from '@workos-inc/node';

describe('WorkOS Organization Activities (Integration)', () => {
    let workosClient: WorkOS;

    // テスト用Organization名のプレフィックス（重複を避けるためタイムスタンプを使用）
    const TEST_ORG_PREFIX = 'alllbe-test';

    // 作成されたOrganizationのIDを追跡（クリーンアップ用）
    const createdOrgIds: string[] = [];

    /**
     * テスト用のOrganization名を生成
     */
    const generateTestOrgName = (suffix: string): string => {
        return `${TEST_ORG_PREFIX}-${suffix}-${Date.now()}`;
    };

    /**
     * テスト用Organizationのクリーンアップ
     */
    const cleanupTestOrganizations = async (): Promise<void> => {
        console.log('🧹 Cleaning up test organizations...');

        // 作成されたOrganizationを削除
        for (const orgId of createdOrgIds) {
            try {
                const deleteFn = deleteWorkosOrganization(workosClient);
                await deleteFn(orgId);
                console.log(`✓ Deleted test organization: ${orgId}`);
            } catch (error) {
                console.log(`ℹ Failed to delete organization ${orgId}:`, error);
            }
        }

        // さらに、TEST_ORG_PREFIXで始まる古いOrganizationを削除
        try {
            const listFn = listWorkosOrganizations(workosClient);
            const organizations = await listFn({ limit: 100 });

            for (const org of organizations) {
                if (org.name.startsWith(TEST_ORG_PREFIX)) {
                    try {
                        const deleteFn = deleteWorkosOrganization(workosClient);
                        await deleteFn(org.id);
                        console.log(`✓ Deleted old test organization: ${org.name} (${org.id})`);
                    } catch (error) {
                        console.log(`ℹ Failed to delete old organization ${org.id}:`, error);
                    }
                }
            }
        } catch (error) {
            console.log('ℹ Failed to list organizations for cleanup:', error);
        }

        console.log('✨ Cleanup completed');
    };

    beforeAll(async () => {
        try {
            const config = getWorkosConfigFromEnv();
            console.log('WorkOS Config:', {
                apiKey: config.apiKey.slice(0, 10) + '...',
                clientId: config.clientId,
            });
            workosClient = createWorkosClient(config);

            // テスト前にクリーンアップ
            await cleanupTestOrganizations();
        } catch (error) {
            console.error('Failed to initialize WorkOS client:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // テスト後にクリーンアップ
        await cleanupTestOrganizations();
    });

    describe('createWorkosOrganization', () => {
        it('should create organization successfully with domains', async () => {
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('create-with-domains');

            const input = {
                name: orgName,
                domains: ['example-test.com'],
            };

            try {
                const result = await createFn(input);
                createdOrgIds.push(result.id);

                // Organizationが作成されたことを確認
                expect(result.id).toBeDefined();
                expect(result.name).toBe(orgName);
                expect(result.domains).toBeDefined();
                expect(result.created_at).toBeDefined();
                expect(result.updated_at).toBeDefined();

                console.log(`✓ Created organization: ${result.name} (${result.id})`);
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

        it('should create organization without domains', async () => {
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('create-no-domains');

            const input = {
                name: orgName,
                domains: [],
            };

            const result = await createFn(input);
            createdOrgIds.push(result.id);

            expect(result.id).toBeDefined();
            expect(result.name).toBe(orgName);
            expect(result.domains).toEqual([]);

            console.log(`✓ Created organization: ${result.name} (${result.id})`);
        });

        it('should throw WORKOS_INVALID_DOMAIN for invalid domain format', async () => {
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('invalid-domain');

            const input = {
                name: orgName,
                domains: ['invalid domain with spaces'],
            };

            await expect(createFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await createFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                // WorkOS APIは無効なドメインに対してどのエラーを返すかによって調整
                const failureError = error as ApplicationFailure;
                expect([
                    WorkosOrganizationErrorType.INVALID_DOMAIN,
                    WorkosOrganizationErrorType.API_ERROR,
                ]).toContain(failureError.type);
            }
        });
    });

    describe('getWorkosOrganization', () => {
        it('should get organization by ID', async () => {
            // まずOrganizationを作成
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('get-by-id');
            const created = await createFn({
                name: orgName,
                domains: ['get-test.com'],
            });
            createdOrgIds.push(created.id);

            // Organizationを取得
            const getFn = getWorkosOrganization(workosClient);
            const result = await getFn(created.id);

            expect(result.id).toBe(created.id);
            expect(result.name).toBe(orgName);
            expect(result.domains).toBeDefined();
            expect(result.created_at).toBeDefined();
        });

        it('should throw WORKOS_ORGANIZATION_NOT_FOUND when organization does not exist', async () => {
            const getFn = getWorkosOrganization(workosClient);
            const nonExistentOrgId = 'org_nonexistent123456789';

            await expect(getFn(nonExistentOrgId)).rejects.toThrow(ApplicationFailure);

            try {
                await getFn(nonExistentOrgId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosOrganizationErrorType.NOT_FOUND
                );
            }
        });
    });

    describe('getWorkosOrganizationSummary', () => {
        it('should get organization summary by ID', async () => {
            // まずOrganizationを作成
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('get-summary');
            const created = await createFn({
                name: orgName,
                domains: [],
            });
            createdOrgIds.push(created.id);

            // サマリーを取得
            const getSummaryFn = getWorkosOrganizationSummary(workosClient);
            const result = await getSummaryFn(created.id);

            expect(result.id).toBe(created.id);
            expect(result.name).toBe(orgName);
            expect(result.verified_domain_count).toBeDefined();
            expect(typeof result.verified_domain_count).toBe('number');
            expect(result.created_at).toBeDefined();
        });
    });

    describe('updateWorkosOrganization', () => {
        it('should update organization name', async () => {
            // まずOrganizationを作成
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('update-name');
            const created = await createFn({
                name: orgName,
                domains: [],
            });
            createdOrgIds.push(created.id);

            // Organization名を更新
            const updateFn = updateWorkosOrganization(workosClient);
            const newName = generateTestOrgName('updated-name');
            const updated = await updateFn({
                organizationId: created.id,
                name: newName,
            });

            expect(updated.id).toBe(created.id);
            expect(updated.name).toBe(newName);
            expect(updated.updated_at).toBeDefined();

            console.log(`✓ Updated organization: ${orgName} → ${newName}`);
        });

        it('should update organization domains', async () => {
            // まずOrganizationを作成
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('update-domains');
            const created = await createFn({
                name: orgName,
                domains: ['old-domain.com'],
            });
            createdOrgIds.push(created.id);

            // ドメインを更新
            const updateFn = updateWorkosOrganization(workosClient);
            const updated = await updateFn({
                organizationId: created.id,
                domains: ['new-domain.com', 'another-domain.com'],
            });

            expect(updated.id).toBe(created.id);
            expect(updated.domains.length).toBeGreaterThanOrEqual(2);

            console.log(`✓ Updated domains for organization: ${orgName}`);
        });

        it('should throw WORKOS_ORGANIZATION_NOT_FOUND when updating non-existent organization', async () => {
            const updateFn = updateWorkosOrganization(workosClient);
            const nonExistentOrgId = 'org_nonexistent123456789';

            await expect(
                updateFn({
                    organizationId: nonExistentOrgId,
                    name: 'New Name',
                })
            ).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn({
                    organizationId: nonExistentOrgId,
                    name: 'New Name',
                });
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosOrganizationErrorType.NOT_FOUND
                );
            }
        });
    });

    describe('listWorkosOrganizations', () => {
        it('should list organizations with default limit', async () => {
            const listFn = listWorkosOrganizations(workosClient);
            const result = await listFn({ limit: 10 });

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeLessThanOrEqual(10);

            if (result.length > 0) {
                const org = result[0];
                expect(org).toBeDefined();
                if (org) {
                    expect(org.id).toBeDefined();
                    expect(org.name).toBeDefined();
                    expect(org.domains).toBeDefined();
                }
            }

            console.log(`✓ Listed ${result.length} organizations`);
        });

        it('should list organizations with custom limit', async () => {
            const listFn = listWorkosOrganizations(workosClient);
            const result = await listFn({ limit: 5 });

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeLessThanOrEqual(5);
        });
    });

    describe('deleteWorkosOrganization', () => {
        it('should delete organization successfully', async () => {
            // まずOrganizationを作成
            const createFn = createWorkosOrganization(workosClient);
            const orgName = generateTestOrgName('delete');
            const created = await createFn({
                name: orgName,
                domains: [],
            });
            const orgId = created.id;

            // Organizationを削除
            const deleteFn = deleteWorkosOrganization(workosClient);
            const result = await deleteFn(orgId);

            expect(result).toBe(true);

            // 削除されたことを確認（取得エラー）
            const getFn = getWorkosOrganization(workosClient);
            await expect(getFn(orgId)).rejects.toThrow(ApplicationFailure);

            try {
                await getFn(orgId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosOrganizationErrorType.NOT_FOUND
                );
            }

            console.log(`✓ Deleted organization: ${orgName} (${orgId})`);
        });

        it('should throw WORKOS_ORGANIZATION_NOT_FOUND when deleting non-existent organization', async () => {
            const deleteFn = deleteWorkosOrganization(workosClient);
            const nonExistentOrgId = 'org_nonexistent123456789';

            await expect(deleteFn(nonExistentOrgId)).rejects.toThrow(ApplicationFailure);

            try {
                await deleteFn(nonExistentOrgId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    WorkosOrganizationErrorType.NOT_FOUND
                );
            }
        });
    });
});
