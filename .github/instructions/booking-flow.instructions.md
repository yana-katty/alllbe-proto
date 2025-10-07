---
applyTo: "backend/src/**"
---

# 予約・決済・来場・Afterコンテンツ解放フロー

このドキュメントは、Alllbe プラットフォームにおける予約から体験後のコンテンツ解放までの全体フローを定義します。

## アーキテクチャ: Booking と Payment の分離

**設計原則**:
- **Bookings テーブル**: 予約情報（参加者数、訪問予定日時、ステータス、QRコードなど）
- **Payments テーブル**: 決済情報（支払い方法、ステータス、金額、Stripe連携IDなど）
- **リレーション**: `payments.bookingId` → `bookings.id` (1対1)

**メリット**:
- 複数回決済のサポート（追加チケット購入、部分返金）
- 外部決済サービス連携が容易
- 決済履歴の明確な管理

## 予約フロー

### 現地決済の場合

1. **予約作成**: Booking エンティティ作成、ステータス `confirmed`、QRコード生成
2. **Payment作成**: paymentMethod `onsite`、status `pending`
3. **通知**: 予約確認メール、QRコード添付

### クレジットカード決済の場合（Phase 2）

1. **予約＋決済**: Stripe連携、決済完了後に Booking作成
2. **Payment作成**: paymentMethod `credit_card`、status `completed`、stripePaymentIntentId保存
3. **通知**: 決済完了メール、QRコード添付

## キャンセルフロー

### 現地決済のキャンセル

- Booking ステータス → `cancelled`
- Payment ステータス → `cancelled`
- 通知: キャンセル確認メール

### クレジットカード決済後のキャンセル（Phase 2）

- Stripe返金処理
- Booking ステータス → `cancelled`
- Payment ステータス → `refunded`、refundedAt記録
- 通知: 返金完了メール

## 来場フロー（QRコードチェックイン）

1. **QRコード読取**: Organization端末でQRコードスキャン
2. **バリデーション**:
   - Booking存在チェック
   - ステータスが `confirmed` か確認
   - 二重チェックイン防止（`attended` の場合エラー）
3. **現地払い処理**: paymentMethod `onsite` の場合、支払い確認後に Payment ステータス → `completed`
4. **来場記録**: Booking ステータス → `attended`、attendedAt記録
5. **Afterコンテンツ解放**: ExperienceAssets の accessibleAfter を有効化

## Afterコンテンツアクセス

### アクセス条件

- **Before**: 誰でも閲覧可能（Experience の魅力を伝える）
- **Public**: 誰でも閲覧可能
- **Ticket Purchased**: Booking ステータス `confirmed` または `attended`
- **After**: Booking ステータス `attended`（実際に体験済み）

### 実装原則

- ユーザーがコンテンツアクセス時に Booking ステータスをチェック
- `attended` の場合のみ After コンテンツを表示
- Phase 2: コンテンツアクセス履歴の記録

## 状態遷移

### Booking Status

```
draft → confirmed → attended
         ↓
      cancelled
```

### Payment Status

```
pending → completed
   ↓
cancelled / refunded
```

## エラーハンドリング

### 予約時

- Experience が `published` でない → `EXPERIENCE_NOT_AVAILABLE`
- 定員超過 → `EXPERIENCE_FULL`
- 無効な訪問予定時刻 → `INVALID_VISIT_TIME`

### 来場時

- 無効なQRコード → `INVALID_QR_CODE`
- 既にチェックイン済み → `ALREADY_ATTENDED`
- キャンセル済み → `BOOKING_CANCELLED`

### 決済時（Phase 2）

- Stripe決済失敗 → `PAYMENT_FAILED`
- 返金失敗 → `REFUND_FAILED`

## 実装方針

- **予約・キャンセル**: Workflow で実装（補償処理が必要）
- **来場記録**: Workflow で実装（複数テーブル更新、トランザクション必要）
- **コンテンツアクセス**: Actions で実装（Read操作主体）
- **エラーハンドリング**: ApplicationFailure を使用、適切なエラータイプを設定

詳細な実装パターンについては [Backend Layers Instructions](./backend-layers.instructions.md) を参照してください。
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

⚠️ **重要な設計原則**: 
- **BookingとPaymentは別々のWorkflowで更新する**
- Activity内で複数テーブルを跨ぐトランザクションは実装しない
- 複雑なフローはWorkflowで管理し、SAGAパターンで補償処理を実装

**ステップ1: QRコード読取**
- Organization のスタッフが入場管理端末でQRコードをスキャン
- `qrCode` で Booking を検索

**Workflow実装例**:
```typescript
// backend/src/workflows/booking.ts
export async function checkInWithQRCodeWorkflow(qrCode: string) {
  // Activity 1: QRコードでBookingを取得
  const bookingResult = await activities.getBookingByQrCode(qrCode);
  
  if (bookingResult.isErr() || !bookingResult.value) {
    throw new ApplicationFailure('Booking not found', 'INVALID_QR_CODE');
  }
  
  const booking = bookingResult.value;
  
  // バリデーション
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
      
      // 支払い完了エラーは警告のみ（入場は成功させる）
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

**実装状況**: ✅ 実装済み

Booking と Payment の更新は Temporal Workflow で管理されています：
- **実装場所**: `backend/src/workflows/booking.ts` の `checkInWithQRCodeWorkflow`
- **設計**: 複数テーブル更新はWorkflow層で管理、各ActivityはSingle Table責務
- **SAGAパターン**: エラー時の補償処理はWorkflowで実装

---

## Phase 2 での拡張

### 計画中の機能

1. **クレジットカード決済の完全実装**
   - Stripe との統合
   - 自動返金処理
   - 分割払い対応

2. **複雑なアクセス権限（ExperienceAssets）**
   - `getAccessibleAssets`: ユーザーの予約・参加状況に基づいたコンテンツ取得
   - `checkAssetAccess`: 特定コンテンツへのアクセス可否チェック
   - 時限的アクセス（体験後1週間のみ）
   - 条件付きアクセス（複数Experience体験者限定）
   - ExperienceAssetsAccessPolicies テーブルへの移行

3. **キャッシュ戦略**
   - ユーザーごとの体験履歴をキャッシュ
   - アクセス権限チェックの高速化
   - コンテンツ一覧のキャッシュ（5-10分）

4. **通知システム**
   - 予約確定時通知
   - 予約前日リマインダー（24時間前）
   - 入場完了時通知
   - Afterコンテンツ追加時通知（オプション）
   - キャンセル時通知

5. **体験者レビュー**
   - 体験後のレビュー投稿
   - Organization による承認フロー
   - 公開レビューの表示

6. **体験後の特典**
   - フォトスポット
   - 体験証明書
   - 次回クーポン

---

## 実装状況

### ✅ 実装済み

すべての主要コンポーネントが実装されています:

- **Workflows** → `backend/src/workflows/booking.ts`
  - `createBookingWorkflow`: 予約作成とQRコード生成
  - `checkInWithQRCodeWorkflow`: QRコードでのチェックイン処理
  - `cancelBookingWorkflow`: 予約キャンセル処理

- **Actions** → `backend/src/actions/booking.ts`
  - `getBookingById`: 予約詳細取得
  - `listBookingsByUserAction`: ユーザーの予約一覧
  - `listBookingsByExperienceAction`: 体験の予約一覧
  - `listAttendedBookingsByUserAction`: 参加済み予約一覧
  - `hasUserAttendedExperienceAction`: 体験参加確認

- **tRPC Router** → `backend/src/trpc/booking.ts`
  - Queries: `getById`, `listMine`, `listByExperience`, `listAttended`, `hasAttended`
  - Mutations: `create`, `checkIn`, `cancel`

- **Tests**
  - Workflow Tests → `backend/src/workflows/booking.workflow.test.ts`
  - tRPC Router Tests → `backend/src/trpc/booking.test.ts`

---

## Activity関数一覧

実装済みのActivity関数については以下のファイルを参照:

- **Booking Activities** → `backend/src/activities/db/models/booking.ts`
  - CRUD操作: `insertBooking`, `findBookingById`, `findBookingByQrCode`, `listBookings`, `updateBooking`, etc.
  - ビジネスロジック: `listAttendedBookingsByUser`, `hasUserAttendedExperience`

- **Payment Activities** → `backend/src/activities/db/models/payment.ts`
  - CRUD操作: `insertPayment`, `findPaymentById`, `findPaymentByBookingId`, `updatePayment`, etc.
  - ビジネスロジック: `completePayment`, `refundPayment`

**⚠️ 設計方針**: 
- 入場処理（QRコード読み取り → Booking更新 → Payment更新）はWorkflowで実装
- 各Activityは単一テーブルの操作に専念
- データを読んで判断する処理はWorkflowの責務

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

実装済みのActivity関数については以下のファイルを参照:

- **Booking Activities** → `backend/src/activities/db/models/booking.ts`
  - CRUD操作: `insertBooking`, `findBookingById`, `findBookingByQrCode`, `listBookings`, `updateBooking`, etc.
  - ビジネスロジック: `listAttendedBookingsByUser`, `hasUserAttendedExperience`

- **Payment Activities** → `backend/src/activities/db/models/payment.ts`
  - CRUD操作: `insertPayment`, `findPaymentById`, `findPaymentByBookingId`, `updatePayment`, etc.
  - ビジネスロジック: `completePayment`, `refundPayment`

**⚠️ 設計方針**: 
- 入場処理（QRコード読み取り → Booking更新 → Payment更新）はWorkflowで実装
- 各Activityは単一テーブルの操作に専念
- データを読んで判断する処理はWorkflowの責務

---

このドキュメントは、Alllbe プラットフォームの予約から体験後のコンテンツ解放までの全体フローを定義しています。実装時は必ずこのフローに従い、状態遷移とエラーハンドリングを適切に行ってください。
