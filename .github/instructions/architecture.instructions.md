---
applyTo: "backend/**"
---

# Alllbe Proto 開発指針

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

## 設計原則

### 1. レイヤー構造

#### tRPC → Workflow → Activity の流れを厳守
- **tRPC Handler**: クライアントからのリクエストを受けて、Temporal Workflowを呼び出す
- **Workflow**: ビジネスロジックの協調・補償処理・状態管理を担当
- **Activity**: データベース操作・外部API呼び出しなど具体的な処理を実行

#### Activity実装の原則
- **ApplicationFailure を使用**してError処理を行う
- **try-catch でエラーを捕捉**し、ApplicationFailure を throw する
- `backend/src/activities/db/models/*.ts`に実装
- 単一責任の原則に従い、1つのActivityは1つの具体的な操作のみ行う

#### Workflow実装の原則
- **ApplicationFailure を throw**（Temporal標準に従う）
- C/U/D操作は必ずWorkflow経由で実行
- Read操作は通常の関数として実装し、tRPCから直接呼び出し可能
- SAGAパターンで補償処理を実装

### 2. エラーハンドリング戦略

```typescript
// Activity (ApplicationFailure)
export const createUserActivity = (db: Database) => 
  async (input: CreateUserInput): Promise<User> => {
    try {
      const result = await db.insert(users).values(input).returning();
      if (!result[0]) {
        throw createUserError({
          type: UserErrorType.DATABASE_ERROR,
          message: 'Failed to create user: no rows returned',
          nonRetryable: false,
        });
      }
      return result[0];
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

// Workflow (ApplicationFailure を throw)
export async function createUserWorkflow(input: CreateUserInput): Promise<User> {
  // Activity から ApplicationFailure がそのまま throw される
  const user = await activities.createUserActivity(input);
  return user;
}
```

### 3. 重複制御

- **Workflow Id Reuse Policy: Duplicate**を使用
- 重複制御はtRPC Client側で管理する責務
- Workflowでは、必要がなければ Signal/Updateを使わずシンプルな処理フローに留める

### 4. SAGA パターン

- https://github.com/temporalio/samples-typescript/tree/main/saga のサンプルを参考
- 失敗時の補償処理（compensating actions）を必ず実装
- ロングランニングトランザクションに使用

### 5. アンチパターン

#### 避けるべき構造
- `service/`ディレクトリの作成
- `repository/`ディレクトリの作成
- 過度な抽象化
- 不要な機能の実装

#### 推奨しない実装
- 過度な抽象化レイヤーの追加
- tRPCからActivityの直接呼び出し（Read操作除く）
- エラー情報の不足（詳細なコンテキストを含めること）

## ファイル構造

```
backend/src/
├── shared/
│   └── logger/
│       ├── index.ts                 # Logger exports
│       ├── winston.ts               # Winston configuration
│       └── types.ts                 # Logger types
├── activities/
│   ├── index.ts                     # Activity exports (+ Activity Context Logger)
│   ├── db/
│   │   ├── models/
│   │   │   ├── user.ts              # User Activity implementations
│   │   │   ├── organization.ts      # Organization Activity implementations
│   │   │   └── *.ts                 # Other model activities
│   │   ├── connection.ts
│   │   └── schema.ts
│   └── auth/
│       ├── activities.ts            # Auth Activity implementations
│       └── types.ts
├── workflows/
│   ├── index.ts                     # Workflow exports
│   ├── logger.ts                    # Temporal Runtime logger initialization
│   ├── user.ts                      # User Workflows
│   ├── organization.ts              # Organization Workflows
│   └── *.ts                         # Other workflows
└── trpc/
    ├── base.ts
    ├── logger.ts                    # tRPC logger initialization
    ├── user.ts                      # User tRPC routes
    ├── organization.ts              # Organization tRPC routes
    └── index.ts
```

## 実装パターン

### Read操作の実装例

```typescript
// userWorkflows.ts
import { proxyActivities } from '@temporalio/workflow';

const activities = proxyActivities<typeof import('./activities')>({
  startToCloseTimeout: '10s'
});

// ============================================
// Temporal Workflow (C/U/D)
// ============================================
export async function createUserWorkflow(data: CreateUserRequest) {
  return await activities.createUserActivity(data);
}

// ============================================
// 通常の関数 (R操作)
// ============================================
export async function getUserWithDetails(userId: string): Promise<UserDetails> {
  const { fetchUserProfileActivity, fetchUserPreferencesActivity } = 
    await import('./activities');

  const [profile, preferences] = await Promise.all([
    fetchUserProfileActivity(userId),
    fetchUserPreferencesActivity(userId)
  ]);

  return {
    ...profile,
    preferences
  };
}
```

### tRPC Handler実装例

```typescript
// trpc/user.ts
export const userRouter = router({
  // Read操作 - Workflowの通常関数を直接呼び出し
  getById: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return await getUserWithDetails(input);
    }),

  // C/U/D操作 - Workflow Clientを使用
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      const workflowId = `user-${input.email}`;
      const handle = await client.workflow.start(createUserWorkflow, {
        args: [input],
        taskQueue: 'main',
        workflowId,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
      });
      return await handle.result();
    }),
});
```

## 開発の進め方

1. **schema定義** → models内のActivity関数実装
2. **Workflow実装** （CUD + Read関数）
3. **tRPC Handler実装**
4. **必要に応じてSAGAパターン追加**

## 参考資料

- [Temporal TypeScript Samples](https://github.com/temporalio/samples-typescript/tree/main)
- [SAGA Pattern Example](https://github.com/temporalio/samples-typescript/tree/main/saga)
- [Temporal ApplicationFailure Documentation](https://typescript.temporal.io/api/classes/common.ApplicationFailure)
- [Temporal Observability](https://docs.temporal.io/develop/typescript/observability)
- [Logger 戦略の詳細](./logger.instructions.md)

---

この指針に従って、シンプルで保守性の高いコードベースを構築する。