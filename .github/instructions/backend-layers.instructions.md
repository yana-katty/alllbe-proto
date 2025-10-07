---
applyTo: "backend/src/{actions,activities,workflows,trpc}/**"
---

# Backend Layers Instructions

Backend は3つの主要なレイヤーで構成されています:
- **Activities**: DB操作・外部API呼び出しの純粋関数
- **Actions**: Read操作の通常関数（tRPCから直接呼び出し可能）
- **Workflows**: CUD操作のTemporal Workflows
- **tRPC**: API エンドポイント（Actions/Workflowsを呼び出し）

## Activities Layer

### 基本原則

- **ApplicationFailure を使用**してエラーハンドリングを行う
- **try-catch でエラーを捕捉**し、ApplicationFailure を throw する
- 単一責任の原則: 1つのActivityは1つの具体的な操作のみ
- **環境変数を直接読み込まない**: 依存注入パターンを使用

### エラーハンドリングパターン

```typescript
import { ApplicationFailure } from '@temporalio/common';

export enum OrganizationErrorType {
    NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'ORGANIZATION_ALREADY_EXISTS',
    DATABASE_ERROR = 'ORGANIZATION_DATABASE_ERROR',
}

export interface OrganizationErrorInfo {
    type: OrganizationErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

export const createOrganizationError = (info: OrganizationErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};

export type InsertOrganization = (data: OrganizationCreateInput) => Promise<Organization>;

export const insertOrganization = (db: Database): InsertOrganization =>
    async (data: OrganizationCreateInput): Promise<Organization> => {
        try {
            const result = await db.insert(organizations).values(data).returning();
            if (!result[0]) {
                throw createOrganizationError({
                    type: OrganizationErrorType.DATABASE_ERROR,
                    message: 'Failed to insert: no rows returned',
                    nonRetryable: false,
                });
            }
            return selectOrganizationSchema.parse(result[0]);
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

### 依存注入パターン（カリー化）

```typescript
export type GetAuth0User = (userId: string) => Promise<Auth0UserProfile>;

export const getAuth0User = (client: ManagementClient): GetAuth0User =>
    async (userId: string) => {
        try {
            return await client.users.get(userId);
        } catch (error) {
            throw createAuth0Error({
                type: Auth0ErrorType.API_ERROR,
                message: 'Failed to fetch user from Auth0',
                details: error,
                nonRetryable: false,
            });
        }
    };
```

## Actions Layer

### 基本原則

- **Temporal Workflowではない通常の関数**
- **主にRead操作**: 1つの更新Activityまで許容
- **tRPCから直接呼び出し可能**
- **複雑な更新はWorkflowで**: 複数の更新操作や補償が必要な場合

### 実装パターン

```typescript
type GetOrganizationByIdActivity = (id: string) => Promise<Organization | null>;

interface OrganizationActionDeps {
    getOrganizationByIdActivity: GetOrganizationByIdActivity;
}

/**
 * @throws ApplicationFailure (type: ORGANIZATION_DATABASE_ERROR)
 * @throws ApplicationFailure (type: ORGANIZATION_NOT_FOUND)
 */
export const getOrganizationById = (deps: Pick<OrganizationActionDeps, 'getOrganizationByIdActivity'>) =>
    async (id: string): Promise<Organization | null> => {
        return await deps.getOrganizationByIdActivity(id);
    };
```

## Workflows Layer

### 基本原則

- **ApplicationFailure を throw**（Temporal標準）
- **CUD操作は必ずWorkflow経由**
- **Read操作はActions層**で実装
- **SAGAパターン**で補償処理を実装

### 実装パターン

```typescript
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { InsertOrganization, DeleteOrganization } from '../activities/db/models/organization';

const { insertOrganization, deleteOrganization } = proxyActivities<{
    insertOrganization: InsertOrganization;
    deleteOrganization: DeleteOrganization;
}>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

export async function createOrganizationWorkflow(input: CreateOrganizationInput): Promise<Organization> {
    // Activity呼び出し - ApplicationFailure はそのまま throw される
    const org = await insertOrganization(input);
    return org;
}

export async function createOrganizationWithCompensationWorkflow(input: CreateOrganizationInput): Promise<Organization> {
    let createdOrgId: string | null = null;

    try {
        const org = await insertOrganization(input);
        createdOrgId = org.id;
        return org;
    } catch (error) {
        // 補償処理
        if (createdOrgId) {
            await deleteOrganization(createdOrgId);
        }
        throw error;
    }
}
```

## tRPC Layer

### 基本原則

- **Read操作**: Actions層を直接呼び出し
- **CUD操作**: Temporal Workflow Clientを使用
- **重複制御**: Workflow Id Reuse Policy で管理

### 実装パターン

```typescript
import { router, publicProcedure } from './base';
import { getOrganizationById } from '../actions/organization';
import { findOrganizationById } from '../activities/db/models/organization';
import { createOrganizationWorkflow } from '../workflows/organization';
import { Connection, Client, WorkflowIdReusePolicy } from '@temporalio/client';

// Read操作
export const organizationRouter = router({
    getById: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            const action = getOrganizationById({ 
                getOrganizationByIdActivity: findOrganizationById(db) 
            });
            return await action(input);
        }),

    // CUD操作
    create: publicProcedure
        .input(createOrganizationSchema)
        .mutation(async ({ input }) => {
            const client = await getTemporalClient();
            const workflowId = `org-create-${input.id}`;
            
            const handle = await client.workflow.start(createOrganizationWorkflow, {
                args: [input],
                taskQueue: 'main',
                workflowId,
                workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
            });
            
            return await handle.result();
        }),
});
```

## レイヤー間の使い分け

| 操作タイプ | 実装場所 | 呼び出し方法 | 補足 |
|-----------|---------|-------------|------|
| **DB操作・外部API** | `activities/` | Workflowから呼び出し | 純粋関数 |
| **Read操作** | `actions/` | tRPCから直接 | 1つの更新まで許容 |
| **CUD操作** | `workflows/` | Temporal Client経由 | 補償処理・トランザクション |

## 禁止事項

### Activities Layer
- ❌ 環境変数を直接読み込む
- ❌ データを読んで判断する処理（Workflowの責務）

### Actions Layer
- ❌ 複数の更新操作
- ❌ 補償処理が必要な更新
- ❌ Temporal Workflow機能（proxyActivities等）

### Workflows Layer
- ❌ Activity内で複雑なビジネスロジック（Workflowで判断）

## 参考資料

- [Architecture Guidelines](./architecture.instructions.md)
- [Database Guidelines](./database.instructions.md)
- [Testing Guidelines](./testing.instructions.md)
