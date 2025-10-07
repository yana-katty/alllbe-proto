/**
 * tRPC Client 設定
 * 
 * Backend の AppRouter 型を共有して型安全な API 通信を実現
 */

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@shared/types/trpc';

export const trpc = createTRPCReact<AppRouter>();
