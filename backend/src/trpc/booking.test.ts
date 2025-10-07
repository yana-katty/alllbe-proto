/**
 * Booking tRPC Router テスト
 * 
 * tRPCレイヤーのテスト戦略:
 * - 最小限のスモークテスト（正常系のみ、1エンドポイント1テスト）
 * - 詳細なロジックはActivity/Actions/Workflow層で検証済み
 * - tRPCの役割はルーティングとエラーマッピングのみ
 */

import { describe, it, expect, vi } from 'vitest';

// モック
vi.mock('../activities/db/connection', () => ({
    getDatabase: vi.fn(() => ({} as any)),
}));

vi.mock('../activities/db/models/booking', () => ({
    findBookingById: vi.fn(() => vi.fn()),
    listBookingsByUser: vi.fn(() => vi.fn()),
    listBookingsByExperience: vi.fn(() => vi.fn()),
    listAttendedBookingsByUser: vi.fn(() => vi.fn()),
    hasUserAttendedExperience: vi.fn(() => vi.fn()),
    bookingCreateSchema: {
        parse: vi.fn(),
    },
    bookingUpdateSchema: {
        parse: vi.fn(),
    },
    bookingIdSchema: {
        parse: vi.fn(),
    },
    bookingQuerySchema: {
        parse: vi.fn(),
    },
}));

vi.mock('../actions/booking', () => ({
    getBookingById: vi.fn(() => vi.fn()),
    listBookingsByUserAction: vi.fn(() => vi.fn()),
    listBookingsByExperienceAction: vi.fn(() => vi.fn()),
    listAttendedBookingsByUserAction: vi.fn(() => vi.fn()),
    hasUserAttendedExperienceAction: vi.fn(() => vi.fn()),
}));

vi.mock('@temporalio/client', () => ({
    Connection: {
        connect: vi.fn(async () => ({})),
    },
    Client: vi.fn(function (this: any) {
        this.workflow = {
            execute: vi.fn(),
        };
    }),
    WorkflowIdReusePolicy: {
        WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE: 'REJECT_DUPLICATE',
    },
}));

vi.mock('../workflows/booking', () => ({
    createBookingWorkflow: vi.fn(),
    checkInWithQRCodeWorkflow: vi.fn(),
    cancelBookingWorkflow: vi.fn(),
}));

describe('bookingRouter - Smoke Tests', () => {
    it('should export bookingRouter', async () => {
        const { bookingRouter } = await import('./booking');
        expect(bookingRouter).toBeDefined();
    });

    it('should have expected query endpoints', async () => {
        const { bookingRouter } = await import('./booking');

        // Query endpoints
        expect(bookingRouter._def.procedures.getById).toBeDefined();
        expect(bookingRouter._def.procedures.listMine).toBeDefined();
        expect(bookingRouter._def.procedures.listByExperience).toBeDefined();
        expect(bookingRouter._def.procedures.listAttended).toBeDefined();
        expect(bookingRouter._def.procedures.hasAttended).toBeDefined();
    });

    it('should have expected mutation endpoints', async () => {
        const { bookingRouter } = await import('./booking');

        // Mutation endpoints
        expect(bookingRouter._def.procedures.create).toBeDefined();
        expect(bookingRouter._def.procedures.checkIn).toBeDefined();
        expect(bookingRouter._def.procedures.cancel).toBeDefined();
    });
});
