---
applyTo: "backend/src/workflows/**"
---

# Workflow Layer Instructions

## 基本原則

- **Errorをthrowして良い**（Temporal標準に従う）
- C/U/D操作は必ずWorkflow経由で実行
- Read操作は通常の関数として実装し、tRPCから直接呼び出し可能
- SAGAパターンで補償処理を実装

## ファイル構造

```
workflows/
├── index.ts                # Workflow exports
├── user.ts                 # User Workflows
├── organization.ts         # Organization Workflows
└── *.ts                    # Other workflows
```

## 実装パターン

### CUD操作（Temporal Workflow）

```typescript
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from '../activities';

const { createUserActivity, deleteUserActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10s'
});

export async function createUserWorkflow(input: CreateUserInput): Promise<User> {
  const result = await createUserActivity(input);
  if (result.isErr()) {
    throw new ApplicationFailure(result.error.message, result.error.code);
  }
  return result.value;
}
```

### Read操作（通常の関数）

```typescript
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

### SAGA パターン

```typescript
export async function createUserWithCompensationWorkflow(input: CreateUserInput): Promise<User> {
  let createdUserId: string | null = null;
  let createdAuth0User: boolean = false;

  try {
    // Step 1: Create in Auth0
    const auth0Result = await createAuth0UserActivity(input);
    if (auth0Result.isErr()) {
      throw new ApplicationFailure('Failed to create Auth0 user', 'AUTH0_ERROR');
    }
    createdAuth0User = true;

    // Step 2: Create in DB
    const dbResult = await createDbUserActivity({ ...input, auth0Id: auth0Result.value.id });
    if (dbResult.isErr()) {
      throw new ApplicationFailure('Failed to create DB user', 'DATABASE_ERROR');
    }
    createdUserId = dbResult.value.id;

    return dbResult.value;
  } catch (error) {
    // Compensation actions
    if (createdUserId) {
      await deleteDbUserActivity(createdUserId);
    }
    if (createdAuth0User) {
      await deleteAuth0UserActivity(input.email);
    }
    throw error;
  }
}
```

## 重複制御

- Workflow Id Reuse Policy: DuplicateをtRPC側で使用
- WorkflowではSignal/Updateを使わずシンプルな処理フローに留める

## 参考資料

- [SAGA Pattern Example](https://github.com/temporalio/samples-typescript/tree/main/saga)
- [Temporal TypeScript SDK](https://typescript.temporal.io/)