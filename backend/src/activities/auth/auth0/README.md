# Auth0 Activities

Auth0 Management API を使用したエンドユーザー認証・個人情報管理Activity

## 責務

Auth0は**エンドユーザーの個人情報と認証情報のマスター**として機能します：

### ✅ Auth0 が管理する情報
- エンドユーザーの認証情報（パスワード、MFA設定等）
- 個人情報（氏名、メールアドレス、プロフィール画像等）
- ソーシャルログイン連携情報（Google, Twitter, Apple等）
- プライバシー設定・同意情報

### ❌ Auth0 で管理しない情報
- Experience（体験イベント）データ
- Booking（予約）データ
- Organization（組織）データ → WorkOS で管理
- 統計・分析データ

## ファイル構造

```
auth0/
├── index.ts          # Activity exports
├── auth0Client.ts    # Auth0 Management Client 初期化
├── user.ts           # User 管理 Activity（カリー化された関数）
└── types.ts          # Auth0 型定義
```

## 依存注入パターン（カリー化）

Activity関数内で環境変数を直接読み込むことは**禁止**です。
Worker起動時やtRPC context作成時に環境変数を読み込んで、カリー化された関数に依存を注入します。

### なぜカリー化するのか？

1. **本番環境での設定漏れを起動時に検出**: 環境変数が不足していれば即座にエラー
2. **テスト容易性**: モックを簡単に注入できる
3. **純粋関数**: Activity関数が純粋関数として保たれる

## 使用方法

### 1. 環境変数の設定

```bash
# Auth0 Management API 設定
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_MANAGEMENT_CLIENT_ID=your_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_client_secret
AUTH0_CONNECTION_NAME=Username-Password-Authentication  # オプション
```

### 2. Worker での使用例

**Note**: Worker で Activity を登録する際は、環境変数から設定を読み込んで
カリー化された関数に依存を注入します。

```typescript
import { Worker } from '@temporalio/worker';
import {
    getAuth0ConfigFromEnv,
    createAuth0ManagementClient,
    getAuth0User,
    createAuth0User,
    updateAuth0User,
    deleteAuth0User,
} from '@/activities/auth/auth0';

// 起動時に環境変数を読み込む（設定漏れがあれば即エラー）
const auth0Config = getAuth0ConfigFromEnv();
const auth0Client = createAuth0ManagementClient(auth0Config);

const worker = await Worker.create({
    activities: {
        // カリー化された関数に依存を注入
        getAuth0User: getAuth0User(auth0Client),
        getAuth0UserSummary: getAuth0UserSummary(auth0Client),
        createAuth0User: createAuth0User(auth0Client, auth0Config.connectionName),
        updateAuth0User: updateAuth0User(auth0Client),
        deleteAuth0User: deleteAuth0User(auth0Client),
        updateAuth0EmailVerification: updateAuth0EmailVerification(auth0Client),
        blockAuth0User: blockAuth0User(auth0Client),
    },
    taskQueue: 'main',
    workflowsPath: require.resolve('./workflows'),
});

await worker.run();
```

### 3. tRPC での使用例（Actions 経由）

**重要**: tRPC Handler から Activity を直接呼び出すことは禁止されています。
必ず Actions Layer（`backend/src/actions/endUser.ts`）を経由してください。

```typescript
// trpc/endUser.ts
import { router, protectedProcedure } from './base';
import { createEndUserActions } from '@/actions/endUser';
import { z } from 'zod';

export const endUserRouter = router({
    // EndUser 完全情報取得
    getById: protectedProcedure
        .input(z.string())
        .query(async ({ input }) => {
            // Actions Layer を経由（Auth0 の存在は隠蔽される）
            const actions = await createEndUserActions();
            return actions.getById(input);
        }),
    
    // EndUser 最小限情報取得
    getSummaryById: protectedProcedure
        .input(z.string())
        .query(async ({ input }) => {
            const actions = await createEndUserActions();
            return actions.getSummaryById(input);
        }),
});
```

**なぜ Actions Layer を経由するのか？**
1. **実装の詳細を隠蔽**: tRPC は Auth0 の存在を知る必要がない
2. **ログ出力の一元管理**: Actions Layer でログを出力
3. **エラーハンドリングの統一**: Result型 → Error への変換を Actions で実施
4. **テスト容易性**: Actions をモックすれば tRPC のテストが簡単


### 4. Workflow での使用

```typescript
// backend/src/workflows/endUser.ts
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from '@/activities';

const { getAuth0User, createAuth0User } = proxyActivities<typeof activities>({
    startToCloseTimeout: '10s',
});

export async function createEndUserWorkflow(input: CreateEndUserInput) {
    // Auth0 にユーザーを作成
    const auth0Result = await createAuth0User(input);
    
    if (auth0Result.isErr()) {
        throw new ApplicationFailure(auth0Result.error.message, auth0Result.error.code);
    }
    
    // DB に Auth0 User ID のみを保存
    const dbResult = await createDbUser({
        auth0UserId: auth0Result.value.user_id,
        email: auth0Result.value.email,
    });
    
    return dbResult;
}
```

## Activity 一覧

### User Activities (`user.ts`)

すべてカリー化された関数として実装されています。

| Activity | 説明 | 依存注入 | 入力 | 出力 |
|----------|------|----------|------|------|
| `getAuth0User` | Auth0からユーザー情報を取得 | `(client)` | `userId: string` | `Auth0UserProfile` |
| `getAuth0UserSummary` | 最小限のユーザー情報を取得 | `(client)` | `userId: string` | `Auth0UserSummary` |
| `createAuth0User` | Auth0にユーザーを作成 | `(client, connectionName)` | `Auth0UserCreateInput` | `Auth0UserProfile` |
| `updateAuth0User` | Auth0のユーザー情報を更新 | `(client)` | `userId, Auth0UserUpdateInput` | `Auth0UserProfile` |
| `deleteAuth0User` | Auth0からユーザーを削除 | `(client)` | `userId: string` | `void` |
| `updateAuth0EmailVerification` | メール認証状態を更新 | `(client)` | `userId, emailVerified` | `Auth0UserProfile` |
| `blockAuth0User` | ユーザーをブロック/アンブロック | `(client)` | `userId, blocked` | `Auth0UserProfile` |

### 使用例

```typescript
// Worker起動時
const auth0Config = getAuth0ConfigFromEnv();
const auth0Client = createAuth0ManagementClient(auth0Config);

const worker = await Worker.create({
    activities: {
        // 単一引数の依存注入
        getAuth0User: getAuth0User(auth0Client),
        updateAuth0User: updateAuth0User(auth0Client),
        deleteAuth0User: deleteAuth0User(auth0Client),
        
        // 複数引数の依存注入
        createAuth0User: createAuth0User(auth0Client, auth0Config.connectionName),
    },
    // ...
});
```

## エラーハンドリング

全てのActivityは `ResultAsync<T, Auth0Error>` を返します：

```typescript
export enum Auth0ErrorCode {
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
    API_ERROR = 'API_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface Auth0Error {
    code: Auth0ErrorCode;
    message: string;
    details?: unknown;
}
```

## GDPR 対応

エンドユーザーの個人情報削除時は `deleteAuth0UserActivity` を使用：

```typescript
// ユーザー削除（GDPR対応）
const deleteResult = await deleteAuth0UserActivity(userId);

if (deleteResult.isOk()) {
    // Auth0 から個人情報が完全に削除される
    // DB側も auth0UserId を削除済みフラグに更新
    await markDbUserAsDeleted(userId);
}
```

## ベストプラクティス

1. **個人情報は Auth0 で管理**: DBには Auth0 User ID のみを保存
2. **Neverthrow で統一**: 全てのActivityは Result型を返す
3. **依存注入**: ManagementClient を引数として受け取る
4. **エラーマッピング**: Auth0 API エラーを統一的な Auth0Error に変換

## 参考資料

- [Auth0 Management API Documentation](https://auth0.com/docs/api/management/v2)
- [Auth0 Node.js SDK](https://github.com/auth0/node-auth0)
- [Activities 実装ガイドライン](/.github/instructions/activities.instructions.md)
- [認証アーキテクチャ指示書](/.github/instructions/auth.instructions.md)
