/**
 * Experience Actions Tests
 * 
 * Actions層のテスト:
 * - Activity関数をモック
 * - ビジネスロジックのみをテスト
 * - ApplicationFailure の型安全なエラーハンドリングを検証
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createExperience,
    getExperienceById,
    listExperiences,
    listExperiencesByBrand,
    updateExperience,
    deleteExperience,
} from './experience';
import { ApplicationFailure } from '@temporalio/common';
import { ExperienceErrorType } from '../activities/db/models/experience';
import type { Experience } from '../activities/db/schema';

describe('Experience Actions', () => {
    const mockExperience: Experience = {
        id: 'exp-123',
        brandId: 'brand-123',
        title: 'Test Experience',
        description: 'Test Description',
        location: 'Tokyo',
        duration: '45分',
        capacity: '1-4名',
        minParticipants: null,
        maxParticipants: null,
        price: '¥6,800',
        paymentMethods: null,
        ageRestriction: null,
        notes: null,
        highlights: null,
        experienceType: 'scheduled',
        scheduledStartAt: new Date('2025-10-15T14:00:00Z'),
        scheduledEndAt: new Date('2025-10-15T15:00:00Z'),
        periodStartDate: null,
        periodEndDate: null,
        status: 'draft',
        coverImageUrl: null,
        heroImageUrl: null,
        tags: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    describe('createExperience', () => {
        it('should create experience successfully', async () => {
            const mockActivity = vi.fn().mockResolvedValue(mockExperience);

            const action = createExperience({ insertExperienceActivity: mockActivity });
            const result = await action({
                brandId: 'brand-123',
                title: 'Test Experience',
                experienceType: 'scheduled',
                status: 'draft',
            });

            expect(result).toEqual(mockExperience);
            expect(mockActivity).toHaveBeenCalledWith({
                brandId: 'brand-123',
                title: 'Test Experience',
                experienceType: 'scheduled',
                status: 'draft',
            });
        });

        it('should throw error when creation fails', async () => {
            const mockActivity = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Database error',
                    type: ExperienceErrorType.DATABASE_ERROR,
                })
            );

            const action = createExperience({ insertExperienceActivity: mockActivity });

            await expect(action({
                brandId: 'brand-123',
                title: 'Test Experience',
                experienceType: 'scheduled',
                status: 'draft',
            })).rejects.toThrow(ApplicationFailure);
        });
    });

    describe('getExperienceById', () => {
        it('should return experience when found', async () => {
            const mockActivity = vi.fn().mockResolvedValue(mockExperience);

            const action = getExperienceById({ findExperienceByIdActivity: mockActivity });
            const result = await action('exp-123');

            expect(result).toEqual(mockExperience);
            expect(mockActivity).toHaveBeenCalledWith('exp-123');
        });

        it('should return null when not found', async () => {
            const mockActivity = vi.fn().mockResolvedValue(null);

            const action = getExperienceById({ findExperienceByIdActivity: mockActivity });
            const result = await action('non-existent');

            expect(result).toBeNull();
            expect(mockActivity).toHaveBeenCalledWith('non-existent');
        });
    });

    describe('listExperiences', () => {
        it('should return experience list', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockExperience]);

            const action = listExperiences({ listExperiencesActivity: mockActivity });
            const result = await action({ limit: 20, offset: 0 });

            expect(result).toEqual([mockExperience]);
            expect(result).toHaveLength(1);
            expect(mockActivity).toHaveBeenCalledWith({ limit: 20, offset: 0 });
        });

        it('should filter by brandId', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockExperience]);

            const action = listExperiences({ listExperiencesActivity: mockActivity });
            const result = await action({ brandId: 'brand-123', limit: 20, offset: 0 });

            expect(result).toEqual([mockExperience]);
            expect(mockActivity).toHaveBeenCalledWith({ brandId: 'brand-123', limit: 20, offset: 0 });
        });
    });

    describe('listExperiencesByBrand', () => {
        it('should return experiences for specific brand', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockExperience]);

            const action = listExperiencesByBrand({ listExperiencesByBrandActivity: mockActivity });
            const result = await action('brand-123');

            expect(result).toEqual([mockExperience]);
            expect(mockActivity).toHaveBeenCalledWith('brand-123', undefined);
        });

        it('should pass optional params', async () => {
            const mockActivity = vi.fn().mockResolvedValue([mockExperience]);

            const action = listExperiencesByBrand({ listExperiencesByBrandActivity: mockActivity });
            const result = await action('brand-123', { status: 'published', limit: 10 });

            expect(result).toEqual([mockExperience]);
            expect(mockActivity).toHaveBeenCalledWith('brand-123', { status: 'published', limit: 10 });
        });
    });

    describe('updateExperience', () => {
        it('should update experience successfully', async () => {
            const updatedExperience = { ...mockExperience, title: 'Updated Title' };
            const mockActivity = vi.fn().mockResolvedValue(updatedExperience);

            const action = updateExperience({ updateExperienceActivity: mockActivity });
            const result = await action('exp-123', { title: 'Updated Title' });

            expect(result.title).toBe('Updated Title');
            expect(mockActivity).toHaveBeenCalledWith('exp-123', { title: 'Updated Title' });
        });

        it('should throw error when update fails', async () => {
            const mockActivity = vi.fn().mockRejectedValue(
                ApplicationFailure.create({
                    message: 'Experience not found',
                    type: ExperienceErrorType.NOT_FOUND,
                })
            );

            const action = updateExperience({ updateExperienceActivity: mockActivity });

            await expect(action('non-existent', { title: 'Updated' })).rejects.toThrow(ApplicationFailure);
        });
    });

    describe('deleteExperience', () => {
        it('should delete experience successfully', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(mockExperience);
            const mockRemoveActivity = vi.fn().mockResolvedValue(true);

            const action = deleteExperience({
                findExperienceByIdActivity: mockFindActivity,
                removeExperienceActivity: mockRemoveActivity,
            });

            const result = await action('exp-123');

            expect(result).toBe(true);
            expect(mockFindActivity).toHaveBeenCalledWith('exp-123');
            expect(mockRemoveActivity).toHaveBeenCalledWith('exp-123');
        });

        it('should throw error when experience not found', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(null);
            const mockRemoveActivity = vi.fn();

            const action = deleteExperience({
                findExperienceByIdActivity: mockFindActivity,
                removeExperienceActivity: mockRemoveActivity,
            });

            await expect(action('non-existent')).rejects.toThrow(ApplicationFailure);

            try {
                await action('non-existent');
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(ExperienceErrorType.NOT_FOUND);
            }

            expect(mockRemoveActivity).not.toHaveBeenCalled();
        });
    });
});
