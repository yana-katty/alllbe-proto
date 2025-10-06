/**
 * Organization Actions テスト
 * 
 * Actions層のテストは、Activity関数をモックして、
 * ビジネスロジックのみをテストします。
 */

import { describe, it, expect, vi } from 'vitest';
import {
    getOrganizationById,
    getOrganizationByEmail,
    getOrganizationByWorkosId,
    listOrganizations
} from './organization';
import type { Organization } from '../activities/db/schema';
import type { WorkosOrganization } from '../activities/auth/workos/types';
import { OrganizationErrorCode } from '../activities/db/models/organization';

describe('Organization Actions', () => {
    describe('getOrganizationById', () => {
        it('should return organization when activity succeeds', async () => {
            // モックActivity: 成功ケース
            const mockOrg: Organization = {
                id: 'org-123',
                name: 'Test Org',
                email: 'test@example.com',
                description: null,
                phone: null,
                website: null,
                address: null,
                workosOrganizationId: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            // Action実行（依存注入）
            const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
            const result = await action('org-123');

            // アサーション
            expect(result).toEqual(mockOrg);
            expect(mockActivity).toHaveBeenCalledWith('org-123');
            expect(mockActivity).toHaveBeenCalledTimes(1);
        });

        it('should return null when organization not found', async () => {
            // モックActivity: 存在しない
            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: null,
            });

            const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
            const result = await action('non-existent-id');

            expect(result).toBeNull();
            expect(mockActivity).toHaveBeenCalledWith('non-existent-id');
        });

        it('should throw error when activity fails', async () => {
            // モックActivity: エラーケース
            const mockActivity = vi.fn().mockResolvedValue({
                ok: false,
                error: {
                    code: OrganizationErrorCode.DATABASE,
                    message: 'Database connection failed',
                },
            });

            const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });

            // エラーがthrowされることを確認
            await expect(action('org-123')).rejects.toThrow('Failed to get organization: Database connection failed');
            expect(mockActivity).toHaveBeenCalledWith('org-123');
        });
    });

    describe('getOrganizationByEmail', () => {
        it('should return organization when found by email', async () => {
            const mockOrg: Organization = {
                id: 'org-123',
                name: 'Test Org',
                email: 'test@example.com',
                description: null,
                phone: null,
                website: null,
                address: null,
                workosOrganizationId: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            const action = getOrganizationByEmail({ getOrganizationByEmailActivity: mockActivity });
            const result = await action('test@example.com');

            expect(result).toEqual(mockOrg);
            expect(mockActivity).toHaveBeenCalledWith('test@example.com');
        });

        it('should return null when organization not found by email', async () => {
            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: null,
            });

            const action = getOrganizationByEmail({ getOrganizationByEmailActivity: mockActivity });
            const result = await action('nonexistent@example.com');

            expect(result).toBeNull();
            expect(mockActivity).toHaveBeenCalledWith('nonexistent@example.com');
        });

        it('should throw error when activity fails', async () => {
            const mockActivity = vi.fn().mockResolvedValue({
                ok: false,
                error: {
                    code: OrganizationErrorCode.DATABASE,
                    message: 'Database query failed',
                },
            });

            const action = getOrganizationByEmail({ getOrganizationByEmailActivity: mockActivity });

            await expect(action('test@example.com')).rejects.toThrow('Failed to get organization: Database query failed');
            expect(mockActivity).toHaveBeenCalledWith('test@example.com');
        });
    });

    describe('listOrganizations', () => {
        it('should return organizations list', async () => {
            const mockOrgs: Organization[] = [
                {
                    id: 'org-1',
                    name: 'Org 1',
                    email: 'org1@example.com',
                    description: null,
                    phone: null,
                    website: null,
                    address: null,
                    workosOrganizationId: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: 'org-2',
                    name: 'Org 2',
                    email: 'org2@example.com',
                    description: null,
                    phone: null,
                    website: null,
                    address: null,
                    workosOrganizationId: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrgs,
            });

            const action = listOrganizations({ listOrganizationsActivity: mockActivity });
            const result = await action({ limit: 20, offset: 0 });

            expect(result).toEqual(mockOrgs);
            expect(result).toHaveLength(2);
            expect(mockActivity).toHaveBeenCalledWith({ limit: 20, offset: 0 });
        });

        it('should return empty array when no organizations found', async () => {
            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: [],
            });

            const action = listOrganizations({ listOrganizationsActivity: mockActivity });
            const result = await action({ limit: 20, offset: 0 });

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should throw error when list activity fails', async () => {
            const mockActivity = vi.fn().mockResolvedValue({
                ok: false,
                error: {
                    code: OrganizationErrorCode.DATABASE,
                    message: 'Query failed',
                },
            });

            const action = listOrganizations({ listOrganizationsActivity: mockActivity });

            await expect(action({ limit: 20, offset: 0 })).rejects.toThrow('Failed to list organizations: Query failed');
        });

        it('should pass correct query parameters', async () => {
            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: [],
            });

            const action = listOrganizations({ listOrganizationsActivity: mockActivity });

            const params = {
                limit: 50,
                offset: 10,
                isActive: true,
                search: 'test'
            };

            await action(params);

            expect(mockActivity).toHaveBeenCalledWith(params);
        });
    });

    describe('getOrganizationById with WorkOS integration', () => {
        it('should return organization with WorkOS data when workosOrganizationId exists', async () => {
            const mockOrg: Organization = {
                id: 'org-123',
                name: 'Test Org',
                email: 'test@example.com',
                description: null,
                phone: null,
                website: null,
                address: null,
                workosOrganizationId: 'workos-org-123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Org',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const mockGetOrgActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            const mockGetWorkosActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockWorkosOrg,
            });

            const action = getOrganizationById({
                getOrganizationByIdActivity: mockGetOrgActivity,
                getWorkosOrganizationActivity: mockGetWorkosActivity,
            });

            const result = await action('org-123');

            expect(result).toBeDefined();
            expect(result?.id).toBe('org-123');
            expect(result?.workosData).toEqual(mockWorkosOrg);
            expect(mockGetOrgActivity).toHaveBeenCalledWith('org-123');
            expect(mockGetWorkosActivity).toHaveBeenCalledWith('workos-org-123');
        });

        it('should return organization without WorkOS data when workosOrganizationId is null', async () => {
            const mockOrg: Organization = {
                id: 'org-123',
                name: 'Test Org',
                email: 'test@example.com',
                description: null,
                phone: null,
                website: null,
                address: null,
                workosOrganizationId: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockGetOrgActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            const mockGetWorkosActivity = vi.fn();

            const action = getOrganizationById({
                getOrganizationByIdActivity: mockGetOrgActivity,
                getWorkosOrganizationActivity: mockGetWorkosActivity,
            });

            const result = await action('org-123');

            expect(result).toEqual(mockOrg);
            expect(result?.workosData).toBeUndefined();
            expect(mockGetOrgActivity).toHaveBeenCalledWith('org-123');
            expect(mockGetWorkosActivity).not.toHaveBeenCalled();
        });

        it('should return organization without WorkOS data when WorkOS fetch fails', async () => {
            const mockOrg: Organization = {
                id: 'org-123',
                name: 'Test Org',
                email: 'test@example.com',
                description: null,
                phone: null,
                website: null,
                address: null,
                workosOrganizationId: 'workos-org-123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockGetOrgActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            const mockGetWorkosActivity = vi.fn().mockResolvedValue({
                ok: false,
                error: { code: 'WORKOS_ERROR', message: 'WorkOS API failed' },
            });

            const action = getOrganizationById({
                getOrganizationByIdActivity: mockGetOrgActivity,
                getWorkosOrganizationActivity: mockGetWorkosActivity,
            });

            const result = await action('org-123');

            // WorkOSデータ取得失敗でもDBデータは返される
            expect(result).toEqual(mockOrg);
            expect(result?.workosData).toBeUndefined();
            expect(mockGetWorkosActivity).toHaveBeenCalledWith('workos-org-123');
        });
    });

    describe('getOrganizationByWorkosId', () => {
        it('should return organization when found by WorkOS ID', async () => {
            const mockOrg: Organization = {
                id: 'org-123',
                name: 'Test Org',
                email: 'test@example.com',
                description: null,
                phone: null,
                website: null,
                address: null,
                workosOrganizationId: 'workos-org-123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-123',
                name: 'Test Org',
                domains: [{ domain: 'example.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const mockGetOrgActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            const mockGetWorkosActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockWorkosOrg,
            });

            const action = getOrganizationByWorkosId({
                getOrganizationByWorkosIdActivity: mockGetOrgActivity,
                getWorkosOrganizationActivity: mockGetWorkosActivity,
            });

            const result = await action('workos-org-123');

            expect(result).toBeDefined();
            expect(result?.id).toBe('org-123');
            expect(result?.workosData).toEqual(mockWorkosOrg);
            expect(mockGetOrgActivity).toHaveBeenCalledWith('workos-org-123');
            expect(mockGetWorkosActivity).toHaveBeenCalledWith('workos-org-123');
        });

        it('should return null when organization not found by WorkOS ID', async () => {
            const mockGetOrgActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: null,
            });

            const action = getOrganizationByWorkosId({
                getOrganizationByWorkosIdActivity: mockGetOrgActivity,
            });

            const result = await action('non-existent-workos-id');

            expect(result).toBeNull();
            expect(mockGetOrgActivity).toHaveBeenCalledWith('non-existent-workos-id');
        });

        it('should throw error when activity fails', async () => {
            const mockGetOrgActivity = vi.fn().mockResolvedValue({
                ok: false,
                error: {
                    code: OrganizationErrorCode.DATABASE,
                    message: 'Database query failed',
                },
            });

            const action = getOrganizationByWorkosId({
                getOrganizationByWorkosIdActivity: mockGetOrgActivity,
            });

            await expect(action('workos-org-123')).rejects.toThrow('Failed to get organization: Database query failed');
        });
    });

    describe('listOrganizations with WorkOS integration', () => {
        it('should return organizations list with WorkOS data', async () => {
            const mockOrgs: Organization[] = [
                {
                    id: 'org-1',
                    name: 'Org 1',
                    email: 'org1@example.com',
                    description: null,
                    phone: null,
                    website: null,
                    address: null,
                    workosOrganizationId: 'workos-org-1',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: 'org-2',
                    name: 'Org 2',
                    email: 'org2@example.com',
                    description: null,
                    phone: null,
                    website: null,
                    address: null,
                    workosOrganizationId: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockWorkosOrg: WorkosOrganization = {
                id: 'workos-org-1',
                name: 'Org 1',
                domains: [{ domain: 'org1.com', state: 'verified' }],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const mockListActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrgs,
            });

            const mockGetWorkosActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockWorkosOrg,
            });

            const action = listOrganizations({
                listOrganizationsActivity: mockListActivity,
                getWorkosOrganizationActivity: mockGetWorkosActivity,
            });

            const result = await action({ limit: 20, offset: 0 });

            expect(result).toHaveLength(2);
            expect(result[0]?.workosData).toEqual(mockWorkosOrg);
            expect(result[1]?.workosData).toBeUndefined();
            expect(mockListActivity).toHaveBeenCalledWith({ limit: 20, offset: 0 });
            expect(mockGetWorkosActivity).toHaveBeenCalledWith('workos-org-1');
            expect(mockGetWorkosActivity).toHaveBeenCalledTimes(1);
        });

        it('should handle WorkOS fetch failures gracefully', async () => {
            const mockOrgs: Organization[] = [
                {
                    id: 'org-1',
                    name: 'Org 1',
                    email: 'org1@example.com',
                    description: null,
                    phone: null,
                    website: null,
                    address: null,
                    workosOrganizationId: 'workos-org-1',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const mockListActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrgs,
            });

            const mockGetWorkosActivity = vi.fn().mockRejectedValue(new Error('WorkOS API Error'));

            const action = listOrganizations({
                listOrganizationsActivity: mockListActivity,
                getWorkosOrganizationActivity: mockGetWorkosActivity,
            });

            const result = await action({ limit: 20, offset: 0 });

            // WorkOSデータ取得失敗でもDBデータは返される
            expect(result).toHaveLength(1);
            expect(result[0]?.workosData).toBeUndefined();
        });
    });
});
