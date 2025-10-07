/**
 * ExperienceAsset Actions Tests
 * 
 * Actions層のテスト:
 * - Activity関数をモック
 * - ビジネスロジックのみをテスト
 * - ApplicationFailure の型安全なエラーハンドリングを検証
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createExperienceAsset,
    getExperienceAssetById,
    listExperienceAssets,
    listExperienceAssetsByExperience,
    updateExperienceAsset,
    deleteExperienceAsset,
} from './experienceAsset';
import { ApplicationFailure } from '@temporalio/common';
import { ExperienceAssetErrorType } from '../activities/db/models/experienceAssets';
import type { ExperienceAsset } from '../activities/db/schema';

describe('ExperienceAsset Actions', () => {
    const mockAsset: ExperienceAsset = {
        id: 'asset-123',
        experienceId: 'exp-123',
        title: 'Test Asset',
        description: 'Test Description',
        assetType: 'video',
        assetUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        contentTiming: 'before',
        category: 'story',
        categoryLabel: null,
        accessLevel: 'public',
        displayOrder: '0',
        fileSize: '100MB',
        duration: '5:30',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    describe('createExperienceAsset', () => {
        it('should create asset successfully', async () => {
            const mockActivity = vi.fn().mockResolvedValue(mockAsset);

            const action = createExperienceAsset({ insertExperienceAssetActivity: mockActivity });
            const result = await action({
                experienceId: 'exp-123',
                title: 'Test Asset',
                assetType: 'video',
                assetUrl: 'https://example.com/video.mp4',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: '0',
            });

            expect(result).toEqual(mockAsset);
            expect(mockActivity).toHaveBeenCalledWith({
                experienceId: 'exp-123',
                title: 'Test Asset',
                assetType: 'video',
                assetUrl: 'https://example.com/video.mp4',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: '0',
            });
        });

        it('should throw error when creation fails', async () => {
            const mockActivity = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Database error',
                    type: ExperienceAssetErrorType.DATABASE_ERROR,
                })
            );

            const action = createExperienceAsset({ insertExperienceAssetActivity: mockActivity });

            await expect(action({
                experienceId: 'exp-123',
                title: 'Test Asset',
                assetType: 'video',
                assetUrl: 'https://example.com/video.mp4',
                contentTiming: 'before',
                accessLevel: 'public',
                displayOrder: '0',
            })).rejects.toThrow(ApplicationFailure);
        });
    });

    describe('getExperienceAssetById', () => {
        it('should return asset when found', async () => {
            const mockActivity = vi.fn().mockResolvedValue(mockAsset);

            const action = getExperienceAssetById({ findExperienceAssetByIdActivity: mockActivity });
            const result = await action('asset-123');

            expect(result).toEqual(mockAsset);
            expect(mockActivity).toHaveBeenCalledWith('asset-123');
        });

        it('should return null when not found', async () => {
            const mockActivity = vi.fn().mockResolvedValue(null);

            const action = getExperienceAssetById({ findExperienceAssetByIdActivity: mockActivity });
            const result = await action('non-existent');

            expect(result).toBeNull();
            expect(mockActivity).toHaveBeenCalledWith('non-existent');
        });
    });

    describe('listExperienceAssets', () => {
        it('should return asset list', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockAsset]);

            const action = listExperienceAssets({ listExperienceAssetsActivity: mockActivity });
            const result = await action({ limit: 50, offset: 0 });

            expect(result).toEqual([mockAsset]);
            expect(result).toHaveLength(1);
            expect(mockActivity).toHaveBeenCalledWith({ limit: 50, offset: 0 });
        });

        it('should filter by experienceId', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockAsset]);

            const action = listExperienceAssets({ listExperienceAssetsActivity: mockActivity });
            const result = await action({ experienceId: 'exp-123', limit: 50, offset: 0 });

            expect(result).toEqual([mockAsset]);
            expect(mockActivity).toHaveBeenCalledWith({ experienceId: 'exp-123', limit: 50, offset: 0 });
        });

        it('should filter by contentTiming', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockAsset]);

            const action = listExperienceAssets({ listExperienceAssetsActivity: mockActivity });
            const result = await action({ contentTiming: 'before', limit: 50, offset: 0 });

            expect(result).toEqual([mockAsset]);
            expect(mockActivity).toHaveBeenCalledWith({ contentTiming: 'before', limit: 50, offset: 0 });
        });
    });

    describe('listExperienceAssetsByExperience', () => {
        it('should return assets for specific experience', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockAsset]);

            const action = listExperienceAssetsByExperience({ listExperienceAssetsByExperienceActivity: mockActivity });
            const result = await action('exp-123');

            expect(result).toEqual([mockAsset]);
            expect(mockActivity).toHaveBeenCalledWith('exp-123', undefined);
        });

        it('should pass optional params', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockAsset]);

            const action = listExperienceAssetsByExperience({ listExperienceAssetsByExperienceActivity: mockActivity });
            const result = await action('exp-123', { contentTiming: 'after', limit: 10 });

            expect(result).toEqual([mockAsset]);
            expect(mockActivity).toHaveBeenCalledWith('exp-123', { contentTiming: 'after', limit: 10 });
        });
    });

    describe('updateExperienceAsset', () => {
        it('should update asset successfully', async () => {
            const updatedAsset = { ...mockAsset, title: 'Updated Title' };
            const mockActivity = vi.fn().mockResolvedValue(updatedAsset);

            const action = updateExperienceAsset({ updateExperienceAssetActivity: mockActivity });
            const result = await action('asset-123', { title: 'Updated Title' });

            expect(result.title).toBe('Updated Title');
            expect(mockActivity).toHaveBeenCalledWith('asset-123', { title: 'Updated Title' });
        });

        it('should throw error when update fails', async () => {
            const mockActivity = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Asset not found',
                    type: ExperienceAssetErrorType.NOT_FOUND,
                })
            );

            const action = updateExperienceAsset({ updateExperienceAssetActivity: mockActivity });

            await expect(action('non-existent', { title: 'Updated' })).rejects.toThrow(ApplicationFailure);
        });
    });

    describe('deleteExperienceAsset', () => {
        it('should delete asset successfully', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(mockAsset);
            const mockRemoveActivity = vi.fn().mockResolvedValue(true);

            const action = deleteExperienceAsset({
                findExperienceAssetByIdActivity: mockFindActivity,
                removeExperienceAssetActivity: mockRemoveActivity,
            });

            const result = await action('asset-123');

            expect(result).toBe(true);
            expect(mockFindActivity).toHaveBeenCalledWith('asset-123');
            expect(mockRemoveActivity).toHaveBeenCalledWith('asset-123');
        });

        it('should throw error when asset not found', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(null);
            const mockRemoveActivity = vi.fn();

            const action = deleteExperienceAsset({
                findExperienceAssetByIdActivity: mockFindActivity,
                removeExperienceAssetActivity: mockRemoveActivity,
            });

            await expect(action('non-existent')).rejects.toThrow(ApplicationFailure);

            try {
                await action('non-existent');
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(ExperienceAssetErrorType.NOT_FOUND);
            }

            expect(mockRemoveActivity).not.toHaveBeenCalled();
        });
    });
});
