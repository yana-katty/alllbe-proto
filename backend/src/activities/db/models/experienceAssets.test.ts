/**
 * ExperienceAsset Activity テスト (PGlite版)
 * 
 * PGliteを使用した実際のDB操作テスト
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    insertExperienceAsset,
    findExperienceAssetById,
    listExperienceAssets,
    listExperienceAssetsByExperience,
    updateExperienceAsset,
    removeExperienceAsset,
    ExperienceAssetErrorType,
    type ExperienceAssetCreateInput,
    type ExperienceAssetUpdateInput,
    type ExperienceAssetQueryInput,
} from './experienceAssets';
import {
    setupTestDb,
    teardownTestDb,
    cleanDatabase,
    createTestOrganization,
} from '../../../test/setup';
import type { Database } from '../connection';
import { insertBrand } from './brand';
import type { BrandCreateInput } from './brand';
import { insertExperience } from './experience';
import type { ExperienceCreateInput } from './experience';

describe('ExperienceAsset Activity Functions (PGlite)', () => {
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

    /**
     * テスト用ヘルパー: Experience を作成
     */
    async function createTestExperience(brandId: string, title: string = 'Test Experience'): Promise<string> {
        const input: ExperienceCreateInput = {
            brandId,
            title,
            experienceType: 'scheduled',
            status: 'draft',
        };
        const insertFn = insertExperience(db);
        const result = await insertFn(input);
        return result.id;
    }

    describe('insertExperienceAsset', () => {
        it('should create experience asset successfully', async () => {
            const orgId = await createTestOrganization('org_test_1');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const input: ExperienceAssetCreateInput = {
                experienceId,
                title: 'Test Asset',
                description: 'Test Description',
                assetType: 'video',
                assetUrl: 'https://example.com/video.mp4',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            };

            const insertFn = insertExperienceAsset(db);
            const result = await insertFn(input);

            expect(result.id).toBeDefined();
            expect(result.experienceId).toBe(experienceId);
            expect(result.title).toBe('Test Asset');
            expect(result.description).toBe('Test Description');
            expect(result.assetType).toBe('video');
            expect(result.assetUrl).toBe('https://example.com/video.mp4');
            expect(result.contentTiming).toBe('before');
            expect(result.accessLevel).toBe('public');
            expect(result.displayOrder).toBe(1);
            expect(result.isActive).toBe(true);
        });

        it('should create experience asset with minimal fields', async () => {
            const orgId = await createTestOrganization('org_test_2');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const input: ExperienceAssetCreateInput = {
                experienceId,
                title: 'Minimal Asset',
                assetType: 'article',
                assetUrl: 'https://example.com/article',
                contentTiming: 'after',
                accessLevel: 'attended',
                displayOrder: 1,
            };

            const insertFn = insertExperienceAsset(db);
            const result = await insertFn(input);

            expect(result.title).toBe('Minimal Asset');
            expect(result.assetType).toBe('article');
            expect(result.accessLevel).toBe('attended');
        });

        it('should throw EXPERIENCE_ASSET_INVALID_INPUT for invalid input', async () => {
            const input = {
                experienceId: '',
                title: '',
                assetType: 'video',
                assetUrl: '',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            } as ExperienceAssetCreateInput;

            const insertFn = insertExperienceAsset(db);

            await expect(insertFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await insertFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(ExperienceAssetErrorType.INVALID_INPUT);
            }
        });
    });

    describe('findExperienceAssetById', () => {
        it('should return asset when found', async () => {
            const orgId = await createTestOrganization('org_test_3');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const input: ExperienceAssetCreateInput = {
                experienceId,
                title: 'Findable Asset',
                assetType: 'image',
                assetUrl: 'https://example.com/image.jpg',
                contentTiming: 'anytime',
                accessLevel: 'ticket_holder',
                displayOrder: 1,
            };

            const insertFn = insertExperienceAsset(db);
            const created = await insertFn(input);

            const findFn = findExperienceAssetById(db);
            const result = await findFn(created.id);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(created.id);
            expect(result?.title).toBe('Findable Asset');
        });

        it('should return null when asset not found', async () => {
            const findFn = findExperienceAssetById(db);
            const result = await findFn('00000000-0000-0000-0000-000000000000');

            expect(result).toBeNull();
        });
    });

    describe('listExperienceAssets', () => {
        it('should return list of assets with limit and offset', async () => {
            const orgId = await createTestOrganization('org_test_4');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const insertFn = insertExperienceAsset(db);
            await insertFn({
                experienceId,
                title: 'Asset 1',
                assetType: 'video',
                assetUrl: 'https://example.com/1',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });
            await insertFn({
                experienceId,
                title: 'Asset 2',
                assetType: 'image',
                assetUrl: 'https://example.com/2',
                contentTiming: 'after',
                accessLevel: 'attended',
                displayOrder: 1,
            });

            const listFn = listExperienceAssets(db);
            const result = await listFn({ limit: 20, offset: 0 });

            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('should filter by assetType when specified', async () => {
            const orgId = await createTestOrganization('org_test_5');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const insertFn = insertExperienceAsset(db);
            await insertFn({
                experienceId,
                title: 'Video Asset',
                assetType: 'video',
                assetUrl: 'https://example.com/video',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });
            await insertFn({
                experienceId,
                title: 'Image Asset',
                assetType: 'image',
                assetUrl: 'https://example.com/image',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });

            const listFn = listExperienceAssets(db);
            const result = await listFn({ limit: 20, offset: 0, assetType: 'video' });

            expect(result.every(asset => asset.assetType === 'video')).toBe(true);
        });

        it('should filter by accessLevel when specified', async () => {
            const orgId = await createTestOrganization('org_test_6');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const insertFn = insertExperienceAsset(db);
            await insertFn({
                experienceId,
                title: 'Public Asset',
                assetType: 'article',
                assetUrl: 'https://example.com/public',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });
            await insertFn({
                experienceId,
                title: 'Attended Asset',
                assetType: 'article',
                assetUrl: 'https://example.com/attended',
                contentTiming: 'after',
                accessLevel: 'attended',
                displayOrder: 1,
            });

            const listFn = listExperienceAssets(db);
            const result = await listFn({ limit: 20, offset: 0, accessLevel: 'attended' });

            expect(result.every(asset => asset.accessLevel === 'attended')).toBe(true);
        });
    });

    describe('listExperienceAssetsByExperience', () => {
        it('should return list of assets for a specific experience', async () => {
            const orgId = await createTestOrganization('org_test_7');
            const brandId = await createTestBrand(orgId);
            const experienceId1 = await createTestExperience(brandId, 'Experience 1');
            const experienceId2 = await createTestExperience(brandId, 'Experience 2');

            const insertFn = insertExperienceAsset(db);
            await insertFn({
                experienceId: experienceId1,
                title: 'Exp1 Asset 1',
                assetType: 'video',
                assetUrl: 'https://example.com/1',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });
            await insertFn({
                experienceId: experienceId1,
                title: 'Exp1 Asset 2',
                assetType: 'image',
                assetUrl: 'https://example.com/2',
                contentTiming: 'after',
                accessLevel: 'attended',
                displayOrder: 1,
            });
            await insertFn({
                experienceId: experienceId2,
                title: 'Exp2 Asset 1',
                assetType: 'article',
                assetUrl: 'https://example.com/3',
                contentTiming: 'anytime',
                accessLevel: 'ticket_holder',
                displayOrder: 1,
            });

            const listFn = listExperienceAssetsByExperience(db);
            const result = await listFn(experienceId1);

            expect(result).toHaveLength(2);
            expect(result.every(asset => asset.experienceId === experienceId1)).toBe(true);
        });

        it('should return empty array when experience has no assets', async () => {
            const orgId = await createTestOrganization('org_test_8');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const listFn = listExperienceAssetsByExperience(db);
            const result = await listFn(experienceId);

            expect(result).toEqual([]);
        });
    });

    describe('updateExperienceAsset', () => {
        it('should update asset successfully', async () => {
            const orgId = await createTestOrganization('org_test_9');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const insertFn = insertExperienceAsset(db);
            const created = await insertFn({
                experienceId,
                title: 'Old Title',
                description: 'Old Description',
                assetType: 'video',
                assetUrl: 'https://example.com/old',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });

            const patch: ExperienceAssetUpdateInput = {
                title: 'New Title',
                description: 'New Description',
                displayOrder: 2,
            };

            const updateFn = updateExperienceAsset(db);
            const result = await updateFn(created.id, patch);

            expect(result.title).toBe('New Title');
            expect(result.description).toBe('New Description');
            expect(result.displayOrder).toBe(2);
            expect(result.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });

        it('should throw EXPERIENCE_ASSET_NOT_FOUND when asset does not exist', async () => {
            const patch: ExperienceAssetUpdateInput = {
                title: 'New Title',
            };

            const updateFn = updateExperienceAsset(db);

            await expect(updateFn('00000000-0000-0000-0000-000000000000', patch)).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn('00000000-0000-0000-0000-000000000000', patch);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(ExperienceAssetErrorType.NOT_FOUND);
            }
        });
    });

    describe('removeExperienceAsset', () => {
        it('should delete asset successfully', async () => {
            const orgId = await createTestOrganization('org_test_10');
            const brandId = await createTestBrand(orgId);
            const experienceId = await createTestExperience(brandId);

            const insertFn = insertExperienceAsset(db);
            const created = await insertFn({
                experienceId,
                title: 'To Be Deleted',
                assetType: 'article',
                assetUrl: 'https://example.com/delete',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: 1,
            });

            const removeFn = removeExperienceAsset(db);
            const result = await removeFn(created.id);

            expect(result).toBe(true);

            // 削除確認
            const findFn = findExperienceAssetById(db);
            const found = await findFn(created.id);
            expect(found).toBeNull();
        });

        it('should return false when asset does not exist', async () => {
            const removeFn = removeExperienceAsset(db);
            const result = await removeFn('00000000-0000-0000-0000-000000000000');

            expect(result).toBe(false);
        });
    });
});
