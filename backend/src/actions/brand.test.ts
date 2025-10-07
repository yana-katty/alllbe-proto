/**
 * Brand Actions テスト
 * 
 * Actions層のテストは、Activity関数をモックして、
 * ビジネスロジックのみをテストします。
 */

import { describe, it, expect, vi } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    canCreateBrand,
    createBrand,
    getBrandById,
    listBrandsByOrganization,
    getDefaultBrand,
    updateBrand,
    deleteBrand,
    isDefaultBrand,
    countBrands,
    type PlanType,
} from './brand';
import { BrandErrorType } from '../activities/db/models/brand';
import type { Brand } from '../activities/db/schema';

describe('Brand Actions', () => {
    const mockBrand: Brand = {
        id: 'brand_uuid_123',
        organizationId: 'org_123',
        name: 'Test Brand',
        description: 'Test Description',
        logoUrl: null,
        websiteUrl: null,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    describe('canCreateBrand', () => {
        it('should return true when brand count is below limit (standard)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(0);

            const action = canCreateBrand({ countBrandsByOrganizationIdActivity: mockCountActivity });
            const result = await action('org_123', 'standard');

            expect(result).toBe(true);
            expect(mockCountActivity).toHaveBeenCalledWith('org_123');
        });

        it('should return false when brand count reaches limit (standard)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(1);

            const action = canCreateBrand({ countBrandsByOrganizationIdActivity: mockCountActivity });
            const result = await action('org_123', 'standard');

            expect(result).toBe(false);
        });

        it('should return true when brand count is below limit (enterprise)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(99);

            const action = canCreateBrand({ countBrandsByOrganizationIdActivity: mockCountActivity });
            const result = await action('org_123', 'enterprise');

            expect(result).toBe(true);
        });

        it('should return false when brand count reaches limit (enterprise)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(100);

            const action = canCreateBrand({ countBrandsByOrganizationIdActivity: mockCountActivity });
            const result = await action('org_123', 'enterprise');

            expect(result).toBe(false);
        });
    });

    describe('createBrand', () => {
        it('should create brand when limit not reached (standard)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(0);
            const mockInsertActivity = vi.fn().mockResolvedValue(mockBrand);

            const action = createBrand({
                countBrandsByOrganizationIdActivity: mockCountActivity,
                insertBrandActivity: mockInsertActivity,
            });

            const input = {
                organizationId: 'org_123',
                name: 'Test Brand',
                isDefault: false,
            };

            const result = await action(input, 'standard');

            expect(result).toEqual(mockBrand);
            expect(mockCountActivity).toHaveBeenCalledWith('org_123');
            expect(mockInsertActivity).toHaveBeenCalledWith(input);
        });

        it('should throw BRAND_LIMIT_REACHED when limit reached (standard)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(1);
            const mockInsertActivity = vi.fn();

            const action = createBrand({
                countBrandsByOrganizationIdActivity: mockCountActivity,
                insertBrandActivity: mockInsertActivity,
            });

            const input = {
                organizationId: 'org_123',
                name: 'Test Brand',
                isDefault: false,
            };

            await expect(action(input, 'standard')).rejects.toThrow(ApplicationFailure);

            try {
                await action(input, 'standard');
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.LIMIT_REACHED);
            }

            expect(mockInsertActivity).not.toHaveBeenCalled();
        });

        it('should create brand when limit not reached (enterprise)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(50);
            const mockInsertActivity = vi.fn().mockResolvedValue(mockBrand);

            const action = createBrand({
                countBrandsByOrganizationIdActivity: mockCountActivity,
                insertBrandActivity: mockInsertActivity,
            });

            const input = {
                organizationId: 'org_123',
                name: 'Test Brand',
                isDefault: false,
            };

            const result = await action(input, 'enterprise');

            expect(result).toEqual(mockBrand);
        });

        it('should throw BRAND_LIMIT_REACHED when limit reached (enterprise)', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(100);
            const mockInsertActivity = vi.fn();

            const action = createBrand({
                countBrandsByOrganizationIdActivity: mockCountActivity,
                insertBrandActivity: mockInsertActivity,
            });

            const input = {
                organizationId: 'org_123',
                name: 'Test Brand',
                isDefault: false,
            };

            await expect(action(input, 'enterprise')).rejects.toThrow(ApplicationFailure);

            try {
                await action(input, 'enterprise');
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.LIMIT_REACHED);
            }
        });
    });

    describe('getBrandById', () => {
        it('should return brand when found', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(mockBrand);

            const action = getBrandById({ findBrandByIdActivity: mockFindActivity });
            const result = await action('brand_uuid_123');

            expect(result).toEqual(mockBrand);
            expect(mockFindActivity).toHaveBeenCalledWith('brand_uuid_123');
        });

        it('should return null when brand not found', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(null);

            const action = getBrandById({ findBrandByIdActivity: mockFindActivity });
            const result = await action('non_existent');

            expect(result).toBeNull();
        });
    });

    describe('listBrandsByOrganization', () => {
        it('should return list of brands', async () => {
            const mockBrands: Brand[] = [mockBrand];
            const mockFindActivity = vi.fn().mockResolvedValue(mockBrands);

            const action = listBrandsByOrganization({ findBrandsByOrganizationIdActivity: mockFindActivity });
            const result = await action({ organizationId: 'org_123' });

            expect(result).toEqual(mockBrands);
            expect(mockFindActivity).toHaveBeenCalledWith({ organizationId: 'org_123' });
        });

        it('should filter by isActive', async () => {
            const mockBrands: Brand[] = [mockBrand];
            const mockFindActivity = vi.fn().mockResolvedValue(mockBrands);

            const action = listBrandsByOrganization({ findBrandsByOrganizationIdActivity: mockFindActivity });
            const result = await action({ organizationId: 'org_123', isActive: true });

            expect(result).toEqual(mockBrands);
            expect(mockFindActivity).toHaveBeenCalledWith({ organizationId: 'org_123', isActive: true });
        });
    });

    describe('getDefaultBrand', () => {
        it('should return default brand', async () => {
            const defaultBrand: Brand = { ...mockBrand, isDefault: true };
            const mockFindActivity = vi.fn().mockResolvedValue(defaultBrand);

            const action = getDefaultBrand({ findDefaultBrandByOrganizationIdActivity: mockFindActivity });
            const result = await action('org_123');

            expect(result).toEqual(defaultBrand);
            expect(result?.isDefault).toBe(true);
        });

        it('should return null when no default brand', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(null);

            const action = getDefaultBrand({ findDefaultBrandByOrganizationIdActivity: mockFindActivity });
            const result = await action('org_123');

            expect(result).toBeNull();
        });
    });

    describe('updateBrand', () => {
        it('should update brand', async () => {
            const updatedBrand: Brand = { ...mockBrand, name: 'Updated Name' };
            const mockUpdateActivity = vi.fn().mockResolvedValue(updatedBrand);

            const action = updateBrand({ updateBrandActivity: mockUpdateActivity });
            const result = await action('brand_uuid_123', { name: 'Updated Name' });

            expect(result.name).toBe('Updated Name');
            expect(mockUpdateActivity).toHaveBeenCalledWith('brand_uuid_123', { name: 'Updated Name' });
        });
    });

    describe('deleteBrand', () => {
        it('should delete brand successfully', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(mockBrand);
            const mockDeleteActivity = vi.fn().mockResolvedValue(true);

            const action = deleteBrand({
                findBrandByIdActivity: mockFindActivity,
                deleteBrandActivity: mockDeleteActivity,
            });

            const result = await action('brand_uuid_123');

            expect(result).toBe(true);
            expect(mockFindActivity).toHaveBeenCalledWith('brand_uuid_123');
            expect(mockDeleteActivity).toHaveBeenCalledWith('brand_uuid_123');
        });

        it('should throw BRAND_NOT_FOUND when brand does not exist', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(null);
            const mockDeleteActivity = vi.fn();

            const action = deleteBrand({
                findBrandByIdActivity: mockFindActivity,
                deleteBrandActivity: mockDeleteActivity,
            });

            await expect(action('non_existent')).rejects.toThrow(ApplicationFailure);

            try {
                await action('non_existent');
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.NOT_FOUND);
            }

            expect(mockDeleteActivity).not.toHaveBeenCalled();
        });
    });

    describe('isDefaultBrand', () => {
        it('should return true for default brand', async () => {
            const defaultBrand: Brand = { ...mockBrand, isDefault: true };
            const mockFindActivity = vi.fn().mockResolvedValue(defaultBrand);

            const action = isDefaultBrand({ findBrandByIdActivity: mockFindActivity });
            const result = await action('brand_uuid_123');

            expect(result).toBe(true);
        });

        it('should return false for non-default brand', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(mockBrand);

            const action = isDefaultBrand({ findBrandByIdActivity: mockFindActivity });
            const result = await action('brand_uuid_123');

            expect(result).toBe(false);
        });

        it('should return false when brand not found', async () => {
            const mockFindActivity = vi.fn().mockResolvedValue(null);

            const action = isDefaultBrand({ findBrandByIdActivity: mockFindActivity });
            const result = await action('non_existent');

            expect(result).toBe(false);
        });
    });

    describe('countBrands', () => {
        it('should return brand count', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(5);

            const action = countBrands({ countBrandsByOrganizationIdActivity: mockCountActivity });
            const result = await action('org_123');

            expect(result).toBe(5);
            expect(mockCountActivity).toHaveBeenCalledWith('org_123');
        });

        it('should return 0 when no brands', async () => {
            const mockCountActivity = vi.fn().mockResolvedValue(0);

            const action = countBrands({ countBrandsByOrganizationIdActivity: mockCountActivity });
            const result = await action('org_123');

            expect(result).toBe(0);
        });
    });
});
