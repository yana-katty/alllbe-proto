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

describe('Organization Actions', () => {
    describe('getOrganizationById', () => {
        it('should return organization when activity succeeds', async () => {
            const mockOrg: Organization = {
                id: 'org_workos_123',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // ApplicationFailure パターン: Activity は直接値を返す
            const mockActivity = vi.fn().mockResolvedValue(mockOrg);

            const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
            const result = await action('org_workos_123');

            expect(result).toEqual(mockOrg);
            expect(mockActivity).toHaveBeenCalledWith('org_workos_123');
        });

        it('should return null when organization does not exist', async () => {
            // ApplicationFailure パターン: null を直接返す
            const mockActivity = vi.fn().mockResolvedValue(null);

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

            // ApplicationFailure パターン: Activity は直接配列を返す
            const mockActivity = vi.fn().mockResolvedValue(mockOrgs);

            const action = listOrganizations({ listOrganizationsActivity: mockActivity });
            const result = await action({ limit: 20, offset: 0 });

            expect(result).toEqual(mockOrgs);
        });
    });
});
