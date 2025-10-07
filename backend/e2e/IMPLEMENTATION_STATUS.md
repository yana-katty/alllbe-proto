# 実装状況の洗い出し

## 現在の実装状況

### ✅ 完全実装済み

#### 1. Organization & Brand 管理
- ✅ WorkOS Organization の作成・削除
- ✅ DB Organization の CRUD
- ✅ Brand の CRUD（Organization 配下）
- ✅ デフォルト Brand の自動作成
- ✅ Multi-tenant データ分離
- ✅ CASCADE 削除

**実装ファイル**:
- `backend/src/activities/db/models/organization.ts`
- `backend/src/activities/db/models/brand.ts`
- `backend/src/workflows/organization.ts`
- `backend/src/workflows/brand.ts`
- `backend/src/trpc/organization.ts`
- `backend/src/trpc/brand.ts`
- `backend/src/actions/organization.ts`
- `backend/src/actions/brand.ts`

---

### ✅ 完全実装済み

#### 2. Experience 管理

**実装済み**:
- ✅ DB Schema 定義（`backend/src/activities/db/schema.ts`）
  - Brand への紐づけ
  - 日時指定型（`scheduled`）・期間指定型（`period`）対応
  - ステータス管理（`draft`, `published`, `ended`, `archived`）
- ✅ Activity 関数（`backend/src/activities/db/models/experience.ts`）
  - `insertExperience`
  - `findExperienceById`
  - `listExperiencesByBrand`
  - `updateExperience`
  - `deleteExperience`
- ✅ Actions（`backend/src/actions/experience.ts`）
  - Read 操作用
- ✅ **Experience Workflow（`backend/src/workflows/experience.ts`）**
  - `createExperienceWorkflow`
  - `updateExperienceWorkflow`
  - `publishExperienceWorkflow`（ステータス変更）
  - `endExperienceWorkflow`（ステータス変更）
  - `archiveExperienceWorkflow`（ステータス変更）
  - `deleteExperienceWorkflow`
- ✅ tRPC Router（`backend/src/trpc/experience.ts`）
  - `getById`
  - `listByBrand`
  - `create`（Workflow呼び出し）
  - `update`（Workflow呼び出し）
  - `publish`（Workflow呼び出し）
  - `delete`（Workflow呼び出し）

**状態**:
- ✅ 全ての CRUD 操作が動作可能
- ✅ ステータス管理機能が実装済み
- ✅ E2E テストで検証可能

---

#### 3. Experience Assets（関連コンテンツ）

**実装済み**:
- ✅ DB Schema 定義
- ✅ Activity 関数（`backend/src/activities/db/models/experienceAssets.ts`）
- ✅ Actions（`backend/src/actions/experienceAsset.ts`）
- ✅ **Experience Asset Workflow（`backend/src/workflows/experienceAsset.ts`）**
  - `createExperienceAssetWorkflow`
  - `updateExperienceAssetWorkflow`
  - `deleteExperienceAssetWorkflow`
- ✅ tRPC Router（`backend/src/trpc/experienceAsset.ts`）（Workflow呼び出し）
- ✅ Workflow テスト（`backend/src/workflows/experienceAsset.workflow.test.ts`）

**状態**:
- ✅ 全ての CRUD 操作が動作可能
- ✅ Experience との紐づけが実装済み
- ✅ E2E テストで検証可能

---

### ⬜ 実装済み（基本機能は動作する）

#### 4. Booking（予約）システム

**実装済み**:
- ✅ DB Schema 定義
  - QR コード入場管理
  - ステータス管理（`confirmed`, `cancelled`, `attended`, `no_show`）
- ✅ Activity 関数（`backend/src/activities/db/models/booking.ts`）
- ✅ Workflow（`backend/src/workflows/booking.ts`）
  - `createBookingWorkflow`
  - `checkInWithQRCodeWorkflow`（QR コード入場）
  - `cancelBookingWorkflow`
- ✅ Actions（`backend/src/actions/booking.ts`）
- ✅ tRPC Router（`backend/src/trpc/booking.ts`）

**検証が必要**:
- ⚠️ QR コード生成ロジックが正しく動作するか
- ⚠️ 入場フローが完全に動作するか

---

#### 5. EndUser（エンドユーザー）管理

**実装済み**:
- ✅ DB Schema 定義（Auth0 User ID を主キー）
- ✅ Activity 関数（`backend/src/activities/db/models/user.ts`）
- ✅ Auth0 API 連携（`backend/src/activities/auth/auth0/user.ts`）
- ✅ Workflow（`backend/src/workflows/endUser.ts`）
  - `createEndUserWorkflow`
  - `updateEndUserWorkflow`
  - `deleteEndUserWorkflow`
- ✅ Actions（`backend/src/actions/endUser.ts`）
- ✅ tRPC Router（`backend/src/trpc/endUser.ts`）

**検証が必要**:
- ⚠️ Auth0 との連携が正しく動作するか（E2E で Auth0 API を呼び出す必要がある）

---

#### 6. Payment（決済）システム

**実装済み**:
- ✅ DB Schema 定義
  - 決済方法（`onsite`, `online`）
  - ステータス管理（`pending`, `completed`, `failed`, `refunded`）
- ✅ Activity 関数（`backend/src/activities/db/models/payment.ts`）

**未実装**:
- ❌ Payment Workflow（`backend/src/workflows/payment.ts`）が存在しない
- ❌ Payment Actions（`backend/src/actions/payment.ts`）が存在しない
- ❌ Payment tRPC Router（`backend/src/trpc/payment.ts`）が存在しない

---

## 優先度付き実装タスク

### 🔴 最優先（Phase 1 の完了に必須）

1. ~~**Experience Workflow の実装**~~ ✅ **完了**
   - ファイル: `backend/src/workflows/experience.ts`
   - 実装内容:
     - ✅ `createExperienceWorkflow`
     - ✅ `updateExperienceWorkflow`
     - ✅ `publishExperienceWorkflow`
     - ✅ `endExperienceWorkflow`
     - ✅ `archiveExperienceWorkflow`
     - ✅ `deleteExperienceWorkflow`

2. ~~**Experience Asset Workflow の実装**~~ ✅ **完了**
   - ファイル: `backend/src/workflows/experienceAsset.ts`
   - 実装内容:
     - ✅ `createExperienceAssetWorkflow`
     - ✅ `updateExperienceAssetWorkflow`
     - ✅ `deleteExperienceAssetWorkflow`

3. **E2E テスト環境のセットアップ**
   - ✅ 依存パッケージのインストール（`@trpc/client`）
   - ✅ テストシナリオ1の完成（Organization & Brand & Experience & ExperienceAsset）
   - ⬜ クリーンアップスクリプトの作成（シナリオ1に含まれる）
   - ⬜ E2E テストの実行と検証

---

### 🟡 中優先（E2E テストで検証が必要）

3. **Booking フローの検証**
   - QR コード生成・読み取り
   - 入場処理（`checkInWithQRCodeWorkflow`）
   - キャンセル処理（`cancelBookingWorkflow`）

4. **EndUser フローの検証**
   - Auth0 API 連携の動作確認
   - ユーザー作成・更新・削除

---

### 🟢 低優先（Phase 2 以降）

5. **Payment システムの完全実装**
   - Workflow の作成
   - Actions の作成
   - tRPC Router の作成
   - 決済プロバイダー統合

---

## 実装の進め方

### ~~Step 1: Experience Workflow の実装（最優先）~~ ✅ 完了

**実装済み**:
```typescript
// backend/src/workflows/experience.ts
✅ createExperienceWorkflow - Brand存在確認 + Experience作成
✅ updateExperienceWorkflow - Experience更新
✅ publishExperienceWorkflow - ステータスを'published'に変更
✅ endExperienceWorkflow - ステータスを'ended'に変更
✅ archiveExperienceWorkflow - ステータスを'archived'に変更
✅ deleteExperienceWorkflow - CASCADE削除
```

---

### ~~Step 2: Experience Asset Workflow の実装（次）~~ ✅ 完了

**実装済み**:
```typescript
// backend/src/workflows/experienceAsset.ts
✅ createExperienceAssetWorkflow - Experience存在確認 + ExperienceAsset作成
✅ updateExperienceAssetWorkflow - ExperienceAsset更新
✅ deleteExperienceAssetWorkflow - ExperienceAsset削除

// backend/src/workflows/experienceAsset.workflow.test.ts
✅ Temporal TestWorkflowEnvironment によるテスト実装
```

---

### Step 3: E2E テストシナリオの実装

**シナリオ 1**: Organization & Brand & Experience & ExperienceAsset のライフサイクル（✅ 完了）
**シナリオ 2**: Booking フロー（予約 → QR コード生成 → 入場）（⬜ 未実装）
**シナリオ 3**: EndUser 管理（Auth0 連携）（⬜ 未実装）

---

### Step 4: E2E テストの実行とデバッグ

```bash
# Docker 環境起動
npm run docker:up

# DB マイグレーション
npm run db:migrate

# Worker 起動
npm run worker

# tRPC Server 起動
npm run dev

# E2E テスト実行
npm run e2e:scenario1
```

---

## 次のアクション

1. ✅ この実装状況を確認
2. ✅ Experience Workflow を実装
3. ✅ tRPC experience.ts を修正（Workflow使用）
4. ✅ E2E依存パッケージをインストール（@trpc/client）
5. ✅ Experience Asset Workflow を実装
6. ✅ E2E テストシナリオ1を完成させる
7. ⬜ **E2E テストを実行して検証（次のステップ）**
   - Docker環境の起動
   - DBマイグレーション
   - Workerの起動
   - tRPCサーバーの起動
   - シナリオ1の実行
8. ⬜ 不足している機能を追加実装（必要に応じて）

---

## 参考資料

- [ビジネス要件指示書](../.github/instructions/business-requirements.instructions.md)
- [Backend Layers Instructions](../.github/instructions/backend-layers.instructions.md)
- [Workflows Instructions](../.github/instructions/workflows.instructions.md)
