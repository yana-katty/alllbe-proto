---
applyTo: "backend/**"
---

# Logger 戦略指示書: Alllbe Backend

## 概要

Alllbe Backend では、Winston ベースのロガーと Temporal の標準 Context Logger を組み合わせて、統一的なログ管理を実現します。

## ログの流れ

```
┌─────────────────────────────────────────────────────────────┐
│                     Activity 内                              │
│  import { log } from '@temporalio/activity'                 │
│  log.info('Activity started', { data })                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ 自動転送（workflowId, activityId 付与）
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                     Workflow 内                              │
│  import { log } from '@temporalio/workflow'                 │
│  log.info('Workflow started', { data })                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ 自動転送（Replay 回避機能付き）
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                 Temporal Runtime Logger                      │
│  DefaultLogger (カスタマイズ可能)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   Winston Logger                             │
│  createWinstonLogger() (shared/logger/)                     │
│  - Console output (formatted)                               │
│  - File output (JSON, optional)                             │
│  - 一元管理                                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     tRPC Handler                             │
│  import { trpcLogger } from '@/trpc/logger'                 │
│  trpcLogger.info('Request received', { userId })            │
└─────────────────────┬───────────────────────────────────────┘
                      │ 直接出力
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   Winston Logger                             │
│  createWinstonLogger() (shared/logger/)                     │
│  - service: 'trpc' メタデータ付与                           │
└─────────────────────────────────────────────────────────────┘
```

## Logger の使い分け

### 1. Activity 内での使用

**使用する Logger**: `log` from `@temporalio/activity`

```typescript
// backend/src/activities/db/models/organization.ts
import { log } from '@temporalio/activity';

export const createOrganizationActivity = async (input: CreateInput) => {
  log.info('Creating organization', { email: input.email });
  
  try {
    const result = await db.insert(organizations).values(input).returning();
    log.info('Organization created successfully', { id: result.id });
    return ok(result);
  } catch (error) {
    log.error('Failed to create organization', { error, email: input.email });
    return err({ code: 'DATABASE_ERROR', message: 'Insert failed', details: error });
  }
};
```

**特徴**:
- ✅ workflowId, activityId, runId が自動的に付与される
- ✅ Runtime Logger に自動転送される
- ✅ Workflow から呼ばれても、tRPC から直接呼ばれても同じように動作
- ⚠️ Activity Context 外（tRPC Handler など）では使用不可

### 2. Workflow 内での使用

**使用する Logger**: `log` from `@temporalio/workflow`

```typescript
// backend/src/workflows/organization.ts
import { log } from '@temporalio/workflow';
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '@/activities';

const { createOrganizationActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10s',
});

export async function createOrganizationWorkflow(input: CreateInput) {
  log.info('Workflow started', { email: input.email });
  
  try {
    const org = await createOrganizationActivity(input);
    log.info('Workflow completed successfully', { orgId: org.id });
    return org;
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      log.error('Activity failed', { error: error.message, type: error.type });
    }
    throw error;
  }
}
```

**特徴**:
- ✅ Replay 時にログが重複しない（Temporal が自動管理）
- ✅ workflowId, runId が自動的に付与される
- ✅ Runtime Logger に自動転送される
- ⚠️ Workflow Context 外では使用不可

### 3. tRPC Handler での使用

**使用する Logger**: `trpcLogger` from `@/trpc/logger`

```typescript
// backend/src/trpc/organization.ts
import { trpcLogger } from '@/trpc/logger';
import { router, protectedProcedure } from './base';
import { createOrganizationWorkflow } from '@/workflows/organization';

export const organizationRouter = router({
  create: protectedProcedure
    .input(createOrganizationSchema)
    .mutation(async ({ input, ctx }) => {
      trpcLogger.info('Creating organization', { 
        email: input.email,
        userId: ctx.user.id 
      });
      
      const handle = await temporalClient.workflow.start(createOrganizationWorkflow, {
        args: [input],
        taskQueue: 'main',
        workflowId: `org-${input.email}`,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
      });
      
      const result = await handle.result();
      
      trpcLogger.info('Organization created', { orgId: result.id });
      return result;
    }),
});
```

**特徴**:
- ✅ Temporal Context 外での処理用
- ✅ service: 'trpc' メタデータが自動付与
- ✅ Winston で柔軟に設定可能

### 4. Temporal Runtime 初期化

**使用する関数**: `initializeTemporalRuntime()` from `@/workflows/logger`

```typescript
// Worker 起動スクリプト
import { initializeTemporalRuntime } from '@/workflows/logger';
import { Worker } from '@temporalio/worker';

// Worker 作成前に一度だけ呼び出す
initializeTemporalRuntime();

const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  activities,
  taskQueue: 'main',
});

await worker.run();
```

**特徴**:
- ✅ Activity と Workflow のログを Winston に一元管理
- ✅ Rust Core のログも取得可能
- ⚠️ 一度だけ呼び出す（複数回呼び出すとエラー）

## 設定方法

### 環境変数

```bash
# ログレベル（デフォルト: production = 'info', development = 'debug'）
LOG_LEVEL=debug

# tRPC ログファイルパス（オプション）
TRPC_LOG_PATH=/var/log/alllbe/trpc.log

# Temporal ログファイルパス（オプション）
TEMPORAL_LOG_PATH=/var/log/alllbe/temporal.log

# 環境
NODE_ENV=production
```

### ログレベル

| Level | 用途 | 本番環境 | 開発環境 |
|-------|------|----------|----------|
| `error` | エラー発生時 | ✅ | ✅ |
| `warn` | 警告・注意 | ✅ | ✅ |
| `info` | 一般情報 | ✅ | ✅ |
| `http` | HTTP リクエスト | ❌ | ✅ |
| `verbose` | 詳細情報 | ❌ | ✅ |
| `debug` | デバッグ情報 | ❌ | ✅ |
| `silly` | 最も詳細 | ❌ | ❌ |

## 実装パターン

### パターン 1: Activity での標準的なログ出力

```typescript
import { log } from '@temporalio/activity';
import { ApplicationFailure } from '@temporalio/common';

export const processPaymentActivity = async (input: PaymentInput): Promise<PaymentResult> => {
  log.info('Processing payment', { 
    amount: input.amount, 
    currency: input.currency 
  });
  
  try {
    const result = await paymentAPI.charge(input);
    log.info('Payment processed successfully', { transactionId: result.id });
    return result;
  } catch (error) {
    log.error('Payment failed', { error, input });
    throw createPaymentError({
      type: PaymentErrorType.CHARGE_FAILED,
      message: 'Charge failed',
      details: error,
      nonRetryable: false,
    });
  }
};
```

### パターン 2: Workflow での複数 Activity 呼び出しログ

```typescript
import { log } from '@temporalio/workflow';
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';

export async function bookExperienceWorkflow(input: BookingInput) {
  log.info('Booking workflow started', { experienceId: input.experienceId });
  
  try {
    // Step 1: 予約作成
    log.debug('Creating booking record');
    const booking = await activities.createBookingActivity(input);
    
    // Step 2: 決済処理
    log.debug('Processing payment', { bookingId: booking.id });
    const payment = await activities.processPaymentActivity({
      bookingId: booking.id,
      amount: input.amount,
    });
    
    log.info('Booking completed successfully', { 
      bookingId: booking.id,
      paymentId: payment.id 
    });
    
    return { booking, payment };
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      log.error('Booking workflow failed', { 
        type: error.type,
        message: error.message 
      });
    }
    throw error;
  }
}
```

### パターン 3: tRPC Handler でのエラーログ

```typescript
import { trpcLogger } from '@/trpc/logger';
import { TRPCError } from '@trpc/server';

export const bookingRouter = router({
  create: protectedProcedure
    .input(createBookingSchema)
    .mutation(async ({ input, ctx }) => {
      trpcLogger.info('Booking request received', { 
        userId: ctx.user.id,
        experienceId: input.experienceId 
      });
      
      try {
        const handle = await temporalClient.workflow.start(bookExperienceWorkflow, {
          args: [input],
          taskQueue: 'main',
          workflowId: `booking-${ctx.user.id}-${input.experienceId}`,
          workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
        });
        
        const result = await handle.result();
        
        trpcLogger.info('Booking successful', { 
          bookingId: result.booking.id,
          userId: ctx.user.id 
        });
        
        return result;
      } catch (error) {
        trpcLogger.error('Booking workflow failed', { 
          error,
          userId: ctx.user.id,
          input 
        });
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create booking',
          cause: error,
        });
      }
    }),
});
```

## ベストプラクティス

### ✅ DO（推奨）

1. **適切なログレベルを使用**
   ```typescript
   log.info('User logged in', { userId }); // 一般情報
   log.warn('Rate limit approaching', { usage: '90%' }); // 警告
   log.error('Database connection failed', { error }); // エラー
   log.debug('Query executed', { sql, duration }); // デバッグ
   ```

2. **構造化されたメタデータを追加**
   ```typescript
   log.info('Order created', {
     orderId: order.id,
     userId: order.userId,
     amount: order.amount,
     currency: order.currency,
   });
   ```

3. **エラーオブジェクトを含める**
   ```typescript
   try {
     // ...
   } catch (error) {
     log.error('Operation failed', { error, context: additionalInfo });
   }
   ```

4. **重要なビジネスイベントをログ**
   ```typescript
   log.info('Payment completed', { transactionId, amount });
   log.warn('Inventory low', { productId, remaining: 5 });
   ```

### ❌ DON'T（非推奨）

1. **センシティブ情報のログ出力を避ける**
   ```typescript
   // ❌ BAD
   log.info('User data', { password: user.password, creditCard: user.card });
   
   // ✅ GOOD
   log.info('User data', { userId: user.id, email: user.email });
   ```

2. **過度なログ出力を避ける**
   ```typescript
   // ❌ BAD
   for (const item of items) {
     log.debug('Processing item', { item }); // ループ内で大量出力
   }
   
   // ✅ GOOD
   log.debug('Processing items', { count: items.length });
   // 処理後
   log.info('Items processed', { successCount, failureCount });
   ```

3. **Activity Context 外で Activity Logger を使用しない**
   ```typescript
   // ❌ BAD - tRPC Handler で Activity Logger を使用
   import { log } from '@temporalio/activity';
   export const handler = async () => {
     log.info('Processing...'); // エラー: Context がない
   };
   
   // ✅ GOOD - tRPC Handler では trpcLogger を使用
   import { trpcLogger } from '@/trpc/logger';
   export const handler = async () => {
     trpcLogger.info('Processing...');
   };
   ```

4. **Runtime 初期化を複数回呼び出さない**
   ```typescript
   // ❌ BAD
   initializeTemporalRuntime();
   // ... later
   initializeTemporalRuntime(); // エラー: 既に初期化済み
   
   // ✅ GOOD - Worker 起動時に一度だけ
   initializeTemporalRuntime();
   const worker = await Worker.create({ ... });
   ```

## トラブルシューティング

### 問題: Activity Logger がログを出力しない

**原因**: Activity Context が存在しない（tRPC Handler など）

**解決策**: 
```typescript
// Activity 内では Activity Logger
import { log } from '@temporalio/activity';

// tRPC Handler では trpcLogger
import { trpcLogger } from '@/trpc/logger';
```

### 問題: Workflow ログが重複する

**原因**: Workflow Context Logger ではなく、通常のロガーを使用している

**解決策**:
```typescript
// ❌ BAD
import { trpcLogger } from '@/trpc/logger';

// ✅ GOOD - Workflow 内では Workflow Logger を使用
import { log } from '@temporalio/workflow';
```

### 問題: Runtime 初期化エラー

**エラー**: `Runtime already installed`

**解決策**: `initializeTemporalRuntime()` は Worker 起動時に一度だけ呼び出す

```typescript
// ✅ GOOD - main entry point
import { initializeTemporalRuntime } from '@/workflows/logger';

initializeTemporalRuntime(); // 一度だけ

const worker = await Worker.create({ ... });
await worker.run();
```

## 参考資料

- [Temporal Observability - TypeScript SDK](https://docs.temporal.io/develop/typescript/observability)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Architecture Guidelines](./architecture.instructions.md)

---

この Logger 戦略に従って、統一的で保守性の高いログ管理を実現してください。
