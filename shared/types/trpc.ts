/**
 * tRPC 型定義
 * 
 * backend と frontend で共有される型定義
 * backend/src/trpc の AppRouter 型をここで export する
 */

// backend の AppRouter 型を import して re-export
// ビルド時に backend がビルドされている必要がある
export type { AppRouter } from '../../backend/src/trpc';

