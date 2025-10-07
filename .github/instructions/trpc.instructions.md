---
applyTo: "backend/src/trpc/**"
---

# tRPC Layer Instructions

## 基本原則

- **Read操作**: Workflowの通常関数を直接呼び出し
- **CUD操作**: Temporal Workflow Clientを使用してWorkflowを実行
- **重複制御**: Workflow Id Reuse Policy: Duplicateを使用してclient側で管理

## ファイル構造

```
trpc/
├── base.ts              # tRPC設定・ミドルウェア
├── index.ts             # ルーターの統合
├── user.ts              # User tRPC routes
├── organization.ts      # Organization tRPC routes
└── *.ts                 # Other routes
```

## 実装パターン

### Read操作（Query）

```typescript
import { publicProcedure, router } from './base';
import { z } from 'zod';
import { getUserWithDetails } from '../workflows/user';

export const userRouter = router({
  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      // Workflowの通常関数を直接呼び出し
      return await getUserWithDetails(input);
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return await listUsersWithDetails(input);
    }),
});
```

### CUD操作（Mutation）

```typescript
import { Connection, Client, WorkflowIdReusePolicy } from '@temporalio/client';
import { createUserWorkflow, updateUserWorkflow, deleteUserWorkflow } from '../workflows/user';

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
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      const client = await getTemporalClient();
      const workflowId = `user-${input.email}`;
      
      const handle = await client.workflow.start(createUserWorkflow, {
        args: [input],
        taskQueue: 'default',
        workflowId,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
      });
      
      return await handle.result();
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateUserSchema,
    }))
    .mutation(async ({ input }) => {
      const client = await getTemporalClient();
      const workflowId = `user-${input.id}`;
      
      const handle = await client.workflow.start(updateUserWorkflow, {
        args: [input.id, input.data],
        taskQueue: 'default',
        workflowId,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
      });
      
      return await handle.result();
    }),

  delete: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      const client = await getTemporalClient();
      const workflowId = `user-${input}`;
      
      const handle = await client.workflow.start(deleteUserWorkflow, {
        args: [input],
        taskQueue: 'default',
        workflowId,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
      });
      
      return await handle.result();
    }),
});
```

## エラーハンドリング

```typescript
export const userRouter = router({
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      try {
        const client = await getTemporalClient();
        const workflowId = `user-${input.email}`;
        
        const handle = await client.workflow.start(createUserWorkflow, {
          args: [input],
          taskQueue: 'default',
          workflowId,
          workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
        });
        
        return await handle.result();
      } catch (error) {
        if (error instanceof WorkflowFailedError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
});
```

## 注意事項

- Workflow IDは `${resource}-${identifier}` の形式を推奨（例: `user-{userId}`, `organization-{orgId}`）
  - Workflow Id Reuse Policy: ALLOW_DUPLICATE により、同じIDで複数回実行可能
  - timestampは不要（重複実行が可能なため）
- Temporal Clientはシングルトンとして管理し、接続を再利用する
- CUD操作は必ずWorkflow経由で実行し、直接Activityを呼び出さない
- Read操作はパフォーマンスのためWorkflowの通常関数を使用