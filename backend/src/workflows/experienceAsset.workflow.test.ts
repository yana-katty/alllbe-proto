/**
 * Experience Asset Workflow テスト
 * 
 * Temporal TestWorkflowEnvironment を使用した Workflow のテスト
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { randomUUID } from 'crypto';
import {
    createExperienceAssetWorkflow,
    updateExperienceAssetWorkflow,
    deleteExperienceAssetWorkflow,
} from './experienceAsset';
import type { ExperienceAsset, Experience } from '../activities/db/schema';

describe('ExperienceAsset Workflows', () => {
    let testEnv: TestWorkflowEnvironment;

    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    });

    afterAll(async () => {
        await testEnv?.teardown();
    });

    // 共通の Worker 設定
    const createTestWorker = async (mockActivities: Record<string, any>) => {
        return await Worker.create({
            connection: testEnv.nativeConnection,
            taskQueue: 'test',
            workflowsPath: require.resolve('./experienceAsset.ts'),
            activities: mockActivities,
        });
    };

    describe('createExperienceAssetWorkflow', () => {
        it('should create experience asset successfully', async () => {
            const experienceId = randomUUID();
            const assetId = randomUUID();

            const mockActivities = {
                findExperienceById: vi.fn().mockResolvedValue({
                    id: experienceId,
                    brandId: randomUUID(),
                    title: 'Test Experience',
                    status: 'published',
                } as Experience),
                insertExperienceAsset: vi.fn().mockResolvedValue({
                    id: assetId,
                    experienceId,
                    title: 'Test Asset',
                    assetType: 'video',
                    assetUrl: 'https://example.com/video.mp4',
                    contentTiming: 'after',
                    accessLevel: 'attended',
                    displayOrder: '0',
                    isActive: true,
                } as ExperienceAsset),
            };

            const worker = await createTestWorker(mockActivities);

            const result = await worker.runUntil(
                testEnv.client.workflow.execute(createExperienceAssetWorkflow, {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [{
                        experienceId,
                        title: 'Test Asset',
                        assetType: 'video' as const,
                        assetUrl: 'https://example.com/video.mp4',
                        contentTiming: 'after' as const,
                        accessLevel: 'attended' as const,
                        displayOrder: '0',
                    }],
                })
            );

            expect(result.id).toBe(assetId);
            expect(result.experienceId).toBe(experienceId);
            expect(result.title).toBe('Test Asset');
            expect(mockActivities.findExperienceById).toHaveBeenCalledWith(experienceId);
            expect(mockActivities.insertExperienceAsset).toHaveBeenCalled();
        });

        it('should throw error when experience not found', async () => {
            const experienceId = randomUUID();

            const mockActivities = {
                findExperienceById: vi.fn().mockResolvedValue(null),
                insertExperienceAsset: vi.fn(),
            };

            const worker = await createTestWorker(mockActivities);

            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute(createExperienceAssetWorkflow, {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [{
                            experienceId,
                            title: 'Test Asset',
                            assetType: 'video' as const,
                            assetUrl: 'https://example.com/video.mp4',
                            contentTiming: 'after' as const,
                            accessLevel: 'attended' as const,
                            displayOrder: '0',
                        }],
                    })
                )
            ).rejects.toThrow();

            expect(mockActivities.insertExperienceAsset).not.toHaveBeenCalled();
        });
    });

    describe('updateExperienceAssetWorkflow', () => {
        it('should update experience asset successfully', async () => {
            const assetId = randomUUID();
            const experienceId = randomUUID();

            const mockActivities = {
                findExperienceAssetById: vi.fn().mockResolvedValue({
                    id: assetId,
                    experienceId,
                    title: 'Old Title',
                    assetType: 'video',
                    assetUrl: 'https://example.com/video.mp4',
                    contentTiming: 'after',
                    accessLevel: 'attended',
                } as ExperienceAsset),
                updateExperienceAsset: vi.fn().mockResolvedValue({
                    id: assetId,
                    experienceId,
                    title: 'New Title',
                    assetType: 'video',
                    assetUrl: 'https://example.com/video.mp4',
                    contentTiming: 'before',
                    accessLevel: 'public',
                } as ExperienceAsset),
            };

            const worker = await createTestWorker(mockActivities);

            const result = await worker.runUntil(
                testEnv.client.workflow.execute(updateExperienceAssetWorkflow, {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [assetId, {
                        title: 'New Title',
                        contentTiming: 'before' as const,
                        accessLevel: 'public' as const,
                    }],
                })
            );

            expect(result.id).toBe(assetId);
            expect(result.title).toBe('New Title');
            expect(mockActivities.findExperienceAssetById).toHaveBeenCalledWith(assetId);
            expect(mockActivities.updateExperienceAsset).toHaveBeenCalled();
        });

        it('should throw error when asset not found', async () => {
            const assetId = randomUUID();

            const mockActivities = {
                findExperienceAssetById: vi.fn().mockResolvedValue(null),
                updateExperienceAsset: vi.fn(),
            };

            const worker = await createTestWorker(mockActivities);

            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute(updateExperienceAssetWorkflow, {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [assetId, { title: 'New Title' }],
                    })
                )
            ).rejects.toThrow();

            expect(mockActivities.updateExperienceAsset).not.toHaveBeenCalled();
        });
    });

    describe('deleteExperienceAssetWorkflow', () => {
        it('should delete experience asset successfully', async () => {
            const assetId = randomUUID();

            const mockActivities = {
                removeExperienceAsset: vi.fn().mockResolvedValue(true),
            };

            const worker = await createTestWorker(mockActivities);

            const result = await worker.runUntil(
                testEnv.client.workflow.execute(deleteExperienceAssetWorkflow, {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [assetId],
                })
            );

            expect(result).toBe(true);
            expect(mockActivities.removeExperienceAsset).toHaveBeenCalledWith(assetId);
        });

        it('should return false when asset not found', async () => {
            const assetId = randomUUID();

            const mockActivities = {
                removeExperienceAsset: vi.fn().mockResolvedValue(false),
            };

            const worker = await createTestWorker(mockActivities);

            const result = await worker.runUntil(
                testEnv.client.workflow.execute(deleteExperienceAssetWorkflow, {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [assetId],
                })
            );

            expect(result).toBe(false);
            expect(mockActivities.removeExperienceAsset).toHaveBeenCalledWith(assetId);
        });
    });
});
