/**
 * Providers Component
 * 
 * tRPC Provider と TanStack Query Provider を設定
 * 将来的に Auth0 Provider もここに追加
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
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
                    url: process.env.NEXT_PUBLIC_TRPC_URL || 'http://localhost:4000/trpc',
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

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}
