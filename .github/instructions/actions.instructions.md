---
applyTo: "backend/src/actions/**"
---

# Actions Layer Instructions

## 基本原則

- **Temporal Workflowではない通常の関数**として実装
- **主にRead操作**: データの取得が主な目的だが、**1つの更新Activityまで許容**
- **Activityを直接呼び出し**: proxyActivitiesを使わず、dynamic importで直接呼び出す
- **tRPCから直接呼び出し可能**: Temporal Clientを経由せずに使用できる
- **複雑な更新はWorkflowで**: 複数の更新操作や補償が必要な場合はWorkflowを使用

## ファイル構造

```
actions/
├── index.ts                # Action exports
├── user.ts                 # User Action functions
├── organization.ts         # Organization Action functions
└── *.ts                    # Other action functions
```

## 実装パターン

### 依存注入パターン（テスト容易性のため推奨）

Activity関数を依存注入することで、テスト時にモックを簡単に差し込めます。

```typescript
// actions/organization.ts
import type { Organization } from '../activities/db/schema';
import type { OrganizationQueryInput } from '../activities/db/models/organization';

// Activity関数の型定義
type GetOrganizationByIdActivity = (id: string) => Promise<{ ok: true; value: Organization | null } | { ok: false; error: any }>;
type GetOrganizationByEmailActivity = (email: string) => Promise<{ ok: true; value: Organization | null } | { ok: false; error: any }>;
type ListOrganizationsActivity = (params: OrganizationQueryInput) => Promise<{ ok: true; value: Organization[] } | { ok: false; error: any }>;

// 依存関数の型定義
interface OrganizationActionDeps {
  getOrganizationByIdActivity: GetOrganizationByIdActivity;
  getOrganizationByEmailActivity: GetOrganizationByEmailActivity;
  listOrganizationsActivity: ListOrganizationsActivity;
}

/**
 * Organization取得 (ID指定)
 * 依存注入により、テスト時にモックを差し込める
 */
export const getOrganizationById = (deps: Pick<OrganizationActionDeps, 'getOrganizationByIdActivity'>) =>
  async (id: string): Promise<Organization | null> => {
    const result = await deps.getOrganizationByIdActivity(id);

    if (!result.ok) {
      throw new Error(`Failed to get organization: ${result.error.message}`);
    }

    return result.value;
  };

/**
 * Organization取得 (Email指定)
 */
export const getOrganizationByEmail = (deps: Pick<OrganizationActionDeps, 'getOrganizationByEmailActivity'>) =>
  async (email: string): Promise<Organization | null> => {
    const result = await deps.getOrganizationByEmailActivity(email);

    if (!result.ok) {
      throw new Error(`Failed to get organization: ${result.error.message}`);
    }

    return result.value;
  };

/**
 * Organization一覧取得
 */
export const listOrganizations = (deps: Pick<OrganizationActionDeps, 'listOrganizationsActivity'>) =>
  async (params: OrganizationQueryInput): Promise<Organization[]> => {
    const result = await deps.listOrganizationsActivity(params);

    if (!result.ok) {
      throw new Error(`Failed to list organizations: ${result.error.message}`);
    }

    return result.value;
  };

/**
 * 実際のActivity関数を使用したファクトリ関数
 * tRPCから呼び出す際はこれを使用
 */
export async function createOrganizationActions() {
  const {
    getOrganizationByIdActivity,
    getOrganizationByEmailActivity,
    listOrganizationsActivity,
  } = await import('../activities/db/models/organization');

  return {
    getById: getOrganizationById({ getOrganizationByIdActivity }),
    getByEmail: getOrganizationByEmail({ getOrganizationByEmailActivity }),
    list: listOrganizations({ listOrganizationsActivity }),
  };
}
```

### シンプルパターン（小規模なActionの場合）

テストが不要、または単純なActionの場合は、直接importでも可。

```typescript
// actions/organization.ts
import type { Organization } from '../activities/db/schema';
import type { OrganizationQueryInput } from '../activities/db/models/organization';

/**
 * Organization取得 (ID指定)
 * tRPCから直接呼び出し可能
 */
export async function getOrganizationById(
  id: string
): Promise<Organization | null> {
  const { getOrganizationByIdActivity } = await import('../activities/db/models/organization');
  const result = await getOrganizationByIdActivity(id);

  if (!result.ok) {
    throw new Error(`Failed to get organization: ${result.error.message}`);
  }

  return result.value;
}
```

### 複数のActivityを組み合わせるAction

```typescript
// actions/user.ts
import type { UserDetails } from '../activities/db/schema';

// Activity関数の型定義
type FetchUserProfileActivity = (userId: string) => Promise<{ ok: true; value: any } | { ok: false; error: any }>;
type FetchUserPreferencesActivity = (userId: string) => Promise<{ ok: true; value: any } | { ok: false; error: any }>;

interface UserDetailsDeps {
  fetchUserProfileActivity: FetchUserProfileActivity;
  fetchUserPreferencesActivity: FetchUserPreferencesActivity;
}

/**
 * ユーザー詳細情報を取得
 * 複数のActivityを並列実行して結果を統合
 */
export const getUserWithDetails = (deps: UserDetailsDeps) =>
  async (userId: string): Promise<UserDetails> => {
    const [profileResult, preferencesResult] = await Promise.all([
      deps.fetchUserProfileActivity(userId),
      deps.fetchUserPreferencesActivity(userId)
    ]);

    if (!profileResult.ok) {
      throw new Error(`Failed to fetch profile: ${profileResult.error.message}`);
    }
    if (!preferencesResult.ok) {
      throw new Error(`Failed to fetch preferences: ${preferencesResult.error.message}`);
    }

    return {
      ...profileResult.value,
      preferences: preferencesResult.value
    };
  };
```

### 単一の更新を伴うAction（許容パターン）

```typescript
// actions/user.ts

// Activity関数の型定義
type GetUserProfileActivity = (userId: string) => Promise<{ ok: true; value: any } | { ok: false; error: any }>;
type IncrementProfileViewCountActivity = (userId: string) => Promise<{ ok: true; value: any } | { ok: false; error: any }>;

interface ViewUserProfileDeps {
  getUserProfileActivity: GetUserProfileActivity;
  incrementProfileViewCountActivity: IncrementProfileViewCountActivity;
}

/**
 * ユーザープロフィール閲覧（閲覧回数をインクリメント）
 * 
 * Read操作がメインだが、1つの更新Activity（閲覧回数の更新）を含む
 * このようなシンプルな更新はActionで許容される
 */
export const viewUserProfile = (deps: ViewUserProfileDeps) =>
  async (userId: string): Promise<UserProfile> => {
    // メインのRead操作
    const profileResult = await deps.getUserProfileActivity(userId);
    if (!profileResult.ok) {
      throw new Error(`Failed to get profile: ${profileResult.error.message}`);
    }

    // 副次的な更新操作（1つのみ）
    const updateResult = await deps.incrementProfileViewCountActivity(userId);
    if (!updateResult.ok) {
      // 更新失敗はログに記録するが、Read結果は返す
      console.error(`Failed to increment view count: ${updateResult.error.message}`);
    }

    return profileResult.value;
  };
```

**重要**: 複数の更新操作や、補償処理が必要な複雑な更新は必ずWorkflowで実装してください。

### エクスポート例

```typescript
// actions/index.ts
export * from './organization';
export * from './user';
```

## tRPCでの使用例

```typescript
// trpc/organization.ts
import { router, publicProcedure } from './base';
import { createOrganizationActions } from '../actions/organization';
import { z } from 'zod';

export const organizationRouter = router({
  // Read操作 - Actionを直接呼び出し
  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const actions = await createOrganizationActions();
      return await actions.getById(input);
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const actions = await createOrganizationActions();
      return await actions.list(input);
    }),

  // C/U/D操作はWorkflowを使用（別途実装）
});
```

## テスト方針

### 単体テスト（Unit Tests）

Actions層のテストは、**Activity関数をモック**して、ビジネスロジックのみをテストします。

#### テストツール
- **vitest**: TypeScript ネイティブ、高速なテストランナー
- **vi.fn()**: Activity関数のモック作成

#### テスト対象
- ✅ 正常系: Activity成功時の処理
- ✅ 異常系: Activity失敗時のエラーハンドリング
- ✅ 複数Activity: 並列実行・順次実行のロジック
- ✅ エラーメッセージ: 適切なエラーメッセージの生成

#### テスト例

```typescript
// actions/organization.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getOrganizationById, getOrganizationByEmail, listOrganizations } from './organization';
import type { Organization } from '../activities/db/schema';
import { OrganizationErrorCode } from '../activities/db/models/organization';

describe('Organization Actions', () => {
  describe('getOrganizationById', () => {
    it('should return organization when activity succeeds', async () => {
      // モックActivity: 成功ケース
      const mockOrg: Organization = {
        id: 'org-123',
        name: 'Test Org',
        email: 'test@example.com',
        description: null,
        phone: null,
        website: null,
        address: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockActivity = vi.fn().mockResolvedValue({
        ok: true,
        value: mockOrg,
      });

      // Action実行（依存注入）
      const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
      const result = await action('org-123');

      // アサーション
      expect(result).toEqual(mockOrg);
      expect(mockActivity).toHaveBeenCalledWith('org-123');
      expect(mockActivity).toHaveBeenCalledTimes(1);
    });

    it('should return null when organization not found', async () => {
      // モックActivity: 存在しない
      const mockActivity = vi.fn().mockResolvedValue({
        ok: true,
        value: null,
      });

      const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });
      const result = await action('non-existent-id');

      expect(result).toBeNull();
      expect(mockActivity).toHaveBeenCalledWith('non-existent-id');
    });

    it('should throw error when activity fails', async () => {
      // モックActivity: エラーケース
      const mockActivity = vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: OrganizationErrorCode.DATABASE,
          message: 'Database connection failed',
        },
      });

      const action = getOrganizationById({ getOrganizationByIdActivity: mockActivity });

      // エラーがthrowされることを確認
      await expect(action('org-123')).rejects.toThrow('Failed to get organization: Database connection failed');
      expect(mockActivity).toHaveBeenCalledWith('org-123');
    });
  });

  describe('getOrganizationByEmail', () => {
    it('should return organization when found by email', async () => {
      const mockOrg: Organization = {
        id: 'org-123',
        name: 'Test Org',
        email: 'test@example.com',
        description: null,
        phone: null,
        website: null,
        address: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockActivity = vi.fn().mockResolvedValue({
        ok: true,
        value: mockOrg,
      });

      const action = getOrganizationByEmail({ getOrganizationByEmailActivity: mockActivity });
      const result = await action('test@example.com');

      expect(result).toEqual(mockOrg);
      expect(mockActivity).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('listOrganizations', () => {
    it('should return organizations list', async () => {
      const mockOrgs: Organization[] = [
        {
          id: 'org-1',
          name: 'Org 1',
          email: 'org1@example.com',
          description: null,
          phone: null,
          website: null,
          address: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'org-2',
          name: 'Org 2',
          email: 'org2@example.com',
          description: null,
          phone: null,
          website: null,
          address: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockActivity = vi.fn().mockResolvedValue({
        ok: true,
        value: mockOrgs,
      });

      const action = listOrganizations({ listOrganizationsActivity: mockActivity });
      const result = await action({ limit: 20, offset: 0 });

      expect(result).toEqual(mockOrgs);
      expect(result).toHaveLength(2);
      expect(mockActivity).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('should throw error when list activity fails', async () => {
      const mockActivity = vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: OrganizationErrorCode.DATABASE,
          message: 'Query failed',
        },
      });

      const action = listOrganizations({ listOrganizationsActivity: mockActivity });

      await expect(action({ limit: 20, offset: 0 })).rejects.toThrow('Failed to list organizations: Query failed');
    });
  });
});
```

### 複数Activityのテスト例

```typescript
// actions/user.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getUserWithDetails } from './user';

describe('getUserWithDetails', () => {
  it('should combine profile and preferences', async () => {
    const mockProfile = { id: 'user-1', name: 'John Doe', email: 'john@example.com' };
    const mockPreferences = { theme: 'dark', language: 'ja' };

    const mockProfileActivity = vi.fn().mockResolvedValue({
      ok: true,
      value: mockProfile,
    });

    const mockPreferencesActivity = vi.fn().mockResolvedValue({
      ok: true,
      value: mockPreferences,
    });

    const action = getUserWithDetails({
      fetchUserProfileActivity: mockProfileActivity,
      fetchUserPreferencesActivity: mockPreferencesActivity,
    });

    const result = await action('user-1');

    expect(result).toEqual({
      ...mockProfile,
      preferences: mockPreferences,
    });

    // 並列実行されることを確認
    expect(mockProfileActivity).toHaveBeenCalledWith('user-1');
    expect(mockPreferencesActivity).toHaveBeenCalledWith('user-1');
  });

  it('should throw error when profile fetch fails', async () => {
    const mockProfileActivity = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    const mockPreferencesActivity = vi.fn().mockResolvedValue({
      ok: true,
      value: { theme: 'dark' },
    });

    const action = getUserWithDetails({
      fetchUserProfileActivity: mockProfileActivity,
      fetchUserPreferencesActivity: mockPreferencesActivity,
    });

    await expect(action('user-1')).rejects.toThrow('Failed to fetch profile: User not found');
  });
});
```

### テスト実行

```bash
# すべてのテストを実行
npm test

# 特定のファイルのみ
npm test actions/organization.test.ts

# watchモード
npm test -- --watch
```

### ベストプラクティス

#### ✅ DO（推奨）

1. **依存注入パターンを使用**
   ```typescript
   // ✅ GOOD - テスト容易
   export const getOrganization = (deps: Pick<Deps, 'getOrgActivity'>) =>
     async (id: string) => { /* ... */ };
   ```

2. **モックは最小限の情報のみ**
   ```typescript
   // ✅ GOOD - 必要な値のみモック
   const mockActivity = vi.fn().mockResolvedValue({
     ok: true,
     value: { id: 'org-1', name: 'Test' },
   });
   ```

3. **正常系・異常系を両方テスト**
   ```typescript
   // ✅ GOOD - 成功と失敗の両方
   it('should succeed', async () => { /* ... */ });
   it('should fail', async () => { /* ... */ });
   ```

4. **エラーメッセージを検証**
   ```typescript
   // ✅ GOOD - エラーメッセージも確認
   await expect(action('id')).rejects.toThrow('Failed to get organization');
   ```

#### ❌ DON'T（非推奨）

1. **実際のDBに接続しない**
   ```typescript
   // ❌ BAD - 実際のDB接続は統合テストで
   const db = getDatabase();
   ```

2. **複雑なモックを作らない**
   ```typescript
   // ❌ BAD - モックが複雑すぎる
   const mockActivity = vi.fn().mockImplementation(async (id) => {
     // 複雑なロジック...
   });
   ```

3. **テストを相互依存させない**
   ```typescript
   // ❌ BAD - テスト間で状態を共有
   let sharedState;
   it('test1', () => { sharedState = ...; });
   it('test2', () => { expect(sharedState)...; });
   ```

## tRPCでの使用例（依存注入パターン）

## ベストプラクティス

### ✅ DO（推奨）

1. **Read操作をメインとする**
   ```typescript
   // ✅ GOOD - Read専用
   export async function getOrganization(id: string) {
     const { getOrganizationByIdActivity } = await import('../activities/db/models/organization');
     const result = await getOrganizationByIdActivity(id);
     if (!result.ok) throw new Error(result.error.message);
     return result.value;
   }
   ```

2. **1つの更新Activityまで許容**
   ```typescript
   // ✅ GOOD - Read + 1つの更新Activity
   export async function getArticleWithViewCount(id: string) {
     const { getArticleActivity, incrementViewCountActivity } = 
       await import('../activities/db/models/article');
     
     const article = await getArticleActivity(id);
     if (!article.ok) throw new Error(article.error.message);
     
     // 副次的な更新（1つのみ）
     await incrementViewCountActivity(id);
     
     return article.value;
   }
   ```

3. **Dynamic importを使用**
   ```typescript
   // ✅ GOOD - Temporal Workflowの依存を避ける
   const { getActivity } = await import('../activities/db/models/organization');
   
   // ❌ BAD - Temporal Workflowの機能を使わない
   import { proxyActivities } from '@temporalio/workflow';
   ```

4. **エラーハンドリング**
   ```typescript
   // ✅ GOOD - エラーを適切にthrow
   if (!result.ok) {
     throw new Error(`Failed to get data: ${result.error.message}`);
   }
   ```

5. **複数のActivityを組み合わせる**
   ```typescript
   // ✅ GOOD - Promise.allで並列実行
   const [result1, result2] = await Promise.all([
     activity1(params),
     activity2(params)
   ]);
   ```

### ❌ DON'T（非推奨）

1. **複数の更新操作を実装しない**
   ```typescript
   // ❌ BAD - 複数の更新操作はWorkflowで行う
   export async function createOrganizationWithSettings(data: CreateInput) {
     const { createOrgActivity, createSettingsActivity, sendEmailActivity } = 
       await import('../activities/db/models/organization');
     
     const org = await createOrgActivity(data);
     await createSettingsActivity(org.value.id);  // 2つ目の更新
     await sendEmailActivity(org.value.email);     // 3つ目の更新
     
     return org.value;  // これはWorkflowで実装すべき
   }
   ```

2. **補償処理が必要な更新を実装しない**
   ```typescript
   // ❌ BAD - 補償処理が必要ならWorkflowで
   export async function updateUserWithPayment(data: UpdateInput) {
     // 失敗時のロールバックが必要な複雑な更新はWorkflowで行う
   }
   ```

3. **Temporal Workflow機能を使わない**
   ```typescript
   // ❌ BAD - ActionsではproxyActivitiesを使わない
   import { proxyActivities } from '@temporalio/workflow';
   const activities = proxyActivities<typeof import('../activities')>({...});
   ```

4. **Workflow Contextを必要としない**
   ```typescript
   // ❌ BAD - Workflow loggerは使えない
   import { log } from '@temporalio/workflow';
   ```

## ActionsとWorkflowsの使い分け

| 操作タイプ | 実装場所 | 呼び出し方法 | 補足 |
|-----------|---------|-------------|------|
| **Read操作** | `actions/` | tRPCから直接呼び出し | 主な用途 |
| **Read + 1つの更新** | `actions/` | tRPCから直接呼び出し | 副次的な更新（例: view count）は許容 |
| **Create操作** | `workflows/` | Temporal Client経由で呼び出し | 複数の操作や補償が必要 |
| **Update操作** | `workflows/` | Temporal Client経由で呼び出し | 複数の操作や補償が必要 |
| **Delete操作** | `workflows/` | Temporal Client経由で呼び出し | 複数の操作や補償が必要 |

### 判断基準

**Actionsで実装する場合:**
- ✅ 主にRead操作
- ✅ 更新操作は1つまで（副次的）
- ✅ 失敗しても大きな問題にならない
- ✅ 補償処理が不要
- ✅ 高速なレスポンスが必要

**Workflowsで実装する場合:**
- ✅ 複数の更新操作が必要
- ✅ トランザクション的な一貫性が必要
- ✅ 補償処理（SAGA）が必要
- ✅ 失敗時のリトライやロールバックが必要
- ✅ 長時間実行される処理

## トラブルシューティング

### 問題: "Cannot import '@temporalio/workflow' outside of workflow"

**原因**: ActionsディレクトリでTemporal Workflowの機能を使おうとしている

**解決策**: Dynamic importでActivityを直接呼び出す
```typescript
// ✅ GOOD
const { getActivity } = await import('../activities/db/models/organization');
```

### 問題: "Activity result.ok is undefined"

**原因**: Activity関数を正しくimportしていない、または存在しないActivity

**解決策**: Activity関数が正しくexportされているか確認
```typescript
// activities/db/models/organization.ts
export const getOrganizationByIdActivity = ...
```

## 参考資料

- [Architecture Guidelines](./architecture.instructions.md)
- [Activities Guidelines](./activities.instructions.md)
- [Workflows Guidelines](./workflows.instructions.md)
- [tRPC Guidelines](./trpc.instructions.md)

---

この指針に従って、シンプルで保守性の高いAction関数を実装してください。
