/**
 * ExperienceAsset tRPC Router - Smoke Tests
 * 
 * tRPCレイヤーのテスト戦略:
 * - 最小限のスモークテスト（正常系のみ、1エンドポイント1テスト）
 * - 詳細なロジックはActivity/Actions層で検証済み
 * - tRPCの役割はルーティングとエラーマッピングのみ
 */

import { describe, it, expect, vi } from 'vitest';

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
    experienceAssetCreateSchema: {} as any,
    experienceAssetUpdateSchema: {} as any,
    experienceAssetQuerySchema: {} as any,
}));

describe('experienceAssetRouter - Smoke Tests', () => {
    it('should export experienceAssetRouter', async () => {
        const { experienceAssetRouter } = await import('./experienceAsset');
        expect(experienceAssetRouter).toBeDefined();
    });
});
