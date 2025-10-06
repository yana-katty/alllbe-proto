---
applyTo: "**"
---

# GitHub Copilot Instructions: Alllbe

## プロジェクト概要

- **目的**: Location Based Entertainment (LBE) の B2B2C Experience 予約管理システム
- **アーキテクチャ**: モノレポ構成 + 関数型プログラミング + 高階関数依存注入パターン
- **主要技術**: 
  - **Backend**: TypeScript, Hono, tRPC, Temporal, Drizzle ORM, Neon Database, neverthrow, vitest
  - **Frontend**: Next.js 14, React 18, TypeScript, tRPC Client
  - **Enterprise**: WorkOS (SSO, Organization 管理, Enterprise Ready 機能)
  - **Authentication**: Auth0 (エンドユーザー認証, ソーシャルログイン)
  - **Shared**: TypeScript型定義の共有

## モノレポ構成

プロジェクトは以下の3つの主要ディレクトリで構成されています：

```
alllbe-proto/
├── backend/         # バックエンドサービス（tRPC + Temporal）
├── frontend/        # フロントエンド（Next.js 14）
├── shared/          # 型定義の共有（package.jsonなし、tsconfig.jsonのみ）
└── .github/
    └── instructions/
        ├── copilot-instructions.md  # 全体の指示（このファイル）
        ├── backend.md              # backend/** に適用
        ├── frontend.md             # frontend/** に適用
        └── shared.md               # shared/** に適用
```

### パス固有の指示ファイル

- **backend.md**: `backend/**` 配下での開発ガイドライン
- **frontend.md**: `frontend/**` 配下での開発ガイドライン
- **shared.md**: `shared/**` 配下での型定義ガイドライン

各ディレクトリで作業する際は、該当する指示ファイルも参照してください。

## Backend アーキテクチャ

### ディレクトリ構造
```
backend/
├── src/
│   ├── trpc/          # tRPC HTTPサーバー（CRUD処理）
│   │   └── index.ts   # tRPCエントリーポイント
│   ├── temporal/      # Temporal ワークフロー（非同期処理）
│   │   └── index.ts   # Temporalエントリーポイント
│   └── shared/        # tRPCとTemporalで共有するコード
│       ├── domain/    # ビジネスロジック
│       ├── db/        # DB操作関数
│       │   ├── connection.ts  # Neon DB接続設定
│       │   ├── migrate.ts     # マイグレーション実行
│       │   ├── schema.ts      # Drizzleスキーマ定義
│       │   └── models/        # データモデル
│       └── trpc/      # tRPCルーター・ハンドラ
├── drizzle.config.ts  # Drizzle Kit設定
├── package.json
└── tsconfig.json
```

### API呼び出しパターン

**Frontend → Backend の通信方式：**
- **単純なCRUD処理**: tRPC経由で呼び出し
- **非同期処理**: Temporal経由で呼び出し

### オニオンアーキテクチャ + 関数型依存注入システム

DB層、Domain層、API層を分離し、高階関数による依存注入でテスト容易性を実現：

- **db/models層**: DB操作の純粋関数を提供、具体的なDB実装に依存しない
- **domain層**: ビジネスロジック、必要な関数のみ`Pick<>`で受け取り
- **trpc/handler**: tRPC層、Result型をHTTPエラーにマッピング
- **temporal**: ワークフローとアクティビティ、domain層のロジックを再利用

### 実装パターン
```typescript
// backend/src/shared/db/models/organization.ts - DB操作関数のファクトリ
export const insertOrganization = (db: Database): InsertOrganization => 
  (data: OrganizationCreateInput) => {
    return ResultAsync.fromPromise(
      db.insert(organizations).values({
        name: data.name,
        description: data.description ?? null,
        email: data.email,
        phone: data.phone ?? null,
        website: data.website ?? null,
        address: data.address ?? null,
      }).returning().then(r => selectOrganizationSchema.parse(r[0])),
      (error) => ({ code: OrganizationErrorCode.DATABASE, message: 'Insert failed', details: error })
    );
  };

// backend/src/shared/domain/organization.ts - ビジネスロジック
export const createOrganization = (
  deps: Pick<OrganizationActionDeps, 'insertOrganization' | 'findOrganizationByEmail'>
) => async (input: OrganizationCreateInput): Promise<Result<OperationResult<any>, OrganizationError>> => {
  const existsResult = await deps.findOrganizationByEmail(input.email);
  if (existsResult.isErr()) return err(existsResult.error);
  if (existsResult.value) return err({ code: OrganizationErrorCode.ALREADY_EXISTS, message: 'Email already in use' });

  const insertResult = await deps.insertOrganization(input);
  if (insertResult.isErr()) return err(insertResult.error);

  const row = asOrg(insertResult.value);
  if (row.isErr()) return err(row.error);
  return ok({ data: row.value, message: 'Created' });
};
```

## テスト方針

### 単体テスト (Unit Tests)
- **純粋関数を重点テスト**: ビジネスロジック関数（`createOrganization`, `updateOrganization`, `removeOrganization`等）を個別にテスト
- **依存関数の最小化**: `Pick<OrganizationActionDeps, 'xxx' | 'yyy'>` で必要な関数のみモック
- **Result型の確実な検証**: `result.isOk()` / `result.isErr()` でアサーション後、`_unsafeUnwrap()` / `_unsafeUnwrapErr()` で値を取得
- **エラーパスの網羅**: 正常系・異常系（重複エラー、DB エラー、存在しないIDエラー等）を包括的にテスト
- **OperationResultパターン**: Domain関数は `{ data, message }` 形式で結果を返す

### テストツール
- **vitest**: TypeScript ネイティブ、高速、モダンなテストランナー
- **vi.fn()**: 依存関数のモック作成
- **期待する動作**: 関数呼び出し回数・引数・戻り値の検証

### テスト例
```ts
import { describe, it, expect, vi } from 'vitest';
import { createOrganization } from '@/domain/organization';
import { ok, err } from 'neverthrow';
import { OrganizationErrorCode } from '@/db/models/organization';

describe('createOrganization', () => {
  it('should return ALREADY_EXISTS when email is duplicate', async () => {
    const mockDeps = {
      insertOrganization: vi.fn(),
      findOrganizationByEmail: vi.fn().mockResolvedValue(ok({ id: 'existing-org' })),
    };
    const createLogic = createOrganization(mockDeps);
    const result = await createLogic({ name: 'Test', email: 'duplicate@example.com' });
    
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe(OrganizationErrorCode.ALREADY_EXISTS);
    expect(mockDeps.findOrganizationByEmail).toHaveBeenCalledWith('duplicate@example.com');
  });

  it('should create organization when email is unique', async () => {
    const mockEntity = { id: 'org-1', email: 'test@example.com', name: 'Test Org' };
    const mockDeps = {
      insertOrganization: vi.fn().mockResolvedValue(ok(mockEntity)),
      findOrganizationByEmail: vi.fn().mockResolvedValue(ok(null)),
    };
    const createLogic = createOrganization(mockDeps);
    const result = await createLogic({ name: 'Test', email: 'test@example.com' });
    
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().data.id).toBe('org-1');
    expect(result._unsafeUnwrap().message).toBe('Created');
    expect(mockDeps.findOrganizationByEmail).toHaveBeenCalledWith('test@example.com');
  });
});
```

## Frontend アーキテクチャ

### ディレクトリ構造
```
frontend/
├── app/              # Next.js App Router
│   ├── layout.tsx    # ルートレイアウト
│   ├── page.tsx      # トップページ
│   └── globals.css   # グローバルスタイル
├── src/
│   └── lib/          # ユーティリティ・設定
│       └── trpc.ts   # tRPCクライアント設定
├── package.json
├── tsconfig.json
└── next.config.js
```

### API通信パターン

**Frontend から Backend への呼び出し：**
- **CRUD処理**: tRPCクライアント経由
- **非同期処理**: Temporalクライアント経由

```typescript
// frontend/src/lib/trpc.ts
import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '@shared/types/trpc';

export const trpc = createTRPCClient<AppRouter>({
  // backend の tRPC サーバーに接続
});
```

## Shared (型定義の共有)

### ディレクトリ構造
```
shared/
├── types/           # 型定義
│   └── trpc.ts      # tRPC関連の型定義
├── tsconfig.json    # TypeScript設定
└── README.md
```

### 型共有の仕組み

- **package.json なし**: 実行可能なパッケージではなく、型定義のみ
- **tsconfig.json のみ**: backend と frontend の tsconfig から参照
- **@shared/* エイリアス**: 両プロジェクトから `@shared/types/trpc` でインポート可能

```typescript
// backend/tsconfig.json & frontend/tsconfig.json
{
  "paths": {
    "@shared/*": ["../shared/*"]
  }
}

// backend または frontend から使用
import type { AppRouter } from '@shared/types/trpc';
```

## ファイル構造（全体像）

```
alllbe-proto/
├── backend/
│   ├── src/
│   │   ├── trpc/
│   │   │   └── index.ts        # tRPCエントリーポイント
│   │   ├── temporal/
│   │   │   └── index.ts        # Temporalエントリーポイント
│   │   └── shared/             # tRPCとTemporalで共有
│   │       ├── domain/         # ビジネスロジック
│   │       ├── db/             # DB操作
│   │       │   └── models/
│   │       └── trpc/           # tRPCルーター
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── src/
│   │   └── lib/
│   │       └── trpc.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
├── shared/
│   ├── types/
│   │   └── trpc.ts             # 型定義
│   ├── tsconfig.json
│   └── README.md
└── .github/
    └── instructions/
        ├── copilot-instructions.md
        ├── backend.md
        ├── frontend.md
        └── shared.md
```
## 実装ポリシー

1. **純粋関数優先**: 副作用を最小限に抑えた関数型設計
2. **Result型統一**: neverthrowでエラーハンドリング、例外throw禁止
3. **依存注入**: 高階関数による疎結合、テスト容易性の確保
4. **型安全性**: Zodスキーマ + TypeScriptでランタイム・コンパイル時双方の安全性
5. **最小権限**: Pick<>で必要な関数のみ受け取り、過度な依存を回避
6. **モノレポ構成**: backend, frontend, shared で分離、型定義は shared で一元管理

## コーディング規約

### 関数型プログラミング
- **純粋関数**を優先し、副作用を最小限に抑える
- **不変性**を保つ - オブジェクトの変更ではなく新しいオブジェクトの作成
- **neverthrow**の`Result`型を使用してエラーハンドリングを行う
- **高階関数**と**関数合成**を活用する

### Honoフレームワーク統合
```typescript
// server.ts - Hono + tRPC統合例
import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';

const app = new Hono();
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext: () => ({ db }),
}));
```

### 型安全性
- **Zod**を使用した実行時型検証
- **厳密な型定義**とnull安全性
- **Result型**による例外安全なエラーハンドリング

### データベース操作
- **Drizzle ORM**を使用したtype-safeなクエリ
- **ResultAsync**によるDB操作のエラーハンドリング
- **db/models層での抽象化**により具体的なDB実装に依存しない設計

## データベース設計

**専用ガイドライン**: `database.instructions.md`を参照

このプロジェクトでは「SQL Antipatterns, Volume 1」の知見を活用し、`backend/src/shared/db/**` でのデータベース設計時にアンチパターンを避けた最適なスキーマ設計を行います。詳細な設計原則、チェックリスト、ユーザーとの議論フローについては、専用の指示ファイルを参照してください。

## テスト戦略

### GitHub Copilot自律テスト実行
- **runTests()ツール**: GitHub Copilotが自動的にテスト実行
- **vitest**: TypeScript ネイティブ、高速テストフレームワーク
- **最小依存**: Pick<>による必要最小限のモック
- **Result型検証**: 正常系・異常系の包括的テスト

### VS Code統合
- **vitest.explorer**: 視覚的フィードバックのみ
- **手動実行なし**: GitHub Copilotが自律的に実行
- **最小設定**: 不要な設定は排除

## 命名規約

- **関数**: camelCase `getUserById`
- **型**: PascalCase `OrganizationData`
- **定数**: SCREAMING_SNAKE_CASE `DATABASE_URL`
- **ファイル**: kebab-case `organization-service.ts`

## 推奨パターン

### ファクトリパターン（Backend実装）
```typescript
// backend/src/shared/domain/organization.ts
// 依存関数を束ねるファクトリ
export const createOrganizationActions = (db: Database) => {
  const deps: OrganizationActionDeps = {
    insertOrganization: insertOrganization(db),
    findOrganizationById: findOrganizationById(db),
    findOrganizationByEmail: findOrganizationByEmail(db),
    listOrganizations: listOrganizations(db),
    updateOrganization: updateOrganization(db),
    removeOrganization: removeOrganization(db),
  };

  return {
    create: createOrganization(deps),
    getById: getOrganizationById(deps),
    list: listOrganizations(deps),
    update: updateOrganization(deps),
    remove: removeOrganization(deps),
    emailExists: emailExists(deps),
  };
};
```

### Result型の使用
```typescript
import { Result, ok, err } from 'neverthrow';

// サービス層での例
export const createOrganization = (
  data: CreateOrganizationData
): Result<Organization, CreateOrganizationError> => {
  return validateOrganizationData(data)
    .andThen(saveOrganizationToDb)
    .mapErr(mapDbErrorToServiceError);
};
```

### 不変性の保持
```typescript
// 良い例
const updateOrganization = (org: Organization, updates: Partial<Organization>) => ({
  ...org,
  ...updates,
  updatedAt: new Date()
});

// 避けるべき例
const updateOrganization = (org: Organization, updates: Partial<Organization>) => {
  org.name = updates.name; // 元オブジェクトの変更
  return org;
};
```

## 禁止事項

- `any`型の使用
- `throw`文による例外の投げ上げ
- グローバル変数の使用
- 副作用のある関数の無制限な使用
- 非同期処理でのPromise.rejectの使用（Resultを使用）

## コメント規約

- **なぜ**その実装をしたかを説明
- 複雑なビジネスロジックには詳細なコメント
- TSDocを使用した関数の文書化

```typescript
/**
 * 組織を作成し、初期設定を行います
 * @param data - 組織作成データ
 * @returns 作成された組織またはエラー
 */
export const createOrganization = (
  data: CreateOrganizationData
): Result<Organization, CreateOrganizationError> => {
  // implementation
};
```

これらのガイドラインに従って、保守性が高く、型安全なコードの生成をお願いします。

## ドキュメント更新ポリシー

### 自動更新要件

#### 全体的な変更（このファイル: copilot-instructions.md を更新）
- **モノレポ構成変更**: 新しいトップレベルディレクトリの追加、削除
- **アーキテクチャ変更**: backend, frontend, shared の関係性や責務の変更
- **技術スタック変更**: 主要なライブラリ・フレームワークの追加・削除・変更
- **実装ポリシー変更**: 全体に影響するコーディング規約やパターンの変更

#### パス固有の変更（該当する .github/instructions/*.md を更新）
- **backend/** の変更 → `backend.instructions.md` を更新
  - ディレクトリ構造、tRPC/Temporal のエントリーポイント、DB操作パターン等
- **frontend/** の変更 → `frontend.instructions.md` を更新
  - Next.js の構造、API通信パターン、コンポーネント設計等
- **shared/** の変更 → `shared.instructions.md` を更新
  - 型定義の追加方法、tsconfig 設定、型共有のパターン等
- **backend/src/shared/db/** の変更 → `database.instructions.md` を更新
  - データベーススキーマ、マイグレーション、アンチパターン対策等

#### ビジネス要件の変更（business-requirements.instructions.md を更新）
- **機能要件変更**: 新機能追加、既存機能の仕様変更
- **ユーザーロール変更**: 権限体系の変更、新しいロールの追加
- **ビジネスルール変更**: 予約・決済・キャンセルルールの変更
- **非機能要件変更**: パフォーマンス・セキュリティ・拡張性要件の変更
- **コンプライアンス要件変更**: GDPR、個人情報保護法等の対応変更

### 更新タイミング

**リファクタリング、新機能追加、アーキテクチャ変更、ビジネス要件変更の完了後すぐに実行すること。**

- コード変更とドキュメント更新を同じPRに含める
- 変更があったディレクトリの指示ファイルも同時に更新
- モノレポ全体に影響する変更は `copilot-instructions.md` を更新
- ビジネス要件の変更は `business-requirements.instructions.md` を更新

### 更新時のチェックリスト

- [ ] 該当するディレクトリの指示ファイル（backend/frontend/shared/database.instructions.md）を確認
- [ ] ビジネス要件の変更がある場合は `business-requirements.instructions.md` を確認
- [ ] ディレクトリ構造の図を更新
- [ ] 新しい技術スタックを追加
- [ ] コード例を最新の構造に合わせて更新
- [ ] 新機能のビジネスルールを要件書に反映
- [ ] 必要に応じて全体の copilot-instructions.md も更新
