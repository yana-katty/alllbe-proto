/**
 * Organization Actions テスト
 * 
 * Actions層のテストは、Activity関数をモックして、
 * ビジネスロジックのみをテストします。
 */

import { describe, it, expect, vi } from 'vitest';
import { getOrganizationById, getOrganizationByEmail, listOrganizations } from './organization';
import type { Organization } from '../activities/db/schema';
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
});
