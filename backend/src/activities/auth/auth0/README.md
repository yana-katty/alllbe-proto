# Auth0 Activities

Auth0 Management API を使用したエンドユーザー認証・個人情報管理Activity

## 📋 目次

1. [Auth0 セットアップガイド](#auth0-セットアップガイド)
2. [責務](#責務)
3. [ファイル構造](#ファイル構造)
4. [依存注入パターン](#依存注入パターンカリー化)
5. [使用方法](#使用方法)
6. [Activity 一覧](#activity-一覧)
7. [エラーハンドリング](#エラーハンドリング)
8. [テスト](#テスト)
9. [GDPR 対応](#gdpr-対応)
10. [ベストプラクティス](#ベストプラクティス)

## Auth0 セットアップガイド

### 1. Auth0 アカウントの作成

1. [Auth0](https://auth0.com/) にアクセスして作成

### 2. Auth0 Management API のセットアップ

#### 2-1. Machine to Machine Application の作成

1. Auth0 ダッシュボードにログイン
2. 左サイドバーの **Applications** → **Applications** をクリック
3. **Create Application** ボタンをクリック
4. アプリケーション名を入力（例: `Alllbe Backend API`）
5. アプリケーションタイプで **Machine to Machine Applications** を選択
6. **Create** をクリック
7. API 選択画面で **Auth0 Management API** を選択
8. 必要な権限（Scopes）を選択：
   - ✅ `read:users`
   - ✅ `update:users`
   - ✅ `delete:users`
   - ✅ `create:users`
   - ✅ `read:users_app_metadata`
   - ✅ `update:users_app_metadata`
   - ✅ `create:users_app_metadata`
   - ✅ `read:user_idp_tokens`
9. **Authorize** をクリック

#### 2-2. Client ID と Client Secret の取得

1. 作成したアプリケーションの **Settings** タブを開く
2. 以下の情報をコピー：
   - **Domain**: `your-tenant.auth0.com`
   - **Client ID**: `abc123...`
   - **Client Secret**: `xyz789...` (⚠️ 秘密にすること！)

### 3. Database Connection の作成

1. 左サイドバーの **Authentication** → **Database** をクリック
2. **Create DB Connection** ボタンをクリック
3. コネクション名を入力（例: `Username-Password-Authentication`）
4. **Create** をクリック
5. **Settings** タブで以下を確認：
   - ✅ **Requires Username**: オフ（メールアドレスでログイン）
   - ✅ **Disable Sign Ups**: 必要に応じて設定

### 4. 環境変数の設定

```bash
# .env ファイルに以下を追加

# Auth0 Management API 設定
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_MANAGEMENT_CLIENT_ID=your_client_id_here
AUTH0_MANAGEMENT_CLIENT_SECRET=your_client_secret_here

# Database Connection 名（デフォルト）
AUTH0_CONNECTION_NAME=Username-Password-Authentication
```

### 5. セットアップの確認

```bash
# backend ディレクトリで
cd backend

# 依存関係をインストール
npm install

# テストを実行（Auth0接続確認）
npm test -- auth0
```


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
3. **エラーハンドリングの統一**: ApplicationFailure のハンドリングを Actions で実施
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
    try {
        // Auth0 にユーザーを作成
        const auth0User = await createAuth0User(input);
        
        // DB に Auth0 User ID のみを保存
        const dbResult = await createDbUser({
            auth0UserId: auth0User.user_id,
            email: auth0User.email,
        });
        
        return dbResult;
    } catch (error) {
        // ApplicationFailure はそのまま再スロー
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        // 予期しないエラーの場合
        throw new ApplicationFailure('Unexpected error in workflow', 'WORKFLOW_ERROR');
    }
}
```

## Activity 一覧

### User Activities (`user.ts`)

すべてカリー化された関数として実装されています。

| Activity | 説明 | 依存注入 | 入力 | 出力 | エラー |
|----------|------|----------|------|------|--------|
| `getAuth0User` | Auth0からユーザー情報を取得 | `(client)` | `userId: string` | `Promise<Auth0UserProfile>` | `AUTH0_USER_NOT_FOUND`, `AUTH0_API_ERROR` |
| `getAuth0UserSummary` | 最小限のユーザー情報を取得 | `(client)` | `userId: string` | `Promise<Auth0UserSummary>` | `AUTH0_USER_NOT_FOUND`, `AUTH0_API_ERROR` |
| `createAuth0User` | Auth0にユーザーを作成 | `(client, connectionName)` | `Auth0UserCreateInput` | `Promise<Auth0UserProfile>` | `AUTH0_EMAIL_ALREADY_EXISTS`, `AUTH0_VALIDATION_ERROR`, `AUTH0_API_ERROR` |
| `updateAuth0User` | Auth0のユーザー情報を更新 | `(client)` | `userId, Auth0UserUpdateInput` | `Promise<Auth0UserProfile>` | `AUTH0_USER_NOT_FOUND`, `AUTH0_VALIDATION_ERROR`, `AUTH0_API_ERROR` |
| `deleteAuth0User` | Auth0からユーザーを削除 | `(client)` | `userId: string` | `Promise<void>` | `AUTH0_USER_NOT_FOUND`, `AUTH0_API_ERROR` |
| `updateAuth0EmailVerification` | メール認証状態を更新 | `(client)` | `userId, emailVerified` | `Promise<Auth0UserProfile>` | `AUTH0_USER_NOT_FOUND`, `AUTH0_API_ERROR` |
| `blockAuth0User` | ユーザーをブロック/アンブロック | `(client)` | `userId, blocked` | `Promise<Auth0UserProfile>` | `AUTH0_USER_NOT_FOUND`, `AUTH0_API_ERROR` |

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

全てのActivityは ApplicationFailure を throw します：

```typescript
export enum Auth0ErrorType {
    USER_NOT_FOUND = 'AUTH0_USER_NOT_FOUND',
    EMAIL_ALREADY_EXISTS = 'AUTH0_EMAIL_ALREADY_EXISTS',
    INVALID_CREDENTIALS = 'AUTH0_INVALID_CREDENTIALS',
    TOKEN_EXPIRED = 'AUTH0_TOKEN_EXPIRED',
    INSUFFICIENT_SCOPE = 'AUTH0_INSUFFICIENT_SCOPE',
    API_ERROR = 'AUTH0_API_ERROR',
    VALIDATION_ERROR = 'AUTH0_VALIDATION_ERROR',
}

export interface Auth0ErrorInfo {
    type: Auth0ErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

export const createAuth0Error = (info: Auth0ErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};
```

### Workflow でのエラーハンドリング

```typescript
export async function createEndUserWorkflow(input: CreateEndUserInput) {
    try {
        const auth0User = await createAuth0User(input);
        // ...
    } catch (error) {
        // ApplicationFailure をキャッチして適切にハンドリング
        if (error instanceof ApplicationFailure) {
            // error.type でエラー種別を判定
            if (error.type === Auth0ErrorType.EMAIL_ALREADY_EXISTS) {
                // 既に存在する場合の処理
            }
            throw error; // 再スロー
        }
        throw new ApplicationFailure('Unexpected error', 'WORKFLOW_ERROR');
    }
}
```

## テスト

### テスト戦略

Auth0 Activity のテストは**実際の Auth0 API を使用した統合テスト**で実施します。

**理由**:
1. **Auth0 API の仕様確認**: モックでは気づかない API の挙動を検証
2. **エラーハンドリングの検証**: 実際のエラーレスポンスをテスト
3. **認証フローの確認**: Management API の認証が正しく動作するか確認

### テスト前の準備

1. **テスト用 Auth0 テナントの作成**: 本番環境とは別のテナントを使用
2. **環境変数の設定**: `.env.test` ファイルに Auth0 の設定を記述
3. **テストユーザーのクリーンアップ**: テスト後にユーザーを削除

### テスト環境変数

```bash
# .env.test
AUTH0_DOMAIN=your-test-tenant.auth0.com
AUTH0_MANAGEMENT_CLIENT_ID=test_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=test_client_secret
AUTH0_CONNECTION_NAME=Username-Password-Authentication
```

### テストの実行

```bash
# Auth0 Activity のテストのみ実行
npm test -- auth0

# 統合テストをすべて実行
npm test -- --run

# watch モードで実行
npm test -- auth0 --watch
```

### テストファイル構造

```
auth0/
├── user.test.ts              # User Activity 統合テスト
├── auth0Client.test.ts       # Auth0 Client 初期化テスト
└── README.md
```

### テスト例

```typescript
// user.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    getAuth0ConfigFromEnv,
    createAuth0ManagementClient,
    getAuth0User,
    createAuth0User,
    updateAuth0User,
    deleteAuth0User,
    Auth0ErrorType,
} from './index';
import type { ManagementClient } from 'auth0';

describe('Auth0 User Activities (Integration)', () => {
    let auth0Client: ManagementClient;
    let testUserId: string | null = null;

    beforeAll(async () => {
        // 実際の Auth0 クライアントを作成
        const config = getAuth0ConfigFromEnv();
        auth0Client = createAuth0ManagementClient(config);
    });

    afterAll(async () => {
        // テスト後にユーザーをクリーンアップ
        if (testUserId) {
            try {
                const deleteFn = deleteAuth0User(auth0Client);
                await deleteFn(testUserId);
            } catch (error) {
                console.warn('Failed to cleanup test user:', error);
            }
        }
    });

    describe('createAuth0User', () => {
        it('should create user successfully', async () => {
            const createFn = createAuth0User(
                auth0Client,
                process.env.AUTH0_CONNECTION_NAME || 'Username-Password-Authentication'
            );

            const input = {
                email: `test-${Date.now()}@example.com`,
                password: 'Test1234!@#$',
                given_name: 'Test',
                family_name: 'User',
            };

            const result = await createFn(input);

            // ユーザーが作成されたことを確認
            expect(result.user_id).toBeDefined();
            expect(result.email).toBe(input.email);
            expect(result.given_name).toBe(input.given_name);
            expect(result.family_name).toBe(input.family_name);

            // クリーンアップ用に保存
            testUserId = result.user_id!;
        });

        it('should throw AUTH0_EMAIL_ALREADY_EXISTS when email is duplicate', async () => {
            const createFn = createAuth0User(
                auth0Client,
                process.env.AUTH0_CONNECTION_NAME || 'Username-Password-Authentication'
            );

            const input = {
                email: `test-${Date.now()}@example.com`,
                password: 'Test1234!@#$',
            };

            // 1回目: 成功
            const firstResult = await createFn(input);
            testUserId = firstResult.user_id!;

            // 2回目: 重複エラー
            await expect(createFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await createFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.EMAIL_ALREADY_EXISTS
                );
            }
        });
    });

    describe('getAuth0User', () => {
        it('should get user by ID', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(
                auth0Client,
                process.env.AUTH0_CONNECTION_NAME || 'Username-Password-Authentication'
            );
            const created = await createFn({
                email: `test-${Date.now()}@example.com`,
                password: 'Test1234!@#$',
            });
            testUserId = created.user_id!;

            // ユーザーを取得
            const getFn = getAuth0User(auth0Client);
            const result = await getFn(testUserId);

            expect(result.user_id).toBe(testUserId);
            expect(result.email).toBe(created.email);
        });

        it('should throw AUTH0_USER_NOT_FOUND when user does not exist', async () => {
            const getFn = getAuth0User(auth0Client);
            const nonExistentUserId = 'auth0|nonexistent123';

            await expect(getFn(nonExistentUserId)).rejects.toThrow(ApplicationFailure);

            try {
                await getFn(nonExistentUserId);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(
                    Auth0ErrorType.USER_NOT_FOUND
                );
            }
        });
    });

    describe('updateAuth0User', () => {
        it('should update user successfully', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(
                auth0Client,
                process.env.AUTH0_CONNECTION_NAME || 'Username-Password-Authentication'
            );
            const created = await createFn({
                email: `test-${Date.now()}@example.com`,
                password: 'Test1234!@#$',
                given_name: 'Old Name',
            });
            testUserId = created.user_id!;

            // ユーザーを更新
            const updateFn = updateAuth0User(auth0Client);
            const updated = await updateFn(testUserId, {
                given_name: 'New Name',
                family_name: 'Updated',
            });

            expect(updated.given_name).toBe('New Name');
            expect(updated.family_name).toBe('Updated');
        });
    });

    describe('deleteAuth0User', () => {
        it('should delete user successfully', async () => {
            // まずユーザーを作成
            const createFn = createAuth0User(
                auth0Client,
                process.env.AUTH0_CONNECTION_NAME || 'Username-Password-Authentication'
            );
            const created = await createFn({
                email: `test-${Date.now()}@example.com`,
                password: 'Test1234!@#$',
            });
            const userId = created.user_id!;

            // ユーザーを削除
            const deleteFn = deleteAuth0User(auth0Client);
            await deleteFn(userId);

            // 削除されたことを確認（取得エラー）
            const getFn = getAuth0User(auth0Client);
            await expect(getFn(userId)).rejects.toThrow(ApplicationFailure);

            // クリーンアップ済みなのでnullに
            testUserId = null;
        });
    });
});
```

### テストのベストプラクティス

1. **テストユーザーのクリーンアップ**: `afterAll` で必ず削除
2. **ユニークなメールアドレス**: `Date.now()` を使用して重複を避ける
3. **実際の Auth0 API を使用**: モックではなく統合テスト
4. **エラーケースの網羅**: 正常系と異常系を両方テスト
5. **テスト順序に依存しない**: 各テストは独立して実行可能

### CI/CD でのテスト実行

GitHub Actions での実行例：

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
        working-directory: ./backend
      
      - name: Run Auth0 integration tests
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_TEST_DOMAIN }}
          AUTH0_MANAGEMENT_CLIENT_ID: ${{ secrets.AUTH0_TEST_CLIENT_ID }}
          AUTH0_MANAGEMENT_CLIENT_SECRET: ${{ secrets.AUTH0_TEST_CLIENT_SECRET }}
          AUTH0_CONNECTION_NAME: Username-Password-Authentication
        run: npm test -- auth0
        working-directory: ./backend
```

**GitHub Secrets に以下を設定**:
- `AUTH0_TEST_DOMAIN`
- `AUTH0_TEST_CLIENT_ID`
- `AUTH0_TEST_CLIENT_SECRET`

## GDPR 対応

エンドユーザーの個人情報削除時は `deleteAuth0User` を使用：

```typescript
// ユーザー削除（GDPR対応）
try {
    await deleteAuth0User(userId);
    
    // Auth0 から個人情報が完全に削除される
    // DB側も auth0UserId を削除済みフラグに更新
    await markDbUserAsDeleted(userId);
} catch (error) {
    if (error instanceof ApplicationFailure && error.type === Auth0ErrorType.USER_NOT_FOUND) {
        // 既に削除されている場合はスキップ
        await markDbUserAsDeleted(userId);
    } else {
        throw error;
    }
}
```

## ベストプラクティス

1. **個人情報は Auth0 で管理**: DBには Auth0 User ID のみを保存
2. **ApplicationFailure を使用**: 全てのActivityは ApplicationFailure を throw
3. **依存注入**: ManagementClient を引数として受け取る
4. **エラーマッピング**: Auth0 API エラーを統一的な ApplicationFailure に変換
5. **try-catch でエラーハンドリング**: Workflow・Activity共に try-catch を使用

## 参考資料

- [Auth0 Management API Documentation](https://auth0.com/docs/api/management/v2)
- [Auth0 Node.js SDK](https://github.com/auth0/node-auth0)
- [Activities 実装ガイドライン](/.github/instructions/activities.instructions.md)
- [認証アーキテクチャ指示書](/.github/instructions/auth.instructions.md)
