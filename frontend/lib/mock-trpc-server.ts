/**
 * Mock tRPC Server for Development
 * 
 * Phase 1 MVP用のモックサーバー
 * 実際のバックエンドなしでフロントエンドの開発・テストが可能
 */

import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { MOCK_EXPERIENCES } from './constants';

// モックハンドラーを定義
export const mockHandlers = [
    // Experience.getById
    http.get('/trpc/experience.getById', async ({ request }) => {
        const url = new URL(request.url);
        const input = url.searchParams.get('input');
        
        if (!input) {
            return HttpResponse.json({
                error: {
                    json: {
                        message: 'Invalid input',
                        code: -32600,
                        data: { code: 'BAD_REQUEST', httpStatus: 400 }
                    }
                }
            }, { status: 400 });
        }

        const id = JSON.parse(input);
        const experience = MOCK_EXPERIENCES.find(e => e.id === id);
        
        if (!experience) {
            return HttpResponse.json({
                error: {
                    json: {
                        message: 'Experience not found',
                        code: -32004,
                        data: { code: 'NOT_FOUND', httpStatus: 404 }
                    }
                }
            }, { status: 404 });
        }

        return HttpResponse.json({
            result: { data: { json: experience } }
        });
    }),

    // Experience.list
    http.get('/trpc/experience.list', async ({ request }) => {
        const url = new URL(request.url);
        const inputParam = url.searchParams.get('input');
        const input = inputParam ? JSON.parse(inputParam) : {};
        
        const { limit = 20, offset = 0, status, experienceType } = input;

        let filtered = MOCK_EXPERIENCES;

        // Filter by status if provided
        if (status) {
            filtered = filtered.filter(e => e.status === status);
        }

        // Filter by experienceType if provided
        if (experienceType) {
            filtered = filtered.filter(e => e.experienceType === experienceType);
        }

        // Apply pagination
        const paginatedExperiences = filtered.slice(offset, offset + limit);

        return HttpResponse.json({
            result: {
                data: {
                    json: {
                        experiences: paginatedExperiences,
                        total: filtered.length,
                        hasMore: offset + limit < filtered.length
                    }
                }
            }
        });
    }),

    // Experience.listByBrand
    http.get('/trpc/experience.listByBrand', async ({ request }) => {
        const url = new URL(request.url);
        const inputParam = url.searchParams.get('input');
        const input = inputParam ? JSON.parse(inputParam) : {};
        
        const { brandId, limit = 20, offset = 0, status, experienceType } = input;

        let filtered = MOCK_EXPERIENCES.filter(e => e.brandId === brandId);

        if (status) {
            filtered = filtered.filter(e => e.status === status);
        }

        if (experienceType) {
            filtered = filtered.filter(e => e.experienceType === experienceType);
        }

        const paginatedExperiences = filtered.slice(offset, offset + limit);

        return HttpResponse.json({
            result: {
                data: {
                    json: {
                        experiences: paginatedExperiences,
                        total: filtered.length,
                        hasMore: offset + limit < filtered.length
                    }
                }
            }
        });
    }),

    // Booking.create
    http.post('/trpc/booking.create', async ({ request }) => {
        const body: any = await request.json();
        const input = body.json || body;
        
        // Simulate booking creation
        const booking = {
            id: `booking-${Date.now()}`,
            experienceId: input.experienceId,
            userId: input.userId || 'mock-user-123',
            numberOfParticipants: input.numberOfParticipants,
            scheduledVisitTime: input.scheduledVisitTime,
            status: 'confirmed' as const,
            qrCode: `QR-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        return HttpResponse.json({
            result: { data: { json: booking } }
        });
    }),

    // Booking.listByUser
    http.get('/trpc/booking.listByUser', async ({ request }) => {
        const url = new URL(request.url);
        const inputParam = url.searchParams.get('input');
        const userId = inputParam ? JSON.parse(inputParam) : '';
        
        // Return mock bookings for the user
        const mockBookings = [
            {
                id: 'booking-1',
                experienceId: 'yami-no-yakata-vr',
                userId: userId,
                numberOfParticipants: '2',
                scheduledVisitTime: new Date(Date.now() + 86400000).toISOString(),
                status: 'confirmed' as const,
                qrCode: 'QR-12345',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        ];

        return HttpResponse.json({
            result: { data: { json: mockBookings } }
        });
    }),

    // Health check
    http.get('/trpc/health.check', () => {
        return HttpResponse.json({
            result: {
                data: {
                    json: {
                        status: 'ok',
                        timestamp: new Date().toISOString(),
                        message: 'Mock tRPC server is running'
                    }
                }
            }
        });
    }),
];

// MSW worker のセットアップ（ブラウザのみ）
let worker: ReturnType<typeof setupWorker> | null = null;

export async function startMockServer() {
    if (typeof window === 'undefined') {
        // サーバーサイドでは何もしない
        return;
    }

    if (worker) {
        // 既に起動している場合は何もしない
        return;
    }

    worker = setupWorker(...mockHandlers);

    await worker.start({
        onUnhandledRequest: 'bypass', // tRPC以外のリクエストは通常通り処理
        quiet: false, // ログを表示
    });

    console.log('[MSW] Mock tRPC server started 🚀');
    console.log('[MSW] Available endpoints:');
    console.log('  - GET /trpc/experience.getById');
    console.log('  - GET /trpc/experience.list');
    console.log('  - GET /trpc/experience.listByBrand');
    console.log('  - POST /trpc/booking.create');
    console.log('  - GET /trpc/booking.listByUser');
    console.log('  - GET /trpc/health.check');
}

export async function stopMockServer() {
    if (worker) {
        await worker.stop();
        worker = null;
        console.log('[MSW] Mock tRPC server stopped');
    }
}
