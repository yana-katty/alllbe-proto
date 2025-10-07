---
applyTo: "backend/src/activities/**"
---

# Activity Layer Instructions

## 基本原則

- **ApplicationFailure を使用**してエラーハンドリングを行う
- **try-catch でエラーを捕捉**し、ApplicationFailure を throw する
- 単一責任の原則に従い、1つのActivityは1つの具体的な操作のみ行う
- **Activity内で環境変数を直接読み込まない**（依存注入パターンを使用）

## エラーハンドリングパターン

### ErrorType 定義 + ファクトリ関数

```typescript
import { ApplicationFailure } from '@temporalio/common';

/**
 * Organization エラータイプ
 */
export enum OrganizationErrorType {
    NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'ORGANIZATION_ALREADY_EXISTS',
    INVALID_INPUT = 'ORGANIZATION_INVALID_INPUT',
    DATABASE_ERROR = 'ORGANIZATION_DATABASE_ERROR',
}

/**
 * Organization エラー情報
 */
export interface OrganizationErrorInfo {
    type: OrganizationErrorType;
    message: string;
    details?: unknown;
    nonRetryable?: boolean;
}

/**
 * Organization エラー作成ファクトリ
 */
export const createOrganizationError = (info: OrganizationErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};
```

### Activity 実装パターン

```typescript
export type InsertOrganization = (data: OrganizationCreateInput) => Promise<Organization>;

export const insertOrganization = (db: Database): InsertOrganization =>
    async (data: OrganizationCreateInput): Promise<Organization> => {
        try {
            const existing = await db.select().from(organizations)
                .where(eq(organizations.id, data.id)).limit(1);
            
            if (existing.length > 0) {
                throw createOrganizationError({
                    type: OrganizationErrorType.ALREADY_EXISTS,
                    message: `Organization already exists: ${data.id}`,
                    details: { organizationId: data.id },
                    nonRetryable: true,
                });
            }

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

## 依存注入パターン

### 基本方針

Activity関数内で環境変数やグローバル設定を直接読み込むことは**禁止**します。
これは以下の理由によります：

1. **本番環境での設定漏れを起動時に検出**: Worker起動時に環境変数を読み込むため、設定漏れがあれば即座にエラーとなる
2. **テスト容易性**: モックを簡単に注入できる
3. **純粋関数**: Activity関数が純粋関数として保たれる

### 実装パターン: カリー化

Activity関数は**カリー化された関数**として実装します。

```typescript
import { ApplicationFailure } from '@temporalio/common';
import type { ManagementClient } from 'auth0';

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

### Worker での使用

Worker起動時に環境変数を読み込んで、カリー化された関数に注入します：

```typescript
// worker.ts
import { Worker } from '@temporalio/worker';
import { getAuth0ConfigFromEnv, createAuth0ManagementClient, getAuth0User } from './activities/auth/auth0';

const auth0Config = getAuth0ConfigFromEnv();
const auth0Client = createAuth0ManagementClient(auth0Config);

const worker = await Worker.create({
    activities: {
        getAuth0User: getAuth0User(auth0Client),
    },
    taskQueue: 'main',
});

await worker.run();
```

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
import { ApplicationFailure } from '@temporalio/common';
import { Database } from '../connection';

export type InsertUser = (input: CreateUserInput) => Promise<User>;

export const createUser = (db: Database): InsertUser => 
    async (input: CreateUserInput) => {
        try {
            const result = await db.insert(users).values(input).returning();
            if (!result[0]) {
                throw createUserError({
                    type: UserErrorType.DATABASE_ERROR,
                    message: 'Failed to create user: no rows returned',
                    nonRetryable: false,
                });
            }
            return result[0];
        } catch (error) {
            if (error instanceof ApplicationFailure) {
                throw error;
            }
            throw createUserError({
                type: UserErrorType.DATABASE_ERROR,
                message: 'Failed to create user',
                details: error,
                nonRetryable: false,
            });
        }
    };
```

## トランザクション設計の原則

### 設計判断の基準

1. **データを読んで判断する処理** → 必ずWorkflowで実装
2. **複雑なフローはWorkflowで管理**すると保守性が向上する
3. **DB層でしかできないこと** → Activity内トランザクションもOK

### ✅ 推奨: Workflowで複数テーブルを管理（保守性・可読性優先）

```typescript
// backend/src/workflows/booking.ts
export async function checkInWithQRCodeWorkflow(qrCode: string) {
  const booking = await getBookingByQrCode(qrCode);
  
  if (!booking) {
    throw new ApplicationFailure('Booking not found', 'INVALID_QR_CODE');
  }
  
  if (booking.status === 'attended') {
    throw new ApplicationFailure('Already checked in', 'ALREADY_ATTENDED');
  }
  
  await updateBooking(booking.id, {
    status: 'attended',
    attendedAt: new Date(),
  });
  
  const payment = await getPaymentByBookingId(booking.id);
  
  if (payment?.paymentMethod === 'onsite' && payment.status === 'pending') {
    await completePayment(booking.id);
  }
  
  return booking;
}
```

## 禁止事項

### ❌ Activity内で環境変数やグローバル状態を直接読み込む

```typescript
// ❌ BAD: Activity内でgetDatabase()を呼び出す
export async function createBookingActivity(data: BookingCreateInput) {
    const { getDatabase } = await import('../connection');
    const db = getDatabase(); // グローバル状態に依存
}

// ✅ GOOD: 依存注入パターン
export const createBookingActivity = (db: Database) =>
    async (data: BookingCreateInput): Promise<Booking> => {
        return await insertBooking(db)(data);
    };
```

### ❌ データを読んで判断する処理をActivity内で行う

Activity内で「データを読む → 判断 → 処理」を行うのはアンチパターンです。これはWorkflowの責務です。