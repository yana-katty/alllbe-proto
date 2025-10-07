/**
 * Experience Activity テスト (PGlite版)
 * 
 * PGliteを使用した実際のDB操作テスト
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    insertExperience,
    findExperienceById,
    listExperiences,
    listExperiencesByBrand,
    updateExperience,
    removeExperience,
    ExperienceErrorType,
    type ExperienceCreateInput,
    type ExperienceUpdateInput,
    type ExperienceQueryInput,
} from './experience';
import {
    setupTestDb,
    teardownTestDb,
    cleanDatabase,
    createTestOrganization,
} from '../../../test/setup';
import type { Database } from '../connection';
import { insertBrand } from './brand';
import type { BrandCreateInput } from './brand';

describe('Experience Activity Functions (PGlite)', () => {
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

    /**
     * テスト用ヘルパー: Brand を作成
     */
    async function createTestBrand(orgId: string, name: string = 'Test Brand'): Promise<string> {
        const input: BrandCreateInput = {
            organizationId: orgId,
            name,
            isDefault: false,
        };
        const insertFn = insertBrand(db);
        const result = await insertFn(input);
        return result.id;
    }

    describe('insertExperience', () => {
        it('should create experience successfully', async () => {
            const orgId = await createTestOrganization('org_test_1');
            const brandId = await createTestBrand(orgId);

            const input: ExperienceCreateInput = {
                brandId,
                title: 'Test Experience',
                description: 'Test Description',
                location: 'Tokyo',
                capacity: '100',
                price: '5000',
                experienceType: 'scheduled',
                scheduledStartAt: new Date('2025-12-01T10:00:00Z'),
                scheduledEndAt: new Date('2025-12-01T12:00:00Z'),
                status: 'draft',
            };

            const insertFn = insertExperience(db);
            const result = await insertFn(input);

            expect(result.id).toBeDefined();
            expect(result.brandId).toBe(brandId);
            expect(result.title).toBe('Test Experience');
            expect(result.description).toBe('Test Description');
            expect(result.location).toBe('Tokyo');
            expect(result.capacity).toBe('100');
            expect(result.price).toBe('5000');
            expect(result.experienceType).toBe('scheduled');
            expect(result.status).toBe('draft');
            expect(result.isActive).toBe(true);
        });

        it('should create experience with period type', async () => {
            const orgId = await createTestOrganization('org_test_2');
            const brandId = await createTestBrand(orgId);

            const input: ExperienceCreateInput = {
                brandId,
                title: 'Period Experience',
                experienceType: 'period',
                periodStartDate: new Date('2025-12-01'),
                periodEndDate: new Date('2025-12-31'),
                status: 'published',
            };

            const insertFn = insertExperience(db);
            const result = await insertFn(input);

            expect(result.experienceType).toBe('period');
            expect(result.periodStartDate).toEqual(new Date('2025-12-01'));
            expect(result.periodEndDate).toEqual(new Date('2025-12-31'));
            expect(result.status).toBe('published');
        });

        it('should throw EXPERIENCE_INVALID_INPUT for invalid input', async () => {
            const input = {
                brandId: '',
                title: '',
            } as ExperienceCreateInput;

            const insertFn = insertExperience(db);

            await expect(insertFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await insertFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(ExperienceErrorType.INVALID_INPUT);
            }
        });
    });

    describe('findExperienceById', () => {
        it('should return experience when found', async () => {
            const orgId = await createTestOrganization('org_test_3');
            const brandId = await createTestBrand(orgId);

            const input: ExperienceCreateInput = {
                brandId,
                title: 'Findable Experience',
                experienceType: 'scheduled',
                status: 'draft',
            };

            const insertFn = insertExperience(db);
            const created = await insertFn(input);

            const findFn = findExperienceById(db);
            const result = await findFn(created.id);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(created.id);
            expect(result?.title).toBe('Findable Experience');
        });

        it('should return null when experience not found', async () => {
            const findFn = findExperienceById(db);
            const result = await findFn('00000000-0000-0000-0000-000000000000');

            expect(result).toBeNull();
        });
    });

    describe('listExperiences', () => {
        it('should return list of experiences with limit and offset', async () => {
            const orgId = await createTestOrganization('org_test_4');
            const brandId = await createTestBrand(orgId);

            const insertFn = insertExperience(db);
            await insertFn({
                brandId,
                title: 'Experience 1',
                experienceType: 'scheduled',
                status: 'draft',
            });
            await insertFn({
                brandId,
                title: 'Experience 2',
                experienceType: 'period',
                status: 'published',
            });
            await insertFn({
                brandId,
                title: 'Experience 3',
                experienceType: 'flexible',
                status: 'published',
            });

            const listFn = listExperiences(db);
            const result = await listFn({ limit: 20, offset: 0 });

            expect(result.length).toBeGreaterThanOrEqual(3);
        });

        it('should filter by status when specified', async () => {
            const orgId = await createTestOrganization('org_test_5');
            const brandId = await createTestBrand(orgId);

            const insertFn = insertExperience(db);
            await insertFn({
                brandId,
                title: 'Draft Experience',
                experienceType: 'scheduled',
                status: 'draft',
            });
            await insertFn({
                brandId,
                title: 'Published Experience',
                experienceType: 'scheduled',
                status: 'published',
            });

            const listFn = listExperiences(db);
            const result = await listFn({ limit: 20, offset: 0, status: 'published' });

            expect(result.every(exp => exp.status === 'published')).toBe(true);
        });

        it('should filter by isActive when specified', async () => {
            const orgId = await createTestOrganization('org_test_6');
            const brandId = await createTestBrand(orgId);

            const insertFn = insertExperience(db);
            const exp1 = await insertFn({
                brandId,
                title: 'Active Experience',
                experienceType: 'scheduled',
                status: 'draft',
            });

            // 非アクティブ化（status変更で代用）
            const updateFn = updateExperience(db);
            await updateFn(exp1.id, { status: 'archived' });

            await insertFn({
                brandId,
                title: 'Another Active',
                experienceType: 'scheduled',
                status: 'draft',
            });

            const listFn = listExperiences(db);
            const activeResult = await listFn({ limit: 20, offset: 0, isActive: true });

            expect(activeResult.every(exp => exp.isActive === true)).toBe(true);
        });

        it('should return empty array when no experiences found', async () => {
            const listFn = listExperiences(db);
            const result = await listFn({ limit: 20, offset: 0, status: 'archived' });

            expect(result).toEqual([]);
        });
    });

    describe('listExperiencesByBrand', () => {
        it('should return list of experiences for a specific brand', async () => {
            const orgId = await createTestOrganization('org_test_7');
            const brandId1 = await createTestBrand(orgId, 'Brand 1');
            const brandId2 = await createTestBrand(orgId, 'Brand 2');

            const insertFn = insertExperience(db);
            await insertFn({
                brandId: brandId1,
                title: 'Brand1 Exp 1',
                experienceType: 'scheduled',
                status: 'draft',
            });
            await insertFn({
                brandId: brandId1,
                title: 'Brand1 Exp 2',
                experienceType: 'period',
                status: 'published',
            });
            await insertFn({
                brandId: brandId2,
                title: 'Brand2 Exp 1',
                experienceType: 'scheduled',
                status: 'draft',
            });

            const listFn = listExperiencesByBrand(db);
            const result = await listFn(brandId1);

            expect(result).toHaveLength(2);
            expect(result.every(exp => exp.brandId === brandId1)).toBe(true);
        });

        it('should return empty array when brand has no experiences', async () => {
            const orgId = await createTestOrganization('org_test_8');
            const brandId = await createTestBrand(orgId);

            const listFn = listExperiencesByBrand(db);
            const result = await listFn(brandId);

            expect(result).toEqual([]);
        });
    });

    describe('updateExperience', () => {
        it('should update experience successfully', async () => {
            const orgId = await createTestOrganization('org_test_9');
            const brandId = await createTestBrand(orgId);

            const insertFn = insertExperience(db);
            const created = await insertFn({
                brandId,
                title: 'Old Title',
                description: 'Old Description',
                experienceType: 'scheduled',
                status: 'draft',
            });

            const patch: ExperienceUpdateInput = {
                title: 'New Title',
                description: 'New Description',
                status: 'published',
            };

            const updateFn = updateExperience(db);
            const result = await updateFn(created.id, patch);

            expect(result.title).toBe('New Title');
            expect(result.description).toBe('New Description');
            expect(result.status).toBe('published');
            expect(result.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });

        it('should update partial fields successfully', async () => {
            const orgId = await createTestOrganization('org_test_10');
            const brandId = await createTestBrand(orgId);

            const insertFn = insertExperience(db);
            const created = await insertFn({
                brandId,
                title: 'Original Title',
                price: '1000',
                experienceType: 'scheduled',
                status: 'draft',
            });

            const patch: ExperienceUpdateInput = {
                price: '2000',
            };

            const updateFn = updateExperience(db);
            const result = await updateFn(created.id, patch);

            expect(result.title).toBe('Original Title'); // 変更なし
            expect(result.price).toBe('2000'); // 更新
        });

        it('should throw EXPERIENCE_NOT_FOUND when experience does not exist', async () => {
            const patch: ExperienceUpdateInput = {
                title: 'New Title',
            };

            const updateFn = updateExperience(db);

            await expect(updateFn('00000000-0000-0000-0000-000000000000', patch)).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn('00000000-0000-0000-0000-000000000000', patch);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(ExperienceErrorType.NOT_FOUND);
            }
        });
    });

    describe('removeExperience', () => {
        it('should delete experience successfully', async () => {
            const orgId = await createTestOrganization('org_test_11');
            const brandId = await createTestBrand(orgId);

            const insertFn = insertExperience(db);
            const created = await insertFn({
                brandId,
                title: 'To Be Deleted',
                experienceType: 'scheduled',
                status: 'draft',
            });

            const removeFn = removeExperience(db);
            const result = await removeFn(created.id);

            expect(result).toBe(true);

            // 削除確認
            const findFn = findExperienceById(db);
            const found = await findFn(created.id);
            expect(found).toBeNull();
        });

        it('should return false when experience does not exist', async () => {
            const removeFn = removeExperience(db);
            const result = await removeFn('00000000-0000-0000-0000-000000000000');

            expect(result).toBe(false);
        });
    });
});
