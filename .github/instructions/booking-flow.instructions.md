---
applyTo: "backend/src/**"
---

# 予約・決済・来場・Afterコンテンツ解放フロー

このドキュメントは、Alllbe プラットフォームにおける予約から体験後のコンテンツ解放までの全体フローを定義します。

## 🔄 アーキテクチャ変更 (2025年版)

### Booking と Payment の分離

**背景**: 予約情報と決済情報を分離することで、拡張性と保守性を向上。

**設計原則**:
- **Bookings テーブル**: 予約に関する情報（参加者数、訪問予定日時、ステータス、QRコードなど）
- **Payments テーブル**: 決済に関する情報（支払い方法、ステータス、金額、Stripe連携IDなど）
- **リレーション**: `payments.bookingId` → `bookings.id` (1対1)

**メリット**:
- 複数回決済のサポート（例: 追加チケット購入、部分返金）
- Stripe等の外部決済サービス連携が容易
- 決済履歴の明確な管理
- 監査証跡の向上

---

## 目次

1. [予約から来場までのフロー](#予約から来場までのフロー)
2. [来場からAfterコンテンツ解放までのフロー](#来場からafterコンテンツ解放までのフロー)
3. [状態管理](#状態管理)
4. [エラーハンドリング](#エラーハンドリング)

---

## 予約から来場までのフロー

### 1. Experience 公開

**前提条件**:
- Organization が Experience を作成済み
- Experience の `status` が `published`
- `acceptOnsitePayment` または `acceptCreditCard` が `true`

**エンティティ**:
```typescript
Experience {
  status: 'published',
  acceptOnsitePayment: true,  // 現地払い受付
  acceptCreditCard: false,     // クレカ払い受付（Phase 1では未実装）
  price: '¥6,800',
  ...
}
```

---

### 2. ユーザーによる予約

#### シナリオA: 現地決済の場合

**ステップ1: 予約作成**
- ユーザーが Experience 詳細ページで「予約する」をクリック
- 参加人数、訪問予定時刻を入力
- 支払い方法として「現地決済」を選択

**Booking エンティティ作成**:
```typescript
Booking {
  id: 'booking-uuid',
  experienceId: 'experience-uuid',
  userId: 'user-uuid',
  numberOfParticipants: '2',
  scheduledVisitTime: '2025-10-15T14:00:00Z',
  status: 'confirmed',           // 予約確定
  qrCode: 'UNIQUE_QR_CODE_123',  // QRコード生成
  createdAt: '2025-10-07T10:00:00Z',
}
```

**Payment エンティティ作成**:
```typescript
Payment {
  id: 'payment-uuid',
  bookingId: 'booking-uuid',     // Bookingへの参照
  paymentMethod: 'onsite',       // 現地払い
  status: 'pending',             // 支払い待ち
  amount: '13600',               // 2名分（数値形式）
  currency: 'JPY',
  paidAt: null,                  // 未払い
  createdAt: '2025-10-07T10:00:00Z',
}
```

**ユーザーへの通知**:
- メールで予約確認通知
- QRコードを添付
- 「当日現地でお支払いください」のメッセージ

**アクセス可能なコンテンツ**:
- `accessLevel: 'public'` のコンテンツ（誰でも閲覧可能）
- `accessLevel: 'ticket_holder'` かつ `contentTiming: 'before'` のコンテンツ（予約者限定のBefore体験）

---

#### シナリオB: クレジットカード決済の場合（Phase 2）

**ステップ1: 予約＋決済**
- ユーザーが Experience 詳細ページで「予約する」をクリック
- 参加人数、訪問予定時刻を入力
- 支払い方法として「クレジットカード」を選択
- 決済処理（Stripe等の決済プロバイダー経由）

**Booking エンティティ作成**:
```typescript
Booking {
  id: 'booking-uuid',
  experienceId: 'experience-uuid',
  userId: 'user-uuid',
  numberOfParticipants: '2',
  scheduledVisitTime: '2025-10-15T14:00:00Z',
  status: 'confirmed',           // 予約確定
  qrCode: 'UNIQUE_QR_CODE_456',
  createdAt: '2025-10-07T10:00:00Z',
}
```

**Payment エンティティ作成**:
```typescript
Payment {
  id: 'payment-uuid',
  bookingId: 'booking-uuid',
  paymentMethod: 'credit_card',  // クレカ払い
  status: 'completed',           // 支払い完了
  amount: '13600',
  currency: 'JPY',
  paymentIntentId: 'pi_stripe_xxxxx',  // Stripe Payment Intent ID
  transactionId: 'ch_stripe_yyyyy',    // Stripe Charge ID
  paidAt: '2025-10-07T10:05:00Z',      // 支払い完了時刻
  createdAt: '2025-10-07T10:00:00Z',
}
```

**ユーザーへの通知**:
- メールで予約確認＋決済完了通知
- QRコードを添付
- 「お支払いが完了しました」のメッセージ

**アクセス可能なコンテンツ**:
- `accessLevel: 'public'` のコンテンツ
- `accessLevel: 'ticket_holder'` かつ `contentTiming: 'before'` のコンテンツ

---

### 3. キャンセル処理

#### シナリオA: 現地決済のキャンセル

**条件**: Payment の `status: 'pending'`（未払い）

**処理**:
```typescript
// Booking 更新
Booking.update({
  status: 'cancelled',           // キャンセル済み
  cancelledAt: '2025-10-14T09:00:00Z',
  cancellationReason: 'User requested cancellation',
});

// Payment は未払いのまま（返金不要）
Payment {
  status: 'pending',  // 変更なし
}
```

**ユーザーへの通知**:
- キャンセル完了通知
- 「お支払いは発生しておりません」

**アクセス可能なコンテンツ**:
- `accessLevel: 'public'` のみ（予約者限定コンテンツへのアクセス喪失）

---

#### シナリオB: クレジットカード決済後のキャンセル（Phase 2）

**条件**: Payment の `status: 'completed'`（支払い済み）

**処理**:
```typescript
// Booking 更新
Booking.update({
  status: 'cancelled',
  cancelledAt: '2025-10-14T09:00:00Z',
  cancellationReason: 'User requested cancellation',
});

// Payment 更新（返金処理）
Payment.update({
  status: 'refunded',            // 返金済み
  refundId: 're_stripe_zzzzz',   // Stripe Refund ID
  refundedAt: '2025-10-14T09:10:00Z',
});
```

**ユーザーへの通知**:
- キャンセル＋返金完了通知
- 「5-7営業日でご返金されます」

**アクセス可能なコンテンツ**:
- `accessLevel: 'public'` のみ

---

### 4. 来場・入場処理

**ステップ1: QRコード読取**
- Organization のスタッフが入場管理端末でQRコードをスキャン
- `qrCode` で Booking を検索

**バリデーション**:
```typescript
// 1. Booking が存在するか
if (!booking) return Error('予約が見つかりません');

// 2. すでに入場済みか
if (booking.status === 'attended') return Error('すでに入場済みです');

// 3. キャンセル済みか
if (booking.status === 'cancelled') return Error('この予約はキャンセルされています');

// 4. 日時が正しいか（オプション）
if (booking.scheduledVisitTime > now + 30min) return Error('入場時刻前です');
```

**ステップ2: 現地決済の場合の支払い処理**
```typescript
// Paymentテーブルから決済情報を取得
const payment = await getPaymentByBookingId(booking.id);

if (payment && payment.paymentMethod === 'onsite' && payment.status === 'pending') {
  // スタッフが現金/カードで決済完了を確認
  await completePaymentActivity(booking.id);
  // Payment.status が 'completed' に更新
  // Payment.paidAt が設定される
}
```

**ステップ3: 入場記録**
```typescript
// markBookingAsAttendedActivity が内部的に以下を実行：
// 1. Booking の status を 'attended' に更新
// 2. Booking の attendedAt を設定
// 3. 現地払いの場合は Payment を完了状態に更新

await markBookingAsAttendedActivity(qrCode);

// 結果:
Booking {
  status: 'attended',           // 入場済み
  attendedAt: '2025-10-15T14:05:00Z',
}

Payment {
  status: 'completed',          // 支払い完了（現地払いの場合）
  paidAt: '2025-10-15T14:05:00Z',
}
```

**ユーザーへの通知**:
- 入場完了通知
- 「体験をお楽しみください」

**アクセス可能なコンテンツ**:
- `accessLevel: 'public'` のコンテンツ
- `accessLevel: 'ticket_holder'` のコンテンツ（Before, Anytime）
- `accessLevel: 'attended'` かつ `contentTiming: 'after'` のコンテンツ（**After体験解放！**）

---

## 来場からAfterコンテンツ解放までのフロー

### 5. 体験中

**状態**:
```typescript
Booking {
  status: 'attended',
  paymentStatus: 'completed',
  attendedAt: '2025-10-15T14:05:00Z',
}
```

**ユーザー体験**:
- Experience の体験コンテンツを楽しむ（45分間のVR体験など）
- リアルタイムで体験が進行

---

### 6. 体験終了・After コンテンツ解放

**トリガー**: `status: 'attended'` かつ `attendedAt` が記録されている

**After コンテンツへのアクセス権限**:
```typescript
// ExperienceAssets の取得条件
ExperienceAssets.where({
  experienceId: booking.experienceId,
  accessLevel: 'attended',        // 体験済み限定
  contentTiming: 'after',         // After コンテンツ
  isActive: true,
})
```

**解放されるコンテンツ例**:
1. **体験の振り返り動画**
   - `assetType: 'video'`
   - `category: 'making'`
   - `title: '制作秘話 - VR技術の裏側'`

2. **アートワーク集**
   - `assetType: 'image'`
   - `category: 'other'`
   - `title: 'コンセプトアート集'`

3. **ダウンロードコンテンツ**
   - `assetType: 'download'`
   - `category: 'other'`
   - `title: '体験証明書 PDF'`

4. **インタビュー記事**
   - `assetType: 'article'`
   - `category: 'interview'`
   - `title: '開発者インタビュー - 恐怖の演出について'`

---

### 7. Experience Circle への参加

**After コンテンツの役割**:
- **気持ち的な繋がり**: 体験後もクリエイター・作品との繋がりを維持
- **リテンション促進**: 定期的な新コンテンツ追加でユーザーの関心を持続
- **次回集客**: 良質なAfter体験が次の Experience への参加動機を創出

**ユーザー行動**:
1. After コンテンツを閲覧・ダウンロード
2. 体験の余韻を楽しむ
3. 次回の Experience への期待感を高める
4. Organization の他の Experience を発見

**Organization 側の運用**:
- After コンテンツの定期的な追加・更新
- ユーザーのコンテンツアクセス状況を分析
- 人気コンテンツの傾向を把握
- 次回 Experience の企画に反映

---

## 状態管理

### Booking の状態遷移図

```
[予約作成]
    ↓
confirmed (予約確定)
    ↓ ←──────────────┐
    │                  │
    ├─ [キャンセル] → cancelled
    │                  │
    ├─ [No Show] ───→ no_show
    │                  │
    ↓                  │
[QRコード読取・入場]  │
    ↓                  │
attended (入場済み) ──┘
```

### PaymentStatus の状態遷移図

```
【現地決済】
pending (支払い待ち)
    ↓
[来場・支払い完了]
    ↓
completed (支払い完了)


【クレカ決済】
[予約時に決済]
    ↓
completed (支払い完了)
    ↓
[キャンセル時]
    ↓
refunded (返金済み)


【現地決済キャンセル】
pending (支払い待ち)
    ↓
[キャンセル]
    ↓
pending (返金不要・未払いのまま)
```

---

## エラーハンドリング

### 予約時のエラー

1. **定員超過**
   - `ExperienceErrorCode.CAPACITY_EXCEEDED`
   - メッセージ: 「申し訳ございません。この体験は満員です」

2. **予約期限切れ**
   - `BookingErrorCode.BOOKING_DEADLINE_PASSED`
   - メッセージ: 「予約受付期間が終了しました」

3. **決済エラー（クレカ）**
   - `BookingErrorCode.PAYMENT_FAILED`
   - メッセージ: 「決済処理に失敗しました。もう一度お試しください」

---

### 入場時のエラー

1. **QRコード不正**
   - `BookingErrorCode.INVALID_QR_CODE`
   - メッセージ: 「QRコードが無効です」

2. **すでに入場済み**
   - `BookingErrorCode.ALREADY_ATTENDED`
   - メッセージ: 「この予約はすでに使用されています」

3. **キャンセル済み**
   - `BookingErrorCode.BOOKING_CANCELLED`
   - メッセージ: 「この予約はキャンセルされています」

4. **未払い（クレカ決済失敗）**
   - `BookingErrorCode.PAYMENT_INCOMPLETE`
   - メッセージ: 「お支払いが完了していません」

---

### Afterコンテンツアクセス時のエラー

1. **アクセス権限なし**
   - `ExperienceAssetErrorCode.ACCESS_DENIED`
   - メッセージ: 「このコンテンツにアクセスする権限がありません」

2. **体験未完了**
   - `ExperienceAssetErrorCode.EXPERIENCE_NOT_ATTENDED`
   - メッセージ: 「体験完了後にアクセス可能になります」

3. **コンテンツ非公開**
   - `ExperienceAssetErrorCode.CONTENT_INACTIVE`
   - メッセージ: 「このコンテンツは現在公開されていません」

---

## 実装時の注意事項

### 1. トランザクション管理

**QRコード入場処理**:
```typescript
// 入場記録と支払い完了を一括トランザクションで処理
await db.transaction(async (tx) => {
  // 1. Booking の status を attended に更新
  await tx.update(bookings).set({
    status: 'attended',
    attendedAt: new Date(),
  });
  
  // 2. 現地払いの場合は paymentStatus を completed に更新
  if (booking.paymentMethod === 'onsite') {
    await tx.update(bookings).set({
      paymentStatus: 'completed',
      paidAt: new Date(),
    });
  }
});
```

---

### 2. アクセス権限チェック

**Afterコンテンツ取得時**:
```typescript
// ユーザーが体験済みかをチェック
const hasAttended = await db.select()
  .from(bookings)
  .where(
    and(
      eq(bookings.userId, userId),
      eq(bookings.experienceId, experienceId),
      eq(bookings.status, 'attended')
    )
  )
  .limit(1);

if (!hasAttended) {
  return err({ 
    code: ExperienceAssetErrorCode.ACCESS_DENIED, 
    message: 'Experience not attended' 
  });
}

// After コンテンツを取得
const afterAssets = await listExperienceAssetsByAccessLevel(
  experienceId, 
  'attended'
);
```

---

### 3. キャッシュ戦略

**Afterコンテンツのキャッシュ**:
- ユーザーごとの体験履歴をキャッシュ
- アクセス権限チェックの高速化
- コンテンツ一覧のキャッシュ（5-10分）

---

### 4. 通知システム

**通知タイミング**:
1. 予約確定時
2. 予約前日リマインダー（24時間前）
3. 入場完了時
4. Afterコンテンツ追加時（オプション）
5. キャンセル時

---

## Phase 2 での拡張

### 計画中の機能

1. **クレジットカード決済の完全実装**
   - Stripe との統合
   - 自動返金処理
   - 分割払い対応

2. **複雑なアクセス権限**
   - 時限的アクセス（体験後1週間のみ）
   - 条件付きアクセス（複数Experience体験者限定）
   - ExperienceAssetsAccessPolicies テーブルへの移行

3. **体験者レビュー**
   - 体験後のレビュー投稿
   - Organization による承認フロー
   - 公開レビューの表示

4. **体験後の特典**
   - フォトスポット
   - 体験証明書
   - 次回クーポン

---

## 実装レイヤー別の必要な関数・ワークフロー

### Activities Layer (`backend/src/activities/db/models`)

#### 既存の Activity Functions（実装済み）

**booking.ts**:
- ✅ `insertBooking` - Booking作成
- ✅ `findBookingById` - ID で Booking 取得
- ✅ `findBookingByQrCode` - QRコードで Booking 取得
- ✅ `listBookings` - Booking 一覧取得
- ✅ `listBookingsByUser` - ユーザー別 Booking 一覧
- ✅ `listBookingsByExperience` - Experience 別 Booking 一覧
- ✅ `updateBooking` - Booking 更新
- ✅ `removeBooking` - Booking 削除
- ✅ `markBookingAsAttendedActivity` - QRコードでの入場記録

**experienceAssets.ts**:
- ✅ `insertExperienceAsset` - コンテンツ作成
- ✅ `findExperienceAssetById` - コンテンツ取得
- ✅ `listExperienceAssets` - コンテンツ一覧
- ✅ `listExperienceAssetsByExperience` - Experience 別コンテンツ
- ✅ `listExperienceAssetsByTimingActivity` - Before/After 別コンテンツ
- ✅ `listExperienceAssetsByAccessLevelActivity` - アクセス権限別コンテンツ
- ✅ `updateExperienceAsset` - コンテンツ更新
- ✅ `removeExperienceAsset` - コンテンツ削除

#### 追加が必要な Activity Functions

**booking.ts に追加**:
```typescript
/**
 * ユーザーの体験履歴取得（attended のみ）
 */
export async function listAttendedBookingsByUserActivity(
    userId: string
): Promise<{ ok: true; value: Booking[] } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookingsByUser(db)(userId, {
        status: 'attended',
    });
    
    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value };
}

/**
 * ユーザーが特定の Experience を体験済みかチェック
 */
export async function hasUserAttendedExperienceActivity(
    userId: string,
    experienceId: string
): Promise<{ ok: true; value: boolean } | { ok: false; error: BookingError }> {
    const { getDatabase } = await import('../connection');
    const db = getDatabase();
    const result = await listBookings(db)({
        userId,
        experienceId,
        status: 'attended',
        limit: 1,
        offset: 0,
    });
    
    if (result.isErr()) {
        return { ok: false, error: result.error };
    }
    return { ok: true, value: result.value.length > 0 };
}
```

---

### Workflows Layer (`backend/src/workflows`)

#### 必要な Workflows

**booking.ts**:
```typescript
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  createBookingActivity,
  updateBookingActivity,
  getBookingByQrCodeActivity,
  hasUserAttendedExperienceActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s'
});

/**
 * 予約作成 Workflow
 * - QRコード生成
 * - Booking作成
 * - 通知送信（Phase 2）
 */
export async function createBookingWorkflow(
  input: BookingCreateInput
): Promise<Booking> {
  // 1. QRコード生成（ユニーク性保証）
  const qrCode = generateUniqueQRCode();
  
  // 2. Booking 作成
  const result = await createBookingActivity({
    ...input,
    qrCode,
  });
  
  if (!result.ok) {
    throw ApplicationFailure.create({
      message: result.error.message,
      type: result.error.code,
    });
  }
  
  // 3. 通知送信（Phase 2）
  // await sendBookingConfirmationEmail(result.value);
  
  return result.value;
}

/**
 * QRコード入場 Workflow
 * - QRコード検証
 * - 入場記録
 * - 現地払いの場合は支払い完了
 */
export async function checkInWithQRCodeWorkflow(
  qrCode: string
): Promise<Booking> {
  // 1. QRコードで Booking 取得
  const bookingResult = await getBookingByQrCodeActivity(qrCode);
  
  if (!bookingResult.ok) {
    throw ApplicationFailure.create({
      message: 'QR code not found',
      type: 'QR_CODE_NOT_FOUND',
    });
  }
  
  const booking = bookingResult.value;
  if (!booking) {
    throw ApplicationFailure.create({
      message: 'Booking not found',
      type: 'BOOKING_NOT_FOUND',
    });
  }
  
  // 2. バリデーション
  if (booking.status === 'attended') {
    throw ApplicationFailure.create({
      message: 'Already checked in',
      type: 'ALREADY_ATTENDED',
    });
  }
  
  if (booking.status === 'cancelled') {
    throw ApplicationFailure.create({
      message: 'Booking is cancelled',
      type: 'BOOKING_CANCELLED',
    });
  }
  
  // 3. 入場記録＋支払い完了
  const updateResult = await updateBookingActivity(booking.id, {
    status: 'attended',
    attendedAt: new Date(),
    // 現地払いの場合は支払い完了
    ...(booking.paymentMethod === 'onsite' && booking.paymentStatus === 'pending' ? {
      paymentStatus: 'completed',
      paidAt: new Date(),
    } : {}),
  });
  
  if (!updateResult.ok) {
    throw ApplicationFailure.create({
      message: updateResult.error.message,
      type: updateResult.error.code,
    });
  }
  
  return updateResult.value!;
}

/**
 * キャンセル Workflow
 * - キャンセル処理
 * - 返金処理（クレカの場合）
 */
export async function cancelBookingWorkflow(
  bookingId: string,
  reason?: string
): Promise<Booking> {
  // 1. Booking 取得
  const bookingResult = await getBookingByIdActivity(bookingId);
  
  if (!bookingResult.ok || !bookingResult.value) {
    throw ApplicationFailure.create({
      message: 'Booking not found',
      type: 'BOOKING_NOT_FOUND',
    });
  }
  
  const booking = bookingResult.value;
  
  // 2. キャンセル処理
  const updateData: BookingUpdateInput = {
    status: 'cancelled',
    cancelledAt: new Date(),
    cancellationReason: reason,
  };
  
  // 3. クレカ決済済みの場合は返金
  if (booking.paymentMethod === 'credit_card' && booking.paymentStatus === 'completed') {
    // Phase 2: 返金処理
    // await refundPaymentActivity(booking.id);
    updateData.paymentStatus = 'refunded';
    updateData.refundedAt = new Date();
  }
  
  const result = await updateBookingActivity(bookingId, updateData);
  
  if (!result.ok) {
    throw ApplicationFailure.create({
      message: result.error.message,
      type: result.error.code,
    });
  }
  
  return result.value!;
}
```

---

### Actions Layer (`backend/src/actions`)

#### 必要な Actions

**experienceAssets.ts**:
```typescript
import type { ExperienceAsset } from '../activities/db/schema';

/**
 * ユーザーがアクセス可能なコンテンツを取得
 * - Public コンテンツは常にアクセス可能
 * - ticket_holder: 予約済みならアクセス可能
 * - attended: 体験済みならアクセス可能
 */
export const getAccessibleAssets = (deps: {
  listExperienceAssetsByExperienceActivity: (experienceId: string, params?: any) => Promise<any>;
  findBookingsByUserActivity: (userId: string, params?: any) => Promise<any>;
  hasUserAttendedExperienceActivity: (userId: string, experienceId: string) => Promise<any>;
}) => async (
  userId: string,
  experienceId: string,
  contentTiming?: 'before' | 'after' | 'anytime'
): Promise<Result<ExperienceAsset[], ExperienceAssetError>> => {
  
  // 1. 全コンテンツ取得
  const assetsResult = await deps.listExperienceAssetsByExperienceActivity(
    experienceId,
    contentTiming ? { contentTiming } : undefined
  );
  
  if (!assetsResult.ok) {
    return err(assetsResult.error);
  }
  
  const allAssets = assetsResult.value;
  
  // 2. Public コンテンツは常に含める
  const accessibleAssets = allAssets.filter((asset: ExperienceAsset) => 
    asset.accessLevel === 'public'
  );
  
  // 3. ユーザーの予約状況を確認
  const bookingsResult = await deps.findBookingsByUserActivity(userId, {
    experienceId,
    limit: 10,
  });
  
  if (bookingsResult.ok && bookingsResult.value.length > 0) {
    // 予約あり: ticket_holder コンテンツを追加
    const ticketHolderAssets = allAssets.filter((asset: ExperienceAsset) =>
      asset.accessLevel === 'ticket_holder'
    );
    accessibleAssets.push(...ticketHolderAssets);
    
    // 体験済みかチェック
    const hasAttended = bookingsResult.value.some((b: Booking) => b.status === 'attended');
    
    if (hasAttended) {
      // 体験済み: attended コンテンツを追加
      const attendedAssets = allAssets.filter((asset: ExperienceAsset) =>
        asset.accessLevel === 'attended'
      );
      accessibleAssets.push(...attendedAssets);
    }
  }
  
  return ok(accessibleAssets);
};

/**
 * ユーザーが特定のコンテンツにアクセス可能かチェック
 */
export const checkAssetAccess = (deps: {
  findExperienceAssetByIdActivity: (id: string) => Promise<any>;
  hasUserAttendedExperienceActivity: (userId: string, experienceId: string) => Promise<any>;
  findBookingsByUserActivity: (userId: string, params?: any) => Promise<any>;
}) => async (
  userId: string,
  assetId: string
): Promise<Result<boolean, ExperienceAssetError>> => {
  
  // 1. コンテンツ取得
  const assetResult = await deps.findExperienceAssetByIdActivity(assetId);
  
  if (!assetResult.ok || !assetResult.value) {
    return err({ code: 'NOT_FOUND', message: 'Asset not found' });
  }
  
  const asset = assetResult.value;
  
  // 2. Public なら常にアクセス可能
  if (asset.accessLevel === 'public') {
    return ok(true);
  }
  
  // 3. ticket_holder の場合は予約があればOK
  if (asset.accessLevel === 'ticket_holder') {
    const bookingsResult = await deps.findBookingsByUserActivity(userId, {
      experienceId: asset.experienceId,
      limit: 1,
    });
    
    if (bookingsResult.ok && bookingsResult.value.length > 0) {
      return ok(true);
    }
    return ok(false);
  }
  
  // 4. attended の場合は体験済みが必要
  if (asset.accessLevel === 'attended') {
    const hasAttendedResult = await deps.hasUserAttendedExperienceActivity(
      userId,
      asset.experienceId
    );
    
    if (hasAttendedResult.ok) {
      return ok(hasAttendedResult.value);
    }
    return ok(false);
  }
  
  return ok(false);
};
```

---

### tRPC Layer (`backend/src/trpc`)

#### 必要な Endpoints

**booking.ts**:
```typescript
import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from './base';
import { bookingCreateSchema, bookingIdSchema } from '../activities/db/models/booking';

export const bookingRouter = router({
  /**
   * 予約作成
   */
  create: protectedProcedure
    .input(bookingCreateSchema)
    .mutation(async ({ input, ctx }) => {
      // Temporal Workflow 呼び出し
      const result = await ctx.temporal.workflow.execute(
        'createBookingWorkflow',
        {
          args: [input],
          taskQueue: 'default',
          workflowId: `booking-create-${Date.now()}`,
        }
      );
      return result;
    }),
  
  /**
   * QRコード入場
   */
  checkIn: protectedProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.temporal.workflow.execute(
        'checkInWithQRCodeWorkflow',
        {
          args: [input.qrCode],
          taskQueue: 'default',
          workflowId: `checkin-${input.qrCode}-${Date.now()}`,
        }
      );
      return result;
    }),
  
  /**
   * キャンセル
   */
  cancel: protectedProcedure
    .input(z.object({ 
      bookingId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.temporal.workflow.execute(
        'cancelBookingWorkflow',
        {
          args: [input.bookingId, input.reason],
          taskQueue: 'default',
          workflowId: `booking-cancel-${input.bookingId}-${Date.now()}`,
        }
      );
      return result;
    }),
  
  /**
   * ユーザーの予約一覧取得
   */
  listMine: protectedProcedure
    .input(z.object({
      status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      // Action 呼び出し（Read操作なのでWorkflowを経由しない）
      const { listBookingsByUserAction } = await import('../actions/booking');
      const result = await listBookingsByUserAction(ctx.user.id, input);
      return result;
    }),
  
  /**
   * 予約詳細取得
   */
  getById: protectedProcedure
    .input(bookingIdSchema)
    .query(async ({ input, ctx }) => {
      const { getBookingByIdAction } = await import('../actions/booking');
      const result = await getBookingByIdAction(input.id);
      return result;
    }),
});
```

---

## データベーススキーマ詳細

### Bookings テーブル

**役割**: 予約に関する情報（体験、参加者、訪問予定、QRコードなど）

```typescript
bookings = {
  id: uuid (PK),
  experienceId: uuid (FK → experiences.id),
  userId: uuid (FK → users.id),
  numberOfParticipants: string,
  bookingDate: timestamp,
  scheduledVisitTime: timestamp?,
  status: 'confirmed' | 'cancelled' | 'attended' | 'no_show',
  qrCode: string? (UNIQUE),
  attendedAt: timestamp?,
  cancelledAt: timestamp?,
  cancellationReason: string?,
  createdAt: timestamp,
  updatedAt: timestamp,
}

// Indexes
- bookings_experience_id_idx
- bookings_user_id_idx
- bookings_status_idx
- bookings_qr_code_idx (UNIQUE)
- bookings_scheduled_visit_time_idx
- bookings_attended_at_idx
- bookings_booking_date_idx
```

### Payments テーブル

**役割**: 決済に関する情報（支払い方法、ステータス、金額、外部決済IDなど）

```typescript
payments = {
  id: uuid (PK),
  bookingId: uuid (FK → bookings.id),
  paymentMethod: 'onsite' | 'credit_card',
  status: 'pending' | 'completed' | 'refunded' | 'partially_refunded' | 'failed',
  amount: string,
  currency: string (default: 'JPY'),
  paymentIntentId: string?,  // Stripe Payment Intent ID
  refundId: string?,         // Stripe Refund ID
  transactionId: string?,    // Stripe Charge ID
  paidAt: timestamp?,
  refundedAt: timestamp?,
  metadata: string?,         // JSON形式で追加情報を保存
  createdAt: timestamp,
  updatedAt: timestamp,
}

// Indexes
- payments_booking_id_idx
- payments_status_idx
- payments_payment_method_idx
- payments_payment_intent_id_idx
```

### リレーション

```typescript
bookings (1) ←→ (1) payments  // 1対1リレーション
```

**設計の利点**:
- 複数決済のサポート（将来的に1対多に拡張可能）
- Stripe連携の容易さ（paymentIntentId, refundId保存）
- 監査証跡の向上（決済履歴が明確）
- 決済ロジックと予約ロジックの分離

---

## Activity関数一覧

### Booking Activities

```typescript
// CRUD
createBookingActivity(data: BookingCreateInput): Promise<Result<Booking>>
getBookingByIdActivity(id: string): Promise<Result<Booking>>
getBookingByQrCodeActivity(qrCode: string): Promise<Result<Booking>>
listBookingsActivity(params: BookingQueryInput): Promise<Result<Booking[]>>
listBookingsByUserActivity(userId: string, params?): Promise<Result<Booking[]>>
listBookingsByExperienceActivity(experienceId: string, params?): Promise<Result<Booking[]>>
updateBookingActivity(id: string, patch: BookingUpdateInput): Promise<Result<Booking>>
deleteBookingActivity(id: string): Promise<Result<boolean>>

// Business Logic
markBookingAsAttendedActivity(qrCode: string): Promise<Result<Booking>>
listAttendedBookingsByUserActivity(userId: string): Promise<Result<Booking[]>>
hasUserAttendedExperienceActivity(userId: string, experienceId: string): Promise<Result<boolean>>
```

### Payment Activities

```typescript
// CRUD
createPaymentActivity(data: PaymentCreateInput): Promise<Result<Payment>>
getPaymentByIdActivity(id: string): Promise<Result<Payment>>
getPaymentByBookingIdActivity(bookingId: string): Promise<Result<Payment>>
listPaymentsActivity(params: PaymentQueryInput): Promise<Result<Payment[]>>
updatePaymentActivity(id: string, patch: PaymentUpdateInput): Promise<Result<Payment>>
deletePaymentActivity(id: string): Promise<Result<boolean>>

// Business Logic
completePaymentActivity(bookingId: string, paymentIntentId?: string): Promise<Result<Payment>>
refundPaymentActivity(bookingId: string, refundId?: string): Promise<Result<Payment>>
```

---
````
**experienceAssets.ts**:
```typescript
import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from './base';

export const experienceAssetsRouter = router({
  /**
   * アクセス可能なコンテンツ一覧取得
   */
  listAccessible: protectedProcedure
    .input(z.object({
      experienceId: z.string().uuid(),
      contentTiming: z.enum(['before', 'after', 'anytime']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { getAccessibleAssets } = await import('../actions/experienceAssets');
      const result = await getAccessibleAssets(
        ctx.user.id,
        input.experienceId,
        input.contentTiming
      );
      return result;
    }),
  
  /**
   * コンテンツアクセス権限チェック
   */
  checkAccess: protectedProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { checkAssetAccess } = await import('../actions/experienceAssets');
      const result = await checkAssetAccess(ctx.user.id, input.assetId);
      return result;
    }),
  
  /**
   * Experience の Before コンテンツ取得（Public + 予約者限定）
   */
  listBefore: publicProcedure
    .input(z.object({ experienceId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // 未ログインの場合は Public のみ、ログイン済みならアクセス可能なもの全て
      if (!ctx.user) {
        const { listExperienceAssetsByAccessLevelAction } = await import('../actions/experienceAssets');
        return await listExperienceAssetsByAccessLevelAction(input.experienceId, 'public', 'before');
      }
      
      const { getAccessibleAssets } = await import('../actions/experienceAssets');
      return await getAccessibleAssets(ctx.user.id, input.experienceId, 'before');
    }),
  
  /**
   * Experience の After コンテンツ取得（体験済み限定）
   */
  listAfter: protectedProcedure
    .input(z.object({ experienceId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { getAccessibleAssets } = await import('../actions/experienceAssets');
      const result = await getAccessibleAssets(ctx.user.id, input.experienceId, 'after');
      return result;
    }),
});
```

---

このドキュメントは、Alllbe プラットフォームの予約から体験後のコンテンツ解放までの全体フローを定義しています。実装時は必ずこのフローに従い、状態遷移とエラーハンドリングを適切に行ってください。
