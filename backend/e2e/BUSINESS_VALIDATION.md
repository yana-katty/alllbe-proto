# E2E ビジネス要件検証ガイド

このドキュメントでは、Alllbe プラットフォームのビジネス要件を満たすかどうかを検証するための E2E テスト手順を説明します。

## 検証対象のビジネス要件

### Phase 1: Foundation（基盤構築）- 実装済み機能

以下の機能が正しく動作するかを検証します：

#### 1. Organization & Brand 管理（Enterprise Ready）
- ✅ WorkOS Organization の作成・管理
- ✅ Organization 配下の Brand 管理
  - Standard プラン: デフォルト Brand 1つ自動作成
  - Enterprise プラン: 最大100 Brands 作成可能
- ✅ Multi-tenant データ分離
- ✅ Brand 削除時の連動削除（CASCADE）

#### 2. Experience 管理
- ✅ Experience の作成・編集・公開
- ✅ Brand への紐づけ
- ✅ 日時指定型・期間指定型の Experience
- ✅ ステータス管理（draft → published → ended → archived）
- ✅ Experience 削除（CASCADE）

#### 3. ユーザー管理・認証システム
- ⬜ Auth0 ユーザー管理（未実装）
- ⬜ Experience 予約管理（未実装）

#### 4. 予約・決済システム
- ⬜ 予約機能（未実装）
- ⬜ QR コード入場（未実装）

## 検証シナリオ

### シナリオ 1: Organization & Brand のライフサイクル

**目的**: WorkOS Organization と Brand の作成から削除までの一連のフローを検証

**前提条件**:
- WorkOS Organization がまだ存在しない（テスト用 ID）
- Database が空の状態

**検証ステップ**:

1. **Organization 作成（WorkOS + DB）**
   - WorkOS に Organization を作成
   - DB に Organization レコードを作成
   - デフォルト Brand が自動作成されることを確認

2. **Brand 管理**
   - Brand 一覧取得
   - 追加の Brand 作成（Enterprise の場合）
   - Brand 情報の更新
   - Brand の詳細取得

3. **Experience 作成（Brand 配下）**
   - Brand に紐づく Experience を作成
   - Experience 情報の取得・更新

4. **データクリーンアップ**
   - Experience 削除
   - Brand 削除（CASCADE により関連データも削除）
   - Organization 削除（DB）
   - WorkOS Organization 削除

**期待結果**:
- すべての操作が成功
- Brand 削除時に関連する Experience も削除される
- Organization 削除時にすべての関連データが削除される
- WorkOS と DB のデータ整合性が保たれる

---

### シナリオ 2: Multi-tenant データ分離の検証

**目的**: 複数の Organization 間でデータが正しく分離されることを検証

**前提条件**:
- 2つ以上の Organization が存在する

**検証ステップ**:

1. **Organization A のデータ作成**
   - Organization A を作成
   - Brand A を作成
   - Experience A を作成

2. **Organization B のデータ作成**
   - Organization B を作成
   - Brand B を作成
   - Experience B を作成

3. **データ分離の検証**
   - Organization A の Brand 一覧に Brand B が含まれないことを確認
   - Organization B の Experience 一覧に Experience A が含まれないことを確認

4. **クリーンアップ**
   - Organization A のデータを削除
   - Organization B のデータを削除

**期待結果**:
- 各 Organization のデータが完全に分離されている
- 他の Organization のデータにアクセスできない

---

### シナリオ 3: Standard vs Enterprise プラン制限の検証

**目的**: プランごとの Brand 数制限が正しく機能することを検証

**前提条件**:
- Standard プランと Enterprise プランの Organization が存在する

**検証ステップ**:

1. **Standard プラン（1 Brand 固定）**
   - Standard Organization を作成
   - デフォルト Brand が1つ作成されることを確認
   - 2つ目の Brand 作成を試みる
   - エラーが返されることを確認

2. **Enterprise プラン（最大100 Brands）**
   - Enterprise Organization を作成
   - 複数の Brand を作成（例: 5つ）
   - すべての Brand が正常に作成されることを確認

3. **クリーンアップ**
   - すべての Organization を削除

**期待結果**:
- Standard プランでは1つの Brand のみ作成可能
- Enterprise プランでは複数の Brand を作成可能
- プラン制限が正しく機能している

---

### シナリオ 4: Experience のライフサイクル（Brand 配下）

**目的**: Experience の作成から公開、終了、削除までのフローを検証

**前提条件**:
- Organization と Brand が存在する

**検証ステップ**:

1. **Experience 作成（下書き状態）**
   - 日時指定型 Experience を作成
   - 期間指定型 Experience を作成
   - status: 'draft' で作成されることを確認

2. **Experience 公開**
   - Experience を公開（status: 'published'）
   - 公開日時が記録されることを確認

3. **Experience 更新**
   - タイトル・説明文を更新
   - updatedAt が更新されることを確認

4. **Experience 終了・アーカイブ**
   - Experience を終了（status: 'ended'）
   - Experience をアーカイブ（status: 'archived'）

5. **クリーンアップ**
   - Experience を削除

**期待結果**:
- Experience のステータス遷移が正しく動作
- Brand との関連が正しく保たれる
- ライフサイクル管理が適切に機能

---

## 検証の実行方法

### 事前準備

1. **環境変数の設定**
   ```bash
   # backend/.env.local を作成
   cp backend/.env.example backend/.env.local
   
   # 以下の変数を設定
   # WorkOS
   WORKOS_API_KEY=sk_test_xxxxx
   WORKOS_CLIENT_ID=client_xxxxx
   
   # Auth0
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_CLIENT_ID=xxxxx
   AUTH0_CLIENT_SECRET=xxxxx
   
   # Database
   DATABASE_URL=postgres://postgres:postgres@localhost:4444/alllbe_dev
   
   # Temporal
   TEMPORAL_ADDRESS=localhost:7233
   ```

2. **Docker 環境の起動**
   ```bash
   cd backend
   npm run docker:up
   
   # コンテナの状態確認
   docker ps
   ```

3. **Database マイグレーション**
   ```bash
   npm run db:migrate
   ```

4. **Temporal Worker の起動**
   ```bash
   # ターミナル 1
   npm run worker
   ```

5. **tRPC Server の起動**
   ```bash
   # ターミナル 2
   npm run dev
   ```

---

### 検証の実行

各シナリオの検証スクリプトを実行します：

```bash
# シナリオ 1: Organization & Brand のライフサイクル
npm run e2e:scenario1

# シナリオ 2: Multi-tenant データ分離
npm run e2e:scenario2

# シナリオ 3: プラン制限の検証
npm run e2e:scenario3

# シナリオ 4: Experience のライフサイクル
npm run e2e:scenario4

# すべてのシナリオを実行
npm run e2e:all
```

---

### 検証後のクリーンアップ

**重要**: Auth0 と WorkOS にゴミデータが残らないように、必ずクリーンアップを実行してください。

#### 自動クリーンアップ（推奨）

各検証スクリプトは自動的にクリーンアップを実行しますが、手動で実行することもできます：

```bash
# すべてのテストデータをクリーンアップ
npm run e2e:cleanup
```

#### 手動クリーンアップ（緊急時）

自動クリーンアップが失敗した場合の手順：

1. **WorkOS Organization の削除**
   ```bash
   # WorkOS Dashboard: https://dashboard.workos.com/
   # Organizations → テスト用 Organization を選択 → Delete
   ```

2. **Auth0 User の削除**
   ```bash
   # Auth0 Dashboard: https://manage.auth0.com/
   # User Management → Users → テストユーザーを選択 → Delete
   ```

3. **Database のクリーンアップ**
   ```bash
   # Docker 環境の停止と削除（データも削除）
   npm run docker:down
   
   # 再起動（クリーンな状態）
   npm run docker:up
   npm run db:migrate
   ```

---

## トラブルシューティング

### WorkOS Organization が削除できない

**原因**: Organization にまだメンバーや関連データが存在する

**解決策**:
1. WorkOS Dashboard で Organization の詳細を確認
2. すべてのメンバーを削除
3. Organization を削除

---

### Auth0 User が削除できない

**原因**: User に関連するアプリケーションやロールが存在する

**解決策**:
1. Auth0 Dashboard で User の詳細を確認
2. すべてのロールとパーミッションを削除
3. User を削除

---

### Database が初期化されない

**原因**: Docker ボリュームが残っている

**解決策**:
```bash
# すべてのコンテナとボリュームを削除
docker compose -f backend/e2e/docker-compose.yml down -v

# 再起動
npm run docker:up
npm run db:migrate
```

---

## 検証結果の記録

検証実行後、以下の情報を記録してください：

### 検証日時
- 実行日: YYYY-MM-DD
- 実行者: [名前]

### 検証結果
- [ ] シナリオ 1: Organization & Brand のライフサイクル
  - 結果: ✅ 成功 / ❌ 失敗
  - 備考: 

- [ ] シナリオ 2: Multi-tenant データ分離
  - 結果: ✅ 成功 / ❌ 失敗
  - 備考: 

- [ ] シナリオ 3: プラン制限の検証
  - 結果: ✅ 成功 / ❌ 失敗
  - 備考: 

- [ ] シナリオ 4: Experience のライフサイクル
  - 結果: ✅ 成功 / ❌ 失敗
  - 備考: 

### 発見された問題
- 問題 1: [説明]
  - 影響度: High / Medium / Low
  - 対応方法: 

### クリーンアップ状況
- [ ] WorkOS Organization が削除されている
- [ ] Auth0 User が削除されている
- [ ] Database が初期化されている

---

## 参考資料

- [ビジネス要件指示書](../../.github/instructions/business-requirements.instructions.md)
- [プロジェクト計画指示書](../../.github/instructions/plan.instructions.md)
- [Backend Layers Instructions](../../.github/instructions/backend-layers.instructions.md)
- [WorkOS Documentation](https://workos.com/docs)
- [Auth0 Documentation](https://auth0.com/docs)
- [Temporal Documentation](https://docs.temporal.io/)
