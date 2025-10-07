/**
 * Brand Activity テスト (PGlite版)
 * 
 * PGliteを使用した実際のDB操作テスト
 * モックではなく、実際のPostgreSQL互換環境でテストすることで信頼性を向上
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    insertBrand,
    findBrandById,
    findBrandsByOrganizationId,
    findDefaultBrandByOrganizationId,
    updateBrand,
    deleteBrand,
    countBrandsByOrganizationId,
    BrandErrorType,
    type BrandCreateInput,
    type BrandUpdateInput,
} from './brand';
import {
    setupTestDb,
    teardownTestDb,
    cleanDatabase,
    createTestOrganization,
} from '../../../test/setup';
import type { Database } from '../connection';

describe('Brand Activity Functions (PGlite)', () => {
    let db: Database;

    beforeAll(async () => {
        db = await setupTestDb();
    });

    afterAll(async () => {
        await teardownTestDb();
    });

    beforeEach(async () => {
        await cleanDatabase();
    });

    describe('insertBrand', () => {
        it('should create brand successfully', async () => {
            const orgId = await createTestOrganization('org_test_1');

            const input: BrandCreateInput = {
                organizationId: orgId,
                name: 'Test Brand',
                description: 'Test Description',
                isDefault: false,
            };

            const insertFn = insertBrand(db);
            const result = await insertFn(input);

            expect(result.id).toBeDefined();
            expect(result.organizationId).toBe(orgId);
            expect(result.name).toBe('Test Brand');
            expect(result.description).toBe('Test Description');
            expect(result.isDefault).toBe(false);
            expect(result.isActive).toBe(true);
        });

        it('should create brand with default flag', async () => {
            const orgId = await createTestOrganization('org_test_2');

            const input: BrandCreateInput = {
                organizationId: orgId,
                name: 'Default Brand',
                isDefault: true,
            };

            const insertFn = insertBrand(db);
            const result = await insertFn(input);

            expect(result.isDefault).toBe(true);
        });

        it('should throw BRAND_INVALID_INPUT for invalid input', async () => {
            const input = {
                organizationId: '',
                name: '',
                isDefault: false,
            } as BrandCreateInput;

            const insertFn = insertBrand(db);

            await expect(insertFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await insertFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.INVALID_INPUT);
            }
        });
    });

    describe('findBrandById', () => {
        it('should return brand when found', async () => {
            const orgId = await createTestOrganization('org_test_3');

            const input: BrandCreateInput = {
                organizationId: orgId,
                name: 'Findable Brand',
                isDefault: false,
            };

            const insertFn = insertBrand(db);
            const created = await insertFn(input);

            const findFn = findBrandById(db);
            const result = await findFn(created.id);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(created.id);
            expect(result?.name).toBe('Findable Brand');
        });

        it('should return null when brand not found', async () => {
            const findFn = findBrandById(db);
            const result = await findFn('00000000-0000-0000-0000-000000000000');

            expect(result).toBeNull();
        });
    });

    describe('findBrandsByOrganizationId', () => {
        it('should return list of brands for organization', async () => {
            const orgId = await createTestOrganization('org_test_4');

            const insertFn = insertBrand(db);
            await insertFn({
                organizationId: orgId,
                name: 'Brand 1',
                isDefault: true,
            });
            await insertFn({
                organizationId: orgId,
                name: 'Brand 2',
                isDefault: false,
            });

            const findFn = findBrandsByOrganizationId(db);
            const result = await findFn({ organizationId: orgId });

            expect(result).toHaveLength(2);
            expect(result[0].organizationId).toBe(orgId);
            expect(result[1].organizationId).toBe(orgId);
        });

        it('should filter by isActive when specified', async () => {
            const orgId = await createTestOrganization('org_test_5');

            const insertFn = insertBrand(db);
            await insertFn({
                organizationId: orgId,
                name: 'Active Brand',
                isDefault: false,
            });

            // Brand2を作成後、非アクティブ化
            const brand2 = await insertFn({
                organizationId: orgId,
                name: 'Inactive Brand',
                isDefault: false,
            });
            const updateFn = updateBrand(db);
            await updateFn(brand2.id, { isActive: false });

            const findFn = findBrandsByOrganizationId(db);
            const activeResult = await findFn({ organizationId: orgId, isActive: true });

            expect(activeResult).toHaveLength(1);
            expect(activeResult[0].name).toBe('Active Brand');
        });

        it('should return empty array when no brands found', async () => {
            const orgId = await createTestOrganization('org_test_6');

            const findFn = findBrandsByOrganizationId(db);
            const result = await findFn({ organizationId: orgId });

            expect(result).toEqual([]);
        });
    });

    describe('findDefaultBrandByOrganizationId', () => {
        it('should return default brand for organization', async () => {
            const orgId = await createTestOrganization('org_test_7');

            const insertFn = insertBrand(db);
            await insertFn({
                organizationId: orgId,
                name: 'Default Brand',
                isDefault: true,
            });
            await insertFn({
                organizationId: orgId,
                name: 'Non-default Brand',
                isDefault: false,
            });

            const findFn = findDefaultBrandByOrganizationId(db);
            const result = await findFn(orgId);

            expect(result).not.toBeNull();
            expect(result?.isDefault).toBe(true);
            expect(result?.name).toBe('Default Brand');
        });

        it('should return null when no default brand found', async () => {
            const orgId = await createTestOrganization('org_test_8');

            const findFn = findDefaultBrandByOrganizationId(db);
            const result = await findFn(orgId);

            expect(result).toBeNull();
        });
    });

    describe('updateBrand', () => {
        it('should update brand successfully', async () => {
            const orgId = await createTestOrganization('org_test_9');

            const insertFn = insertBrand(db);
            const created = await insertFn({
                organizationId: orgId,
                name: 'Old Name',
                isDefault: false,
            });

            const patch: BrandUpdateInput = {
                name: 'New Name',
                description: 'Updated Description',
            };

            const updateFn = updateBrand(db);
            const result = await updateFn(created.id, patch);

            expect(result.name).toBe('New Name');
            expect(result.description).toBe('Updated Description');
            expect(result.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });

        it('should throw BRAND_NOT_FOUND when brand does not exist', async () => {
            const patch: BrandUpdateInput = {
                name: 'New Name',
            };

            const updateFn = updateBrand(db);

            await expect(updateFn('00000000-0000-0000-0000-000000000000', patch)).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn('00000000-0000-0000-0000-000000000000', patch);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.NOT_FOUND);
            }
        });
    });

    describe('deleteBrand', () => {
        it('should delete brand successfully', async () => {
            const orgId = await createTestOrganization('org_test_10');

            const insertFn = insertBrand(db);
            const created = await insertFn({
                organizationId: orgId,
                name: 'To be deleted',
                isDefault: false,
            });

            const deleteFn = deleteBrand(db);
            const result = await deleteFn(created.id);

            expect(result).toBe(true);

            // 削除されたことを確認
            const findFn = findBrandById(db);
            const found = await findFn(created.id);
            expect(found).toBeNull();
        });

        it('should throw BRAND_NOT_FOUND when brand does not exist', async () => {
            const deleteFn = deleteBrand(db);

            await expect(deleteFn('00000000-0000-0000-0000-000000000000')).rejects.toThrow(ApplicationFailure);

            try {
                await deleteFn('00000000-0000-0000-0000-000000000000');
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.NOT_FOUND);
            }
        });
    });

    describe('countBrandsByOrganizationId', () => {
        it('should count brands correctly', async () => {
            const orgId = await createTestOrganization('org_test_11');

            const insertFn = insertBrand(db);
            await insertFn({
                organizationId: orgId,
                name: 'Brand 1',
                isDefault: false,
            });
            await insertFn({
                organizationId: orgId,
                name: 'Brand 2',
                isDefault: false,
            });

            const countFn = countBrandsByOrganizationId(db);
            const result = await countFn(orgId);

            expect(result).toBe(2);
        });

        it('should return 0 when no brands found', async () => {
            const orgId = await createTestOrganization('org_test_12');

            const countFn = countBrandsByOrganizationId(db);
            const result = await countFn(orgId);

            expect(result).toBe(0);
        });
    });
});
