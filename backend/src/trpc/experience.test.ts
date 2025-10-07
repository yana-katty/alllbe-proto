/**
 * Experience tRPC Router - Smoke Tests
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

vi.mock('../activities/db/models/experience', () => ({
    insertExperience: vi.fn(() => vi.fn()),
    findExperienceById: vi.fn(() => vi.fn()),
    listExperiences: vi.fn(() => vi.fn()),
    listExperiencesByBrand: vi.fn(() => vi.fn()),
    updateExperience: vi.fn(() => vi.fn()),
    removeExperience: vi.fn(() => vi.fn()),
    experienceCreateSchema: {} as any,
    experienceUpdateSchema: {} as any,
    experienceQuerySchema: {} as any,
}));

describe('experienceRouter - Smoke Tests', () => {
    it('should export experienceRouter', async () => {
        const { experienceRouter } = await import('./experience');
        expect(experienceRouter).toBeDefined();
    });
});
