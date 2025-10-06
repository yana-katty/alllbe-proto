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
2. **Activity は Neverthrow を使用、Error を throw しない**
3. **Workflow は Error を throw して良い（Temporal 標準）**
4. **service/repository ディレクトリは作成しない**
5. **重複制御は Workflow Id Reuse Policy: Duplicate で client 側管理**

### ディレクトリ構造

```
backend/src/
├── activities/
│   ├── index.ts              # Activity exports
│   ├── db/
│   │   ├── models/
│   │   │   ├── user.ts      # User Activity implementations
│   │   │   ├── organization.ts  # Organization Activity implementations
│   │   │   └── *.ts         # Other model activities
│   │   ├── connection.ts
│   │   └── schema.ts
│   └── auth/
│       ├── activities.ts    # Auth Activity implementations
│       └── types.ts
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

### 1. Activity 層（backend/src/activities/db/models/）

**Activity は Neverthrow を使用し、Error を throw しない**

```typescript
import { ResultAsync } from 'neverthrow';
import { Database } from '../connection';

export const createUserActivity = (db: Database) => 
  (input: CreateUserInput): ResultAsync<User, UserError> => {
    return ResultAsync.fromPromise(
      db.insert(users).values(input).returning(),
      (error) => ({
        code: 'DATABASE_ERROR',
        message: 'Failed to create user',
        details: error
      })
    );
  };
```

### 2. Workflow 層（backend/src/workflows/）

**Workflow は Error を throw して良い**

```typescript
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from '../activities';

const { createUserActivity, deleteUserActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10s'
});

// ============================================
// Temporal Workflow (C/U/D)
// ============================================
export async function createUserWorkflow(input: CreateUserInput): Promise<User> {
  const result = await createUserActivity(input);
  if (result.isErr()) {
    throw new ApplicationFailure(result.error.message, result.error.code);
  }
  return result.value;
}

// ============================================
// 通常の関数 (R操作)
// ============================================
export async function getUserWithDetails(userId: string): Promise<UserDetails> {
  const { fetchUserProfileActivity, fetchUserPreferencesActivity } = 
    await import('../activities');

  const [profileResult, preferencesResult] = await Promise.all([
    fetchUserProfileActivity(userId),
    fetchUserPreferencesActivity(userId)
  ]);

  if (profileResult.isErr()) {
    throw new Error(`Failed to fetch profile: ${profileResult.error.message}`);
  }
  if (preferencesResult.isErr()) {
    throw new Error(`Failed to fetch preferences: ${preferencesResult.error.message}`);
  }

  return {
    ...profileResult.value,
    preferences: preferencesResult.value
  };
}
```

### 3. tRPC ハンドラ層（backend/src/trpc/）

**Read 操作は Workflow の通常関数を直接呼び出し**
**CUD 操作は Temporal Workflow Client を使用**

```typescript
import { Connection, Client, WorkflowIdReusePolicy } from '@temporalio/client';
import { createUserWorkflow, updateUserWorkflow, getUserWithDetails } from '../workflows/user';

// Temporal Client setup
let client: Client | null = null;

async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });
    client = new Client({ connection });
  }
  return client;
}

export const userRouter = router({
  // Read操作 - Workflowの通常関数を直接呼び出し
  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return await getUserWithDetails(input);
    }),

  // CUD操作 - Workflow Clientを使用
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      const client = await getTemporalClient();
      const workflowId = `user-${input.email}`;
      
      const handle = await client.workflow.start(createUserWorkflow, {
        args: [input],
        taskQueue: 'default',
        workflowId,
        workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
      });
      
      return await handle.result();
    }),
});
```

### 4. SAGA パターン（backend/src/workflows/）

**Temporal samples-typescript の SAGA パターンを参考に実装**

```typescript
interface Compensation {
  message: string;
  fn: () => Promise<void>;
}

export async function createUserWithCompensationWorkflow(input: CreateUserInput): Promise<User> {
  const compensations: Compensation[] = [];
  
  try {
    // Step 1: Create in Auth0
    const auth0Result = await createAuth0UserActivity(input);
    if (auth0Result.isErr()) {
      throw new ApplicationFailure('Failed to create Auth0 user', 'AUTH0_ERROR');
    }
    compensations.unshift({
      message: 'reversing Auth0 user creation',
      fn: () => deleteAuth0UserActivity(input.email),
    });

    // Step 2: Create in DB
    const dbResult = await createDbUserActivity({ ...input, auth0Id: auth0Result.value.id });
    if (dbResult.isErr()) {
      throw new ApplicationFailure('Failed to create DB user', 'DATABASE_ERROR');
    }

    return dbResult.value;
  } catch (error) {
    // Compensation actions - 逆順で実行
    await compensate(compensations);
    throw error;
  }
}

async function compensate(compensations: Compensation[]): Promise<void> {
  for (const comp of compensations) {
    try {
      log.error(comp.message);
      await comp.fn();
    } catch (err) {
      log.error(`compensation failed: ${err}`, { err });
      // 補償失敗は記録するが、Workflowは継続
    }
  }
}
```

## 技術スタック

- **TypeScript**: 厳密な型安全性
- **Hono**: 軽量高速なWebフレームワーク
- **tRPC + @hono/trpc-server**: 型安全なAPI
- **Temporal**: ワークフロー・非同期処理管理
- **Drizzle ORM**: 型安全なDB操作
- **Neon Database**: PostgreSQL (サーバーレス)
- **neverthrow**: Result型によるエラーハンドリング（Activity層で使用）
- **vitest**: 高速テストフレームワーク
- **Zod**: スキーマバリデーション
- **Auth0**: エンドユーザー認証・個人情報管理
- **WorkOS**: Organization管理・Enterprise SSO

## コーディング規約

### レイヤー別の原則

#### Activity層
- **必ずNeverthrowを使用**してエラーハンドリング
- **Errorをthrowしない**（ResultAsync<T, E>で返す）
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
        taskQueue: 'default',
        workflowId: `user-${input.email}`,
        workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
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
