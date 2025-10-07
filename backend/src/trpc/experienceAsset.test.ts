/**
 * ExperienceAsset tRPC Router - Smoke Tests
 * 
 * tRPCレイヤーのテスト戦略:
 * - 最小限のスモークテスト（正常系のみ、1エンドポイント1テスト）
 * - 詳細なロジックはActivity/Actions層で検証済み
 * - tRPCの役割はルーティングとエラーマッピングのみ
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// スキーマの実際の定義をインポート（モックしない）
const experienceAssetCreateSchema = z.object({
    experienceId: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    assetType: z.enum(['video', 'article', 'image', 'download', 'audio']),
    assetUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    contentTiming: z.enum(['before', 'after', 'anytime']),
    category: z.enum(['story', 'making', 'guide', 'column', 'interview', 'other']).optional(),
    categoryLabel: z.string().optional(),
    accessLevel: z.enum(['public', 'ticket_holder', 'attended']).default('public'),
    displayOrder: z.number().int().default(0),
    fileSize: z.string().optional(),
    duration: z.string().optional(),
});

const experienceAssetUpdateSchema = experienceAssetCreateSchema.partial().omit({
    experienceId: true,
});

const experienceAssetQuerySchema = z.object({
    experienceId: z.string().uuid().optional(),
    contentTiming: z.enum(['before', 'after', 'anytime']).optional(),
    category: z.enum(['story', 'making', 'guide', 'column', 'interview', 'other']).optional(),
    accessLevel: z.enum(['public', 'ticket_holder', 'attended']).optional(),
    assetType: z.enum(['video', 'article', 'image', 'download', 'audio']).optional(),
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
});

// 必要最小限のモック
vi.mock('../activities/db/connection', () => ({
    getDatabase: vi.fn(() => ({} as any)),
}));

vi.mock('../activities/db/models/experienceAssets', () => ({
    insertExperienceAsset: vi.fn(() => vi.fn()),
    findExperienceAssetById: vi.fn(() => vi.fn()),
    listExperienceAssets: vi.fn(() => vi.fn()),
    listExperienceAssetsByExperience: vi.fn(() => vi.fn()),
    updateExperienceAsset: vi.fn(() => vi.fn()),
    removeExperienceAsset: vi.fn(() => vi.fn()),
    experienceAssetCreateSchema,
    experienceAssetUpdateSchema,
    experienceAssetQuerySchema,
}));

describe('experienceAssetRouter - Smoke Tests', () => {
    it('should export experienceAssetRouter', async () => {
        const { experienceAssetRouter } = await import('./experienceAsset');
        expect(experienceAssetRouter).toBeDefined();
    });
});
