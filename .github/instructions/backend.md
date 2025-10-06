# Backend 開発ガイドライン

## 適用範囲
このガイドラインは `backend/**` 配下のすべてのファイルに適用されます。

## アーキテクチャ

### モノレポ構成
- **エントリーポイント**: tRPC (`src/trpc/index.ts`) と Temporal (`src/temporal/index.ts`) で分離
- **共有コード**: `src/shared/` 配下でビジネスロジック、DB操作、ドメインモデルを共有
- **型の共有**: `@shared/*` エイリアスでルートの `shared/` ディレクトリから型定義をインポート

### オニオンアーキテクチャ + 関数型依存注入
```
backend/src/
├── trpc/           # tRPC HTTPサーバー (CRUD処理)
│   └── index.ts
├── temporal/       # Temporal ワークフロー (非同期処理)
│   └── index.ts
└── shared/         # 共有コード
    ├── domain/     # ビジネスロジック
    ├── db/         # DB操作関数
    │   └── models/ # データモデル
    └── trpc/       # tRPCルーター・ハンドラ
```

## 実装パターン

### 1. DB操作関数 (`src/shared/db/models/`)
```typescript
// 高階関数によるDB操作関数のファクトリ
export const insertOrganization = (db: Database): InsertOrganization => 
  (data: OrganizationCreateInput) => {
    return ResultAsync.fromPromise(
      db.insert(organizations).values(data).returning(),
      (error) => ({ code: ErrorCode.DATABASE, message: 'Insert failed', details: error })
    );
  };
```

### 2. ドメインロジック (`src/shared/domain/`)
```typescript
// Pick<>で必要な依存のみ受け取る
export const createOrganization = (
  deps: Pick<OrganizationActionDeps, 'insertOrganization' | 'findOrganizationByEmail'>
) => async (input: OrganizationCreateInput): Promise<Result<OperationResult<any>, OrganizationError>> => {
  // ビジネスロジックの実装
};
```

### 3. tRPCハンドラ (`src/shared/trpc/handler/`)
```typescript
// Resultをトラップしてエラーハンドリング
export const organizationRouter = t.router({
  create: t.procedure
    .input(organizationCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.organizationActions.create(input);
      if (result.isErr()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error.message });
      }
      return result.value;
    }),
});
```

### 4. Temporalワークフロー (`src/temporal/`)
- **ワークフロー**: 長時間実行される非同期処理の定義
- **アクティビティ**: `src/shared/domain/` のビジネスロジックを呼び出し
- **共有**: DB操作とドメインロジックをtRPCと共有

## 技術スタック

- **TypeScript**: 厳密な型安全性
- **Hono**: 軽量高速なWebフレームワーク
- **tRPC + @hono/trpc-server**: 型安全なAPI
- **Temporal**: 非同期ワークフロー管理
- **Drizzle ORM**: 型安全なDB操作
- **Neon Database**: PostgreSQL (サーバーレス)
- **neverthrow**: Result型によるエラーハンドリング
- **vitest**: 高速テストフレームワーク
- **Zod**: スキーマバリデーション

## コーディング規約

### 関数型プログラミング原則
1. **純粋関数優先**: 副作用を最小限に
2. **Result型統一**: `throw` 禁止、`neverthrow` でエラーハンドリング
3. **高階関数依存注入**: テスタビリティの確保
4. **不変性**: オブジェクトの変更ではなく新規作成
5. **最小権限**: `Pick<>` で必要な依存のみ受け取る

### エラーハンドリング
```typescript
// ✅ 良い例: Result型
const result = await createOrganization(data);
if (result.isErr()) {
  return err(result.error);
}

// ❌ 悪い例: throw
throw new Error('Something went wrong');
```

### 型安全性
- **Zodスキーマ**: 実行時型検証
- **厳密な型定義**: `any` 禁止
- **null安全性**: `noUncheckedIndexedAccess: true`

## テスト方針

### 単体テスト
- **純粋関数を重点テスト**: ドメインロジック関数
- **依存の最小化**: `Pick<>` で必要な関数のみモック
- **Result型の検証**: `isOk()` / `isErr()` + `_unsafeUnwrap()` / `_unsafeUnwrapErr()`
- **エラーパスの網羅**: 正常系・異常系を包括的にテスト

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createOrganization } from '@/domain/organization';

describe('createOrganization', () => {
  it('should create organization when email is unique', async () => {
    const mockDeps = {
      insertOrganization: vi.fn().mockResolvedValue(ok(mockEntity)),
      findOrganizationByEmail: vi.fn().mockResolvedValue(ok(null)),
    };
    const result = await createOrganization(mockDeps)(input);
    expect(result.isOk()).toBe(true);
  });
});
```

## パス設定

### tsconfig.json
```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@shared/*": ["../shared/*"]
  }
}
```

- `@/*`: backend内部のパス
- `@shared/*`: ルートの `shared/` ディレクトリ（型定義）

## 禁止事項

- ❌ `any` 型の使用
- ❌ `throw` によるエラー送出
- ❌ グローバル変数
- ❌ `Promise.reject` の使用（Resultを使う）
- ❌ 可変オブジェクトの変更

## 自動更新要件

### このファイルを更新すべきタイミング
- backend のディレクトリ構造が変更された時
- 新しい技術スタックが追加された時
- アーキテクチャパターンが変更された時
- コーディング規約が変更された時

**更新は変更完了後すぐに実行すること。**
