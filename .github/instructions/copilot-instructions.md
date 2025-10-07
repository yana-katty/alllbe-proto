---
applyTo: "**"
---

# GitHub Copilot Instructions: Alllbe

## プロジェクト概要

- **目的**: Location Based Entertainment (LBE) の B2B2C Experience 予約管理システム
- **アーキテクチャ**: モノレポ構成 + 関数型プログラミング + 高階関数依存注入パターン
- **主要技術**: 
  - **Backend**: TypeScript, Hono, tRPC, Temporal, Drizzle ORM, Neon Database, vitest
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
│   ├── activities/         # DB操作・外部API呼び出し（純粋関数）
│   │   ├── db/models/      # DB操作Activity
│   │   └── auth/           # Auth0/WorkOS Activity
│   ├── actions/            # Read操作（tRPCから直接呼び出し可能）
│   ├── workflows/          # Temporal Workflows (CUD操作)
│   └── trpc/               # tRPC API handlers
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

### レイヤー構造

Backend は4つの主要なレイヤーで構成されています：

- **Activities**: DB操作・外部API呼び出しの純粋関数、ApplicationFailure をthrow
- **Actions**: Read操作の通常関数（tRPCから直接呼び出し可能）
- **Workflows**: CUD操作のTemporal Workflows、補償処理（SAGA）
- **tRPC**: API エンドポイント（Actions/Workflowsを呼び出し）

**詳細は [Backend Layers Instructions](./backend-layers.instructions.md) を参照してください。**

### エラーハンドリング統一（ApplicationFailure ベース）

すべてのエラーは ApplicationFailure で統一されています：

```typescript
// ErrorType 定義
export enum OrganizationErrorType {
    NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'ORGANIZATION_ALREADY_EXISTS',
    DATABASE_ERROR = 'ORGANIZATION_DATABASE_ERROR',
}

// ファクトリ関数
export const createOrganizationError = (info: OrganizationErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};

// Activity層での使用
export const insertOrganization = (db: Database): InsertOrganization =>
    async (data: OrganizationCreateInput): Promise<Organization> => {
        try {
            // DB操作
            const result = await db.insert(organizations).values(data).returning();
            if (!result[0]) {
                throw createOrganizationError({
                    type: OrganizationErrorType.DATABASE_ERROR,
                    message: 'Failed to insert: no rows returned',
                    nonRetryable: false,
                });
            }
            return result[0];
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to insert organization',
                details: error,
                nonRetryable: false,
            });
        }
    };
```

## テスト方針

### 単体テスト (Unit Tests)
- **純粋関数を重点テスト**: ビジネスロジック関数を個別にテスト
- **依存関数の最小化**: `Pick<Deps, 'xxx' | 'yyy'>` で必要な関数のみモック
- **ApplicationFailure の検証**: `expect(() => fn()).rejects.toThrow(ApplicationFailure)`
- **error.type の確認**: `error.type` で詳細なエラー種別を検証
- **エラーパスの網羅**: 正常系・異常系を包括的にテスト

### テストツール
- **vitest**: TypeScript ネイティブ、高速、モダンなテストランナー
- **vi.fn()**: 依存関数のモック作成

詳細なテスト例については [Testing Instructions](./testing.instructions.md) を参照してください。

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
2. **ApplicationFailure ベースのエラーハンドリング**: ErrorType enum + ファクトリ関数による型安全なエラー処理
3. **依存注入**: 高階関数による疎結合、テスト容易性の確保
4. **型安全性**: Zodスキーマ + TypeScriptでランタイム・コンパイル時双方の安全性
5. **最小権限**: Pick<>で必要な関数のみ受け取り、過度な依存を回避
6. **モノレポ構成**: backend, frontend, shared で分離、型定義は shared で一元管理

## コーディング規約

### 関数型プログラミング
- **純粋関数**を優先し、副作用を最小限に抑える
- **不変性**を保つ - オブジェクトの変更ではなく新しいオブジェクトの作成
- **ApplicationFailure**を使用してエラーハンドリングを行う
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
- **ApplicationFailure**による例外安全なエラーハンドリング

### データベース操作
- **Drizzle ORM**を使用したtype-safeなクエリ
- **try-catch**によるDB操作のエラーハンドリング
- **db/models層での抽象化**により具体的なDB実装に依存しない設計

## データベース設計

**専用ガイドライン**: `database.instructions.md`を参照

このプロジェクトでは「SQL Antipatterns, Volume 1」の知見を活用し、`backend/src/activities/db/**` でのデータベース設計時にアンチパターンを避けた最適なスキーマ設計を行います。詳細な設計原則、チェックリスト、ユーザーとの議論フローについては、専用の指示ファイルを参照してください。

## テスト戦略

### 単体テスト
- **vitest**: TypeScript ネイティブ、高速テストフレームワーク
- **最小依存**: Pick<>による必要最小限のモック
- **エラーハンドリング検証**: try-catch + instanceof によるエラー種別確認
- **エラーコード検証**: error.code による詳細なエラー分類

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
// backend/src/actions/organization.ts
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

### エラーハンドリングパターン
```typescript
// Activity層でのエラー処理
export const createUser = (db: Database) => async (input: UserCreateInput): Promise<User> => {
  try {
    const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) {
      throw createUserError({
        type: UserErrorType.ALREADY_EXISTS,
        message: `User already exists: ${input.email}`,
        details: { email: input.email },
        nonRetryable: true,
      });
    }

    const result = await db.insert(users).values(input).returning();
    if (!result[0]) {
      throw createUserError({
        type: UserErrorType.DATABASE_ERROR,
        message: 'Failed to insert user: no rows returned',
        nonRetryable: false,
      });
    }

    return userSchema.parse(result[0]);
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }
    throw createUserError({
      type: UserErrorType.DATABASE_ERROR,
      message: 'Failed to create user',
      details: error,
      nonRetryable: false,
    });
  }
};

// Actions層での型安全なエラー宣言
/**
 * @throws ApplicationFailure (type: USER_NOT_FOUND) - ユーザーが見つからない場合
 * @throws ApplicationFailure (type: USER_DATABASE_ERROR) - DB操作エラー
 */
export const getUserById = (deps: Pick<UserActionDeps, 'findUserById'>) =>
  async (id: string): Promise<User | null> => {
    return await deps.findUserById(id);
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
- グローバル変数の使用
- 副作用のある関数の無制限な使用

## コメント規約

- **なぜ**その実装をしたかを説明
- 複雑なビジネスロジックには詳細なコメント
- TSDocを使用した関数の文書化
- **@throws**: 発生する可能性のあるApplicationFailure.typeを必ず記載

```typescript
/**
 * 組織を作成し、初期設定を行います
 * @param data - 組織作成データ
 * @returns 作成された組織
 * @throws ApplicationFailure (type: ORGANIZATION_ALREADY_EXISTS) - 組織が既に存在する場合
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const createOrganization = async (
  data: CreateOrganizationData
): Promise<Organization> => {
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
- **backend/src/activities/db/** の変更 → `database.instructions.md` を更新
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

## README.md 管理方針

### 基本原則

**README.mdは最小限の情報のみを記載し、詳細は `.github/instructions/` を参照する**

### README.mdに記載すべき内容

- **プロジェクト概要**: 1-2行の簡潔な説明
- **アーキテクチャ図**: 簡潔な構成図（詳細は instructions へのリンク）
- **ディレクトリ構造**: 主要なディレクトリのみ（1階層まで）
- **開発コマンド**: `npm install`, `npm run dev` などの基本コマンド
- **参考資料へのリンク**: `.github/instructions/` への参照

### README.mdに記載すべきでない内容

❌ **詳細な設計方針** → `.github/instructions/architecture.instructions.md`
❌ **実装パターン** → `.github/instructions/backend.instructions.md`, etc.
❌ **コーディング規約** → `.github/instructions/` の各ファイル
❌ **長いコード例** → instructions ファイルに記載
❌ **技術スタックの詳細説明** → instructions ファイルに記載

### 更新時の注意

- README.mdを更新する際は、**必ず冗長性をチェック**
- 詳細な説明は instructions ファイルに移動
- README.mdは「クイックスタートガイド」として機能させる
- 新機能追加時は README.md を肥大化させない

### 例: 良いREADME.md

```markdown
# Backend

体験イベント予約管理システムのバックエンド

## アーキテクチャ

[簡潔な図]

**詳細**: `.github/instructions/architecture.instructions.md` を参照

## 開発

\`\`\`bash
npm install
npm run dev
\`\`\`

## 参考資料

- [設計方針](.github/instructions/)
```
