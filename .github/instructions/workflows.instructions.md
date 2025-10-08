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
  // ApplicationFailure はそのまま throw される
  const user = await createUserActivity(input);
  return user;
}
```

### Read操作（通常の関数）

```typescript
export async function getUserWithDetails(userId: string): Promise<UserDetails> {
  const { fetchUserProfileActivity, fetchUserPreferencesActivity } = 
    await import('../activities');

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

### SAGA パターン

```typescript
export async function createUserWithCompensationWorkflow(input: CreateUserInput): Promise<User> {
  let createdUserId: string | null = null;
  let createdAuth0User: boolean = false;

  try {
    // Step 1: Create in Auth0
    const auth0User = await createAuth0UserActivity(input);
    createdAuth0User = true;

    // Step 2: Create in DB
    const dbUser = await createDbUserActivity({ ...input, auth0Id: auth0User.id });
    createdUserId = dbUser.id;

    return dbUser;
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