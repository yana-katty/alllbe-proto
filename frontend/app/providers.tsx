/**
 * Providers Component
 * 
 * tRPC Provider と TanStack Query Provider を設定
 * Phase 1: Mock tRPC サーバーを起動してAPI呼び出しをテスト可能に
 * 将来的に Auth0 Provider もここに追加
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc';
import { useState, useEffect, type ReactNode } from 'react';

// Phase 1: Mock サーバーを有効化（開発環境 かつ 環境変数で明示的に有効化）
const USE_MOCK_SERVER = process.env.NEXT_PUBLIC_USE_MOCK_SERVER === 'true';

export function Providers({ children }: { children: ReactNode }) {
    const [isMockServerReady, setIsMockServerReady] = useState(!USE_MOCK_SERVER);

    useEffect(() => {
        if (USE_MOCK_SERVER && typeof window !== 'undefined') {
            // Mock サーバーを起動
            import('@/lib/mock-trpc-server')
                .then(({ startMockServer }) => startMockServer())
                .then(() => {
                    setIsMockServerReady(true);
                    console.log('[Providers] Mock tRPC server is ready');
                })
                .catch((error) => {
                    console.error('[Providers] Failed to start mock server:', error);
                    setIsMockServerReady(true); // エラーでも続行
                });
        }
    }, []);

    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1分間はキャッシュを使用
                        retry: 1,
                    },
                },
            })
    );

    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    // Phase 1: Mock サーバー使用時は相対パスでリクエスト（MSW が同一オリジンのみ対応）
                    url: USE_MOCK_SERVER
                        ? '/trpc'
                        : (process.env.NEXT_PUBLIC_TRPC_URL || 'http://localhost:4000/trpc'),
                    headers() {
                        // TODO: Auth0 トークンを追加（Phase 3）
                        // const token = localStorage.getItem('auth0_token');
                        // return token ? { authorization: `Bearer ${token}` } : {};
                        return {};
                    },
                }),
            ],
        })
    );

    // Mock サーバーの準備ができるまで待機（開発環境のみ）
    if (!isMockServerReady) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                fontFamily: 'system-ui, sans-serif'
            }}>
                <div>
                    <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>🚀 Starting Mock tRPC Server...</p>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>Phase 1 MVP Mode</p>
                </div>
            </div>
        );
    }

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}
