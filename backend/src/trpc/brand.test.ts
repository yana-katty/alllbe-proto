/**
 * Brand tRPC Router テスト
 * 
 * tRPCレイヤーのテスト戦略:
 * - 最小限のスモークテスト（正常系のみ、1エンドポイント1テスト）
 * - 詳細なロジックはActivity/Actions層で検証済み
 * - tRPCの役割はルーティングとエラーマッピングのみ
 */

import { describe, it, expect, vi } from 'vitest';

// モック
vi.mock('../activities/db/connection', () => ({
    getDatabase: vi.fn(() => ({} as any)),
}));

vi.mock('../activities/db/models/brand', () => ({
    insertBrand: vi.fn(() => vi.fn()),
    findBrandById: vi.fn(() => vi.fn()),
    findBrandsByOrganizationId: vi.fn(() => vi.fn()),
    findDefaultBrandByOrganizationId: vi.fn(() => vi.fn()),
    updateBrand: vi.fn(() => vi.fn()),
    deleteBrand: vi.fn(() => vi.fn()),
    countBrandsByOrganizationId: vi.fn(() => vi.fn()),
    brandCreateSchema: {
        extend: vi.fn(() => ({
            parse: vi.fn(),
        })),
    },
    brandUpdateSchema: {
        parse: vi.fn(),
    },
}));

vi.mock('../actions/brand', () => ({
    createBrandActions: vi.fn(() => ({
        listBrandsByOrganization: vi.fn(),
        getBrandById: vi.fn(),
        getDefaultBrand: vi.fn(),
    })),
}));

vi.mock('@temporalio/client', () => ({
    Connection: {
        connect: vi.fn(async () => ({})),
    },
    Client: vi.fn(function (this: any) {
        this.workflow = {
            start: vi.fn(),
        };
    }),
    WorkflowIdReusePolicy: {
        ALLOW_DUPLICATE: 'ALLOW_DUPLICATE',
    },
}));

vi.mock('../workflows/brand', () => ({
    createBrandWorkflow: vi.fn(),
    updateBrandWorkflow: vi.fn(),
    deleteBrandWorkflow: vi.fn(),
}));

describe('brandRouter - Smoke Tests', () => {
    it('should export brandRouter', async () => {
        const { brandRouter } = await import('./brand');
        expect(brandRouter).toBeDefined();
    });
});
