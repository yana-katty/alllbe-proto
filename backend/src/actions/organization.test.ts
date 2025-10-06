/**
 * Organization Actions テスト
 * 
 * Actions層のテストは、Activity関数をモックして、
 * ビジネスロジックのみをテストします。
 * 
 * Note: スキーマ変更により、organizationsテーブルは最小限の情報のみ保持
 * - id: WorkOS Organization ID (主キー)
 * - isActive: プラットフォーム固有の状態
 * - 個人情報・企業情報は WorkOS から取得
 */

import { describe, it, expect, vi } from 'vitest';
import {
    getOrganizationById,
    listOrganizations
} from './organization';
import type { Organization } from '../activities/db/schema';
import type { WorkosOrganization } from '../activities/auth/workos/types';
import { OrganizationErrorCode } from '../activities/db/models/organization';

describe('Organization Actions', () => {
    describe('getOrganizationById', () => {
        it('should return organization when activity succeeds', async () => {
            const mockOrg: Organization = {
                id: 'org_workos_123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: mockOrg,
            });

            const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
            const result = await action('org_workos_123');

            expect(result).toEqual(mockOrg);
            expect(mockActivity).toHaveBeenCalledWith('org_workos_123');
        });

        it('should return null when organization does not exist', async () => {
            const mockActivity = vi.fn().mockResolvedValue({
                ok: true,
                value: null,
            });

            const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
            const result = await action('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('listOrganizations', () => {
        it('should return list of organizations', async () => {
            const mockOrgs: Organization[] = [
                {
                    id: 'org_workos_1',
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
        });
    });
});
