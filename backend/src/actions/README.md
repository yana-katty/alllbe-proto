# Actions Layer

tRPC Handler と Activity Layer の間の抽象化層

## 目的

Actions Layer は以下の役割を担います：

1. **実装の詳細を隠蔽**: tRPC は Auth0/WorkOS などの外部サービスの存在を知る必要がない
2. **エラーハンドリングの統一**: Activity の `ResultAsync<T, E>` を通常の `Error` に変換
3. **ログ出力の一元管理**: Actions Layer で統一的なログ出力
4. **テスト容易性**: Actions をモックすれば tRPC のテストが容易

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    tRPC Handler                              │
│  ・ユーザーからのリクエストを受信                              │
│  ・入力のバリデーション                                        │
│  ・Actions を呼び出し                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Actions Layer                             │
│  ・実装の詳細を隠蔽（Auth0, WorkOS等）                        │
│  ・ResultAsync<T, E> → Error への変換                        │
│  ・ログ出力                                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Activity Layer                            │
│  ・外部API呼び出し（Auth0, WorkOS, DB等）                    │
│  ・ResultAsync<T, E> で統一的なエラーハンドリング            │
│  ・依存注入パターン                                          │
└─────────────────────────────────────────────────────────────┘
```

## 実装パターン

### 1. 依存注入による疎結合

```typescript
// endUser.ts

// Activity関数の型定義
type GetAuth0UserActivity = (userId: string) => ResultAsync<Auth0UserProfile, Auth0Error>;

// 依存関数の型定義
interface EndUserActionDeps {
    getAuth0UserActivity: GetAuth0UserActivity;
}

// Pick<> で必要な依存のみ受け取る
export const getEndUserById = (deps: Pick<EndUserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        const result = await deps.getAuth0UserActivity(userId);
        
        if (result.isErr()) {
            throw new Error(`Failed to get end user: ${result.error.message}`);
        }
        
        return result.value;
    };
```

### 2. ファクトリ関数による実際の Activity 注入

```typescript
export async function createEndUserActions() {
    // Activity を動的にインポート（循環参照を回避）
    const {
        getAuth0User,
        getAuth0ConfigFromEnv,
        createAuth0ManagementClient,
    } = await import('../activities/auth/auth0');

    // 環境変数を読み込んでクライアントを初期化
    const auth0Config = getAuth0ConfigFromEnv();
    const auth0Client = createAuth0ManagementClient(auth0Config);

    // カリー化された関数に依存を注入
    const getAuth0UserActivity = getAuth0User(auth0Client);

    return {
        getById: getEndUserById({ getAuth0UserActivity }),
    };
}
```

### 3. tRPC での使用

```typescript
// trpc/endUser.ts
import { createEndUserActions } from '@/actions/endUser';

export const endUserRouter = router({
    getById: protectedProcedure
        .input(z.string())
        .query(async ({ input }) => {
            const actions = await createEndUserActions();
            return actions.getById(input);
        }),
});
```

## ファイル構造

```
actions/
├── index.ts          # Actions exports
├── README.md         # このファイル
├── organization.ts   # Organization Actions
└── endUser.ts        # EndUser Actions
```

## Read vs CUD 操作

### Read 操作（Actions Layer で実装）

- **パターン**: Actions Layer の通常の関数として実装
- **理由**: シンプルな取得処理は Workflow のオーバーヘッドが不要
- **例**: `getEndUserById`, `getOrganizationById`

### CUD 操作（Workflow で実装）

- **パターン**: Temporal Workflow として実装
- **理由**: 補償処理・再試行・状態管理が必要
- **例**: `createEndUserWorkflow`, `updateOrganizationWorkflow`

## ログ出力

Actions Layer では `@temporalio/activity` の `log` を使用：

```typescript
import { log } from '@temporalio/activity';

export const getEndUserById = (deps: Pick<EndUserActionDeps, 'getAuth0UserActivity'>) =>
    async (userId: string): Promise<Auth0UserProfile> => {
        log.info('Getting end user by ID', { userId });
        
        const result = await deps.getAuth0UserActivity(userId);

        if (result.isErr()) {
            const error = result._unsafeUnwrapErr();
            log.error('Failed to get end user', { userId, error });
            throw new Error(`Failed to get end user: ${error.message}`);
        }

        const user = result._unsafeUnwrap();
        log.info('End user retrieved successfully', { userId, email: user.email });
        return user;
    };
```

## テスト方法

### Actions のモック

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getEndUserById } from '@/actions/endUser';
import { ok, err } from 'neverthrow';

describe('getEndUserById', () => {
    it('should return user when activity succeeds', async () => {
        const mockActivity = vi.fn().mockResolvedValue(ok({ 
            user_id: 'auth0|123',
            email: 'test@example.com'
        }));
        
        const action = getEndUserById({ getAuth0UserActivity: mockActivity });
        const result = await action('auth0|123');
        
        expect(result.email).toBe('test@example.com');
        expect(mockActivity).toHaveBeenCalledWith('auth0|123');
    });
    
    it('should throw error when activity fails', async () => {
        const mockActivity = vi.fn().mockResolvedValue(err({ 
            code: 'USER_NOT_FOUND',
            message: 'User not found'
        }));
        
        const action = getEndUserById({ getAuth0UserActivity: mockActivity });
        
        await expect(action('auth0|123')).rejects.toThrow('Failed to get end user');
    });
});
```

## ベストプラクティス

1. **実装の詳細を隠蔽**: tRPC は Auth0/WorkOS の存在を知るべきではない
2. **Pick<> で最小権限**: 必要な依存のみを受け取る
3. **ログ出力を忘れずに**: 成功・失敗の両方でログを出力
4. **エラーメッセージは具体的に**: デバッグしやすいエラーメッセージ
5. **型安全性**: Activity の型定義を正確に

## 参考資料

- [Activities 実装ガイドライン](/.github/instructions/activities.instructions.md)
- [Actions 実装ガイドライン](/.github/instructions/actions.instructions.md)
- [Architecture Overview](/.github/instructions/architecture.instructions.md)
