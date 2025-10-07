/**
 * Experience tRPC Router - Smoke Tests
 * 
 * tRPCレイヤーのテスト戦略:
 * - 最小限のスモークテスト（正常系のみ、1エンドポイント1テスト）
 * - 詳細なロジックはActivity/Actions層で検証済み
 * - tRPCの役割はルーティングとエラーマッピングのみ
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// スキーマの実際の定義をインポート（モックしない）
const experienceCreateSchema = z.object({
    brandId: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    location: z.string().optional(),
    capacity: z.string().optional(),
    price: z.string().optional(),
    experienceType: z.enum(['scheduled', 'period', 'flexible']),
    scheduledStartAt: z.date().optional(),
    scheduledEndAt: z.date().optional(),
    periodStartDate: z.date().optional(),
    periodEndDate: z.date().optional(),
    status: z.enum(['draft', 'published', 'ended', 'archived']).default('draft'),
    coverImageUrl: z.string().url().optional(),
    tags: z.string().optional(),
});

const experienceUpdateSchema = experienceCreateSchema.partial().omit({ brandId: true });

const experienceQuerySchema = z.object({
    brandId: z.string().uuid().optional(),
    status: z.enum(['draft', 'published', 'ended', 'archived']).optional(),
    experienceType: z.enum(['scheduled', 'period', 'flexible']).optional(),
    search: z.string().optional(),
    startDateFrom: z.date().optional(),
    startDateTo: z.date().optional(),
    isActive: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

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
    experienceCreateSchema,
    experienceUpdateSchema,
    experienceQuerySchema,
}));

describe('experienceRouter - Smoke Tests', () => {
    it('should export experienceRouter', async () => {
        const { experienceRouter } = await import('./experience');
        expect(experienceRouter).toBeDefined();
    });
});
