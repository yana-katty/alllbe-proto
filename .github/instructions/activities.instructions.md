---
applyTo: "backend/src/activities/**"
---

# Activity Layer Instructions

## 基本原則

- **必ずNeverthrowを使用**してエラーハンドリングを行う
- **Errorをthrowしない**（ResultAsync<T, E>で返す）
- 単一責任の原則に従い、1つのActivityは1つの具体的な操作のみ行う
- **Activity内で環境変数を直接読み込まない**（依存注入パターンを使用）

## 依存注入パターン

### 基本方針

Activity関数内で環境変数やグローバル設定を直接読み込むことは**禁止**します。
これは以下の理由によります：

1. **本番環境での設定漏れを起動時に検出**: Worker起動時に環境変数を読み込むため、設定漏れがあれば即座にエラーとなる
2. **テスト容易性**: モックを簡単に注入できる
3. **純粋関数**: Activity関数が純粋関数として保たれる

### 実装パターン: カリー化

Activity関数は**同名のカリー化された関数**として実装します。
ファクトリー関数パターンは使用せず、個別の関数をカリー化します。

#### ✅ 推奨: カリー化パターン

```typescript
import { ResultAsync } from 'neverthrow';
import type { ManagementClient } from 'auth0';

/**
 * Auth0 User 取得 Activity
 * 
 * @param client - Auth0 Management Client（依存注入）
 * @returns Activity関数
 */
export const getAuth0User = (client: ManagementClient) =>
    (userId: string): ResultAsync<Auth0UserProfile, Auth0Error> => {
        return ResultAsync.fromPromise(
            client.users.get(userId),
            (error) => ({
                code: 'AUTH0_API_ERROR',
                message: 'Failed to fetch user from Auth0',
                details: error
            })
        );
    };

/**
 * Auth0 User 作成 Activity
 * 
 * @param client - Auth0 Management Client（依存注入）
 * @param connectionName - Auth0 Database Connection 名（依存注入）
 * @returns Activity関数
 */
export const createAuth0User = (client: ManagementClient, connectionName: string) =>
    (input: CreateUserInput): ResultAsync<Auth0UserProfile, Auth0Error> => {
        return ResultAsync.fromPromise(
            client.users.create({ ...input, connection: connectionName }),
            (error) => ({
                code: 'AUTH0_API_ERROR',
                message: 'Failed to create user in Auth0',
                details: error
            })
        );
    };
```

#### ❌ 非推奨: 環境変数の直接読み込み

```typescript
// ❌ BAD: Activity内で環境変数を読み込む
export const createAuth0User = (input: CreateUserInput) => {
    const connectionName = process.env.AUTH0_CONNECTION_NAME; // 禁止！
    // ...
};
```

### Worker での使用

Worker起動時に環境変数を読み込んで、カリー化された関数に注入します：

```typescript
// worker.ts
import { Worker } from '@temporalio/worker';
import {
    getAuth0ConfigFromEnv,
    createAuth0ManagementClient,
    getAuth0User,
    createAuth0User,
} from './activities/auth/auth0';

// 起動時に環境変数を読み込む（設定漏れがあれば即エラー）
const auth0Config = getAuth0ConfigFromEnv();
const auth0Client = createAuth0ManagementClient(auth0Config);

const worker = await Worker.create({
    activities: {
        // カリー化された関数に依存を注入
        getAuth0User: getAuth0User(auth0Client),
        createAuth0User: createAuth0User(auth0Client, auth0Config.connectionName),
        // ...
    },
    taskQueue: 'main',
    // ...
});

await worker.run();
```

### tRPC での使用

tRPC の `createContext` で環境変数を読み込んで注入します：

```typescript
// trpc/base.ts
import { getAuth0ConfigFromEnv, createAuth0ManagementClient } from '@/activities/auth/auth0';

// 起動時に環境変数を読み込む
const auth0Config = getAuth0ConfigFromEnv();
const auth0Client = createAuth0ManagementClient(auth0Config);

export const createContext = async () => {
    return {
        auth0Client,
        auth0ConnectionName: auth0Config.connectionName,
        // ...
    };
};

// tRPC Handler
export const userRouter = router({
    create: publicProcedure
        .input(createUserSchema)
        .mutation(async ({ input, ctx }) => {
            // Context から依存を取得
            const createActivity = createAuth0User(ctx.auth0Client, ctx.auth0ConnectionName);
            const result = await createActivity(input);
            // ...
        }),
});
```

参考: https://github.com/temporalio/samples-typescript/blob/main/activities-dependency-injection/src/activities.ts

## ファイル構造

```
activities/
├── index.ts              # Activity exports
├── db/
│   ├── models/
│   │   ├── user.ts      # User Activity implementations
│   │   ├── organization.ts  # Organization Activity implementations
│   │   └── *.ts         # Other model activities
│   ├── connection.ts
│   └── schema.ts
└── auth/
    ├── auth0/
    │   ├── index.ts
    │   ├── auth0Client.ts   # Client初期化（環境変数読み込み）
    │   ├── user.ts          # User Activity implementations
    │   └── types.ts
    └── workos/
        ├── index.ts
        ├── workosClient.ts
        ├── organization.ts
        └── types.ts
```

## 実装パターン

### DB操作Activity

```typescript
import { ResultAsync } from 'neverthrow';
import { Database } from '../connection';

/**
 * User 作成 Activity
 * 
 * @param db - Database接続（依存注入）
 * @returns Activity関数
 */
export const createUser = (db: Database) => 
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

### 外部API Activity

```typescript
import { ResultAsync } from 'neverthrow';
import type { ManagementClient } from 'auth0';

/**
 * Auth0からユーザー取得 Activity
 * 
 * @param client - Auth0 ManagementClient（依存注入）
 * @returns Activity関数
 */
export const getAuth0User = (client: ManagementClient) =>
    (userId: string): ResultAsync<Auth0User, Auth0Error> => {
        return ResultAsync.fromPromise(
            client.users.get(userId),
            (error) => ({
                code: 'AUTH0_API_ERROR',
                message: 'Failed to fetch user from Auth0',
                details: error
            })
        );
    };
```

## エラー定義

各modelで統一的なエラータイプを定義：

```typescript
export enum UserErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_INPUT = 'INVALID_INPUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export interface UserError {
  code: UserErrorCode;
  message: string;
  details?: unknown;
}
```

## 注意事項

- ActivityはTemporalによって他のプロセスで実行される可能性があるため、純粋関数として実装する
- 外部依存（DB接続、APIクライアント）は引数として受け取る
- サイドエフェクトは最小限に抑える