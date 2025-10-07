---
applyTo: "backend/src/activities/**"
---

# Activity Layer Instructions

## 基本原則

- **必ずNeverthrowを使用**してエラーハンドリングを行う
- **Errorをthrowしない**（Promise<Result<T, E>>で返す）
- 単一責任の原則に従い、1つのActivityは1つの具体的な操作のみ行う
- **Activity内で環境変数を直接読み込まない**（依存注入パターンを使用）

## ⚠️ 重要: Temporal Activity の戻り値型

Temporal の proxyActivities で使用する Activity 関数は、**`Promise<Result<T, E>>`** 型を返す必要があります。
`ResultAsync<T, E>` を直接返すと、Workflow で Symbol 型エラーが発生します。

### 正しい実装パターン

```typescript
import { Result, ResultAsync } from 'neverthrow';

// ✅ 正しい: Promise<Result<T, E>> 型を返す
export type InsertOrganization = (data: OrganizationCreateInput) => Promise<Result<Organization, OrganizationError>>;

export const insertOrganization = (db: Database): InsertOrganization => 
  async (data: OrganizationCreateInput) => {
    return await ResultAsync.fromPromise(
      db.insert(organizations).values(data).returning().then(r => r[0]),
      (error) => ({ 
        code: OrganizationErrorCode.DATABASE, 
        message: 'Insert failed', 
        details: error 
      })
    );
  };
```

### ❌ 間違った実装パターン

```typescript
// ❌ 間違い: ResultAsync<T, E> を直接返す（Symbol 型エラー発生）
export type InsertOrganization = (data: OrganizationCreateInput) => ResultAsync<Organization, OrganizationError>;

export const insertOrganization = (db: Database): InsertOrganization => 
  (data: OrganizationCreateInput) => {
    return ResultAsync.fromPromise(
      db.insert(organizations).values(data).returning().then(r => r[0]),
      (error) => ({ 
        code: OrganizationErrorCode.DATABASE, 
        message: 'Insert failed', 
        details: error 
      })
    );
  };
```

### ポイント

1. **型定義**: `(params) => Promise<Result<T, E>>`
2. **実装**: `async (params) => { return await ResultAsync.fromPromise(...) }`
3. **内部**: ResultAsync を使って Promise を安全にラップ
4. **外部**: Promise<Result> として返却（Temporal が期待する形）

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

#### ✅ 推奨: カリー化パターン（Promise<Result> 版）

```typescript
import { Result, ResultAsync } from 'neverthrow';
import type { ManagementClient } from 'auth0';

/**
 * Auth0 User 取得 Activity
 * 
 * @param client - Auth0 Management Client（依存注入）
 * @returns Activity関数
 */
export type GetAuth0User = (userId: string) => Promise<Result<Auth0UserProfile, Auth0Error>>;

export const getAuth0User = (client: ManagementClient): GetAuth0User =>
    async (userId: string) => {
        return await ResultAsync.fromPromise(
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
export type CreateAuth0User = (input: CreateUserInput) => Promise<Result<Auth0UserProfile, Auth0Error>>;

export const createAuth0User = (client: ManagementClient, connectionName: string): CreateAuth0User =>
    async (input: CreateUserInput) => {
        return await ResultAsync.fromPromise(
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
import { Result, ResultAsync } from 'neverthrow';
import { Database } from '../connection';

/**
 * User 作成 Activity
 * 
 * @param db - Database接続（依存注入）
 * @returns Activity関数
 */
export type InsertUser = (input: CreateUserInput) => Promise<Result<User, UserError>>;

export const createUser = (db: Database): InsertUser => 
    async (input: CreateUserInput) => {
        return await ResultAsync.fromPromise(
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
import { Result, ResultAsync } from 'neverthrow';
import type { ManagementClient } from 'auth0';

/**
 * Auth0からユーザー取得 Activity
 * 
 * @param client - Auth0 ManagementClient（依存注入）
 * @returns Activity関数
 */
export type GetAuth0User = (userId: string) => Promise<Result<Auth0User, Auth0Error>>;

export const getAuth0User = (client: ManagementClient): GetAuth0User =>
    async (userId: string) => {
        return await ResultAsync.fromPromise(
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

## 禁止事項

### ❌ Activity内で環境変数やグローバル状態を直接読み込む

```typescript
// ❌ BAD: Activity内でgetDatabase()を呼び出す
export async function createBookingActivity(data: BookingCreateInput) {
    const { getDatabase } = await import('../connection');
    const db = getDatabase(); // グローバル状態に依存
    // ...
}

// ✅ GOOD: 依存注入パターン
export const createBookingActivity = (db: Database) =>
    (data: BookingCreateInput): ResultAsync<Booking, BookingError> => {
        return insertBooking(db)(data);
    };
```

### ❌ データを読んで判断する処理をActivity内で行う

Activity内で「データを読む → 判断 → 処理」を行うのはアンチパターンです。
これはWorkflowの責務です。

**アンチパターン例**:
```typescript
// ❌ BAD: Activity内でデータを読んで判断・処理する
export const processBookingActivity = (db: Database) =>
    async (bookingId: string) => {
        // ❌ データを読む → 判断 → 処理 はWorkflowの責務
        const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId));
        
        if (booking.status === 'confirmed') {
            // 条件分岐して処理
            await sendNotification(booking);
        }
        
        // さらに別のテーブルを読む
        const payment = await db.select().from(payments).where(eq(payments.bookingId, bookingId));
        
        if (payment.status === 'pending') {
            // また条件分岐
            await processPayment(payment);
        }
    };
```

**正しいパターン: Workflowで読み込み → 判断 → Activity呼び出し**:
```typescript
// ✅ GOOD: Workflowでデータを読む → 判断 → Activity呼び出し
export async function processBookingWorkflow(bookingId: string) {
    // Workflowでデータを読む
    const bookingResult = await activities.getBookingById(bookingId);
    const booking = bookingResult._unsafeUnwrap();
    
    // Workflowで判断
    if (booking.status === 'confirmed') {
        // 条件に応じてActivityを呼び出す
        await activities.sendNotification(booking);
    }
    
    // さらに別のデータを読む
    const paymentResult = await activities.getPaymentByBookingId(bookingId);
    const payment = paymentResult._unsafeUnwrap();
    
    // また判断
    if (payment.status === 'pending') {
        await activities.processPayment(payment.id);
    }
}
```

## トランザクション設計の原則

### 設計判断の基準

1. **DB層でしかできないこと** → Activity内トランザクションもOK
2. **Workflowの方がコードが見やすく保守性が高い** → Workflowを優先（推奨）
3. **データを読んで判断する処理** → 必ずWorkflowで実装

### ✅ 推奨: Workflowで複数テーブルを管理（保守性・可読性優先）

```typescript
// backend/src/workflows/booking.ts
export async function checkInWithQRCodeWorkflow(qrCode: string) {
  // Activity 1: QRコードでBookingを取得
  const bookingResult = await activities.getBookingByQrCode(qrCode);
  
  if (bookingResult.isErr() || !bookingResult.value) {
    throw new ApplicationFailure('Booking not found', 'INVALID_QR_CODE');
  }
  
  const booking = bookingResult.value;
  
  // バリデーション（Workflowで明示的に実行）
  if (booking.status === 'attended') {
    throw new ApplicationFailure('Already checked in', 'ALREADY_ATTENDED');
  }
  
  if (booking.status === 'cancelled') {
    throw new ApplicationFailure('Booking is cancelled', 'BOOKING_CANCELLED');
  }
  
  // Activity 2: Bookingをattendedに更新
  const updateResult = await activities.updateBooking(booking.id, {
    status: 'attended',
    attendedAt: new Date(),
  });
  
  if (updateResult.isErr()) {
    throw new ApplicationFailure('Failed to update booking', 'DATABASE_ERROR');
  }
  
  // Activity 3: 現地払いの場合、Paymentを完了状態に更新
  const paymentResult = await activities.getPaymentByBookingId(booking.id);
  
  if (paymentResult.isOk() && paymentResult.value) {
    const payment = paymentResult.value;
    
    if (payment.paymentMethod === 'onsite' && payment.status === 'pending') {
      const completeResult = await activities.completePayment(booking.id);
      
      if (completeResult.isErr()) {
        log.warn('Payment completion failed', { 
          bookingId: booking.id, 
          error: completeResult.error 
        });
      }
    }
  }
  
  return updateResult.value;
}
```

**Workflowのメリット**:
- フローが明確で読みやすい
- 各Activityが単純で保守しやすい
- テストが容易（各Activityを個別にテスト可能）
- 拡張しやすい（通知、ポイント付与などを追加しやすい）

## 注意事項

- ActivityはTemporalによって他のプロセスで実行される可能性があるため、純粋関数として実装する
- 外部依存（DB接続、APIクライアント）は引数として受け取る
- サイドエフェクトは最小限に抑える
- **データを読んで判断する処理はWorkflowで行う**
- **複雑なフローはWorkflowで管理すると保守性が向上する**