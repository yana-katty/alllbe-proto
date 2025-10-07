---
applyTo: "backend/**"
---

# Backend 開発ガイドライン

## アーキテクチャ概要

```
Client (Frontend) 
    ↓ tRPC
Backend (tRPC Handlers)
    ↓ Temporal Client
Temporal Workflows
    ↓ proxyActivities
Temporal Activities
    ↓ Database/External APIs
```

### 新しいアーキテクチャの原則

1. **tRPC → Workflow → Activity の流れを厳守**
2. **try-catch ベースのエラーハンドリング（Temporal との親和性）**
3. **カスタムエラークラスで詳細なエラーコードを定義**
4. **service/repository ディレクトリは作成しない**
5. **重複制御は Workflow Id Reuse Policy: Duplicate で client 側管理**

### ディレクトリ構造

```
backend/src/
├── shared/
│   └── errors/              # カスタムエラークラス
│       ├── base.ts          # 基底エラークラス
│       ├── organization.ts  # Organization エラー
│       ├── user.ts          # User エラー
│       └── index.ts         # エクスポート
├── activities/
│   ├── index.ts             # Activity exports
│   ├── db/
│   │   ├── models/
│   │   │   ├── user.ts      # User Activity implementations
│   │   │   ├── organization.ts  # Organization Activity implementations
│   │   │   └── *.ts         # Other model activities
│   │   ├── connection.ts
│   │   └── schema.ts
│   └── auth/
│       ├── auth0/           # Auth0 activities
│       └── workos/          # WorkOS activities
├── actions/
│   ├── organization.ts      # Organization Read actions
│   ├── endUser.ts           # EndUser Read actions
│   └── *.ts                 # Other actions
├── workflows/
│   ├── index.ts             # Workflow exports
│   ├── user.ts              # User Workflows
│   ├── organization.ts      # Organization Workflows
│   └── *.ts                 # Other workflows
└── trpc/
    ├── base.ts              # tRPC設定・ミドルウェア
    ├── index.ts             # ルーターの統合
    ├── user.ts              # User tRPC routes
    ├── organization.ts      # Organization tRPC routes
    └── *.ts                 # Other routes
```

## 実装パターン

### 1. エラー定義（backend/src/activities/db/models/）

**ErrorType enum + ErrorInfo 型 + createXXXError() ファクトリ関数**

```typescript
// backend/src/activities/db/models/organization.ts
import { ApplicationFailure } from '@temporalio/common';

/**
 * Organization エラータイプ
 * ApplicationFailure.type に直接使用される
 */
export enum OrganizationErrorType {
    NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'ORGANIZATION_ALREADY_EXISTS',
    INVALID_INPUT = 'ORGANIZATION_INVALID_INPUT',
    DATABASE_ERROR = 'ORGANIZATION_DATABASE_ERROR',
    WORKOS_ERROR = 'ORGANIZATION_WORKOS_ERROR',
}

/**
 * Organization エラー情報
 * ApplicationFailure 生成に必要な情報を構造化
 */
export interface OrganizationErrorInfo {
    type: OrganizationErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Organization エラー作成ファクトリ
 * 
 * @param info - エラー情報
 * @returns ApplicationFailure インスタンス
 * 
 * @example
 * ```typescript
 * throw createOrganizationError({
 *   type: OrganizationErrorType.ALREADY_EXISTS,
 *   message: `Organization already exists: ${id}`,
 *   details: { organizationId: id },
 *   nonRetryable: true, // 重複エラーはリトライ不要
 * });
 * ```
 */
export const createOrganizationError = (info: OrganizationErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type, // ErrorType を type に直接使用
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};
```

**設計の利点**:
- ErrorType を ApplicationFailure.type に直接マッピング（変換不要）
- Error 継承を排除して軽量化
- nonRetryable フラグで Temporal のリトライ制御
- details 配列で構造化されたコンテキスト情報

### 2. Activity 層（backend/src/activities/db/models/）

**try-catch でエラーハンドリング、ApplicationFailure を throw**

```typescript
import { ApplicationFailure } from '@temporalio/common';
import { Database } from '../connection';
import { OrganizationErrorType, createOrganizationError } from './organization';

/**
 * Organization を挿入
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_ALREADY_EXISTS) - 既に存在する場合
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 */
export const insertOrganization = (db: Database): InsertOrganization =>
    async (data: OrganizationCreateInput): Promise<Organization> => {
        try {
            // 既存チェック
            const existing = await db.select()
                .from(organizations)
                .where(eq(organizations.id, data.id))
                .limit(1);

            if (existing.length > 0) {
                throw createOrganizationError({
                    type: OrganizationErrorType.ALREADY_EXISTS,
                    message: `Organization already exists: ${data.id}`,
                    details: { organizationId: data.id },
                    nonRetryable: true, // 重複エラーはリトライしない
                });
            }

            const result = await db.insert(organizations)
                .values({ id: data.id })
                .returning();

            if (!result[0]) {
                throw createOrganizationError({
                    type: OrganizationErrorType.DATABASE_ERROR,
                    message: 'Failed to insert organization: no rows returned',
                    nonRetryable: false, // DB エラーはリトライ可能
                });
            }

            return selectOrganizationSchema.parse(result[0]);
        } catch (error) {
            // ApplicationFailure はそのまま再スロー
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            // 予期しないエラーは DATABASE_ERROR として扱う
            throw createOrganizationError({
                type: OrganizationErrorType.DATABASE_ERROR,
                message: 'Failed to insert organization',
                details: error,
                nonRetryable: false,
            });
        }
    };
```

**ポイント**:
- ApplicationFailure を直接 throw（Result 型不要）
- error.type でエラー種別を判定可能
- nonRetryable で細かいリトライ制御

### 3. Actions 層（backend/src/actions/）

**Read 操作を提供、ApplicationFailure は呼び出し元に伝播**

```typescript
/**
 * Organization取得 (ID指定) - DB と WorkOS を統合
 * 
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR) - DB操作エラー
 * @throws ApplicationFailure (type: ORGANIZATION_NOT_FOUND) - Organization が見つからない場合
 */
export const getOrganizationById = (deps: Pick<OrganizationActionDeps, 'findOrganizationByIdActivity' | 'getWorkosOrganizationActivity'>) =>
    async (id: string): Promise<OrganizationWithWorkos | null> => {
        // DB から Organization を取得（ApplicationFailure は throw される）
        const org = await deps.findOrganizationByIdActivity(id);

        if (!org) {
            return null;
        }

        // WorkOS データの取得（オプション）
        if (deps.getWorkosOrganizationActivity) {
            try {
                const workosData = await deps.getWorkosOrganizationActivity(org.id);
                return { ...org, workosData };
            } catch (error) {
                // WorkOS エラーは無視してDB データのみ返す
                console.warn('Failed to fetch WorkOS data', { organizationId: org.id, error });
            }
        }

        return org;
    };
```

**ポイント**:
- ApplicationFailure はそのまま throw（catch 不要）
- error.type でエラー種別を判定可能
- JSDoc に @throws で ApplicationFailure の type を記載

### 4. Workflow 層（backend/src/workflows/）

**Temporal の自動リトライを活用、ApplicationFailure はそのまま伝播**

```typescript
import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type * as activities from '../activities';

const { insertOrganization, removeOrganization } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    maximumInterval: '10s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

/**
 * Organization 作成 Workflow
 */
export async function createOrganizationWorkflow(input: OrganizationCreateInput): Promise<Organization> {
    try {
        const organization = await insertOrganization(input);
        log.info('Organization created successfully', { organizationId: organization.id });
        return organization;
    } catch (error) {
        // ApplicationFailure はそのまま再スロー
        // error.type でエラー種別を確認可能
        if (error instanceof ApplicationFailure) {
            log.error('Organization creation failed', { 
                type: error.type, 
                message: error.message 
            });
            throw error;
        }
        // 予期しないエラーは新しい ApplicationFailure として扱う
        throw ApplicationFailure.create({
            message: 'Unexpected error in workflow',
            type: 'WORKFLOW_ERROR',
            details: [error],
            nonRetryable: false,
        });
    }
}
```

**ポイント**:
- ApplicationFailure は基本的にそのまま再スロー
- error.type でエラー種別を判定
- nonRetryable に応じて Temporal が自動でリトライ制御

### 5. SAGA パターン（backend/src/workflows/）

**補償処理で複数の Activity を協調**

```typescript
interface Compensation {
  message: string;
  fn: () => Promise<void>;
}

export async function createOrganizationWithWorkosWorkflow(input: CreateOrgInput): Promise<Organization> {
  const compensations: Compensation[] = [];
  
  try {
    // Step 1: WorkOS Organization 作成
    const workosOrg = await createWorkosOrganizationActivity(input);
    compensations.unshift({
      message: `Deleting WorkOS Organization: ${workosOrg.id}`,
      fn: () => deleteWorkosOrganizationActivity(workosOrg.id),
    });

    // Step 2: DB Organization 作成
    const dbOrg = await insertOrganization({ id: workosOrg.id });
    compensations.unshift({
      message: `Deleting DB Organization: ${dbOrg.id}`,
      fn: () => removeOrganization(dbOrg.id),
    });

    return dbOrg;
  } catch (error) {
    // 補償処理を実行（逆順）
    await compensate(compensations);
    throw error;
  }
}

async function compensate(compensations: Compensation[]): Promise<void> {
  for (const comp of compensations) {
    try {
      log.info(`Compensating: ${comp.message}`);
      await comp.fn();
    } catch (err) {
      log.error(`Compensation failed: ${comp.message}`, { err });
      // 補償失敗は記録するが、Workflow は継続
    }
  }
}
```

### 6. tRPC ハンドラ層（backend/src/trpc/）

**ApplicationFailure.type を HTTP ステータスコードにマッピング**

```typescript
import { TRPCError } from '@trpc/server';
import { ApplicationFailure } from '@temporalio/common';

export const organizationRouter = router({
  getById: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      try {
        return await getOrganizationById(deps)(input);
      } catch (error) {
        // ApplicationFailure.type を使ってエラー種別を判定
        if (error instanceof ApplicationFailure) {
          // type に基づいて適切な HTTP ステータスコードにマッピング
          const trpcCode = mapTemporalErrorToTRPC(error.type);
          throw new TRPCError({
            code: trpcCode,
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
});

/**
 * Temporal ApplicationFailure.type を tRPC エラーコードにマッピング
 */
function mapTemporalErrorToTRPC(type: string): TRPC_ERROR_CODE_KEY {
  // NOT_FOUND パターン
  if (type.endsWith('_NOT_FOUND')) {
    return 'NOT_FOUND';
  }
  // ALREADY_EXISTS パターン
  if (type.endsWith('_ALREADY_EXISTS')) {
    return 'CONFLICT';
  }
  // INVALID_INPUT パターン
  if (type.endsWith('_INVALID_INPUT')) {
    return 'BAD_REQUEST';
  }
  // DATABASE_ERROR, その他
  return 'INTERNAL_SERVER_ERROR';
}
```

**ポイント**:
- ApplicationFailure.type を直接使用してエラー判定
- パターンマッチングで柔軟なマッピング
- 詳細なエラー情報は cause に保持

## 技術スタック

- **TypeScript**: 厳密な型安全性
- **Hono**: 軽量高速なWebフレームワーク
- **tRPC + @hono/trpc-server**: 型安全なAPI
- **Temporal**: ワークフロー・非同期処理管理
- **Drizzle ORM**: 型安全なDB操作
- **Neon Database**: PostgreSQL (サーバーレス)
- **vitest**: 高速テストフレームワーク
- **Zod**: スキーマバリデーション
- **Auth0**: エンドユーザー認証・個人情報管理
- **WorkOS**: Organization管理・Enterprise SSO

## コーディング規約

### レイヤー別の原則

#### Activity層
- **try-catch でエラーハンドリング**
- **カスタムエラークラスを throw**
- 単一責任の原則に従う

#### Workflow層
- **Errorをthrowして良い**（Temporal標準に従う）
- C/U/D操作は必ずWorkflow経由で実行
- Read操作は通常の関数として実装

#### tRPC層
- Read操作はWorkflowの通常関数を直接呼び出し
- CUD操作はTemporal Workflow Clientを使用
- Workflow Id Reuse Policy: Duplicateを使用

### エラーハンドリング

```typescript
// ✅ Activity: Result型で返す
export const createUserActivity = (db: Database) => 
  (input: CreateUserInput): ResultAsync<User, UserError> => {
    return ResultAsync.fromPromise(
      db.insert(users).values(input).returning(),
      (error) => ({ code: 'DATABASE_ERROR', message: 'Failed', details: error })
    );
  };

// ✅ Workflow: Errorをthrow
export async function createUserWorkflow(input: CreateUserInput): Promise<User> {
  const result = await createUserActivity(input);
  if (result.isErr()) {
    throw new ApplicationFailure(result.error.message, result.error.code);
  }
  return result.value;
}

// ✅ tRPC: Workflowを呼び出し
export const userRouter = router({
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      const handle = await client.workflow.start(createUserWorkflow, {
        args: [input],
        taskQueue: 'main',
        workflowId: `user-${input.email}`,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
      });
      return await handle.result();
    }),
});
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
- ❌ **DBでの個人情報保存**: 氏名、メール、住所等は Auth0/WorkOS で管理
- ❌ **個人情報の二重管理**: Auth0/WorkOS がマスター、DBは参照のみ

## 自動更新要件

### このファイルを更新すべきタイミング
- backend のディレクトリ構造が変更された時
- 新しい技術スタックが追加された時
- アーキテクチャパターンが変更された時
- コーディング規約が変更された時

**更新は変更完了後すぐに実行すること。**
