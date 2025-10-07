# E2E Testing Guide - Alllbe Backend

このドキュメントでは、backendのE2Eテスト環境の構築と実行方法を説明します。

## 実装状況（2025年10月7日更新）

### ✅ 完全実装済み
- **Organization & Brand 管理**: WorkOS連携、CRUD操作、CASCADE削除
- **Experience 管理**: CRUD操作、ステータス管理（draft/published/ended/archived）、Workflow完全実装
- **Experience Assets**: CRUD操作、Workflow実装済み、アクセス権限管理
- **Booking システム**: 予約作成、QRコード入場、キャンセル
- **EndUser 管理**: Auth0連携、ユーザーCRUD

### 🚧 部分実装
- **Payment**: Activity実装済み、Workflow/Actions/tRPC未実装

### ✅ E2Eテスト
- **依存パッケージ**: ✅ @trpc/client インストール済み
- **シナリオ1**: ✅ 完成（Organization & Brand & Experience & ExperienceAsset ライフサイクル）
- **シナリオ2-4**: 未実装
- **クリーンアップスクリプト**: ✅ シナリオ1に実装済み

詳細は [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) を参照してください。

## アーキテクチャ

```
curl (手動テスト)
    ↓ HTTP POST
tRPC Server (localhost:4000)
    ↓ Temporal Client
Temporal Server (localhost:7233)
    ↓ gRPC
Temporal Worker (Node.js)
    ↓ Activity実行
PostgreSQL (localhost:5432)
```

## 前提条件

- Docker & Docker Compose がインストールされていること
- Node.js 18+ がインストールされていること
- `backend/` ディレクトリで `npm install` 済みであること

## セットアップ手順

### 1. Docker環境の起動

PostgreSQL と Temporal Server を起動します。

```bash
cd backend
npm run docker:up
```

**起動内容:**
- PostgreSQL (port 5432) - データは永続化されません（クリーンな状態で毎回起動）
- Neon Proxy (port 4444) - ローカルPostgreSQLをNeon互換にする
- Temporal Server (port 7233: gRPC, 8233: HTTP API)
- Temporal UI (port 8080: WebUI - オプション)

**データ永続化について:**
E2Eテスト環境では、PostgreSQLのデータは永続化されません。これにより：
- ✅ 毎回クリーンな状態でテスト可能
- ✅ テスト実行前の初期化が不要
- ✅ 環境の再現性が高い

**確認:**
```bash
# Dockerコンテナの状態確認
docker ps

# ログ確認
npm run docker:logs

# Temporal UI でワークフロー確認
open http://localhost:8080
```

### 2. データベースマイグレーション

PostgreSQLにテーブルを作成します。

```bash
npm run db:migrate
```

**作成されるテーブル:**
- `organizations` - 組織管理
- `brands` - ブランド管理
- `users` - エンドユーザー管理
- `experiences` - 体験イベント管理
- `bookings` - 予約管理
- `payments` - 決済管理
- `experience_assets` - 関連コンテンツ管理

### 3. テストデータの準備

E2Eテスト用のダミーデータをPostgreSQLに挿入します。

```bash
# PostgreSQLに接続
docker exec -it alllbe-postgres psql -U postgres -d alllbe_dev

# テストOrganizationを作成
INSERT INTO organizations (id, is_active)
VALUES ('test_org_001', TRUE);

# 確認
SELECT * FROM organizations;

# 終了
\q
```

または、SQLファイルを実行:

```bash
# backend/e2e/test-data.sql を使用
docker exec -i alllbe-postgres psql -U postgres -d alllbe_dev < e2e/test-data.sql
```

### 4. Temporal Worker の起動

Temporal Serverからタスクを受け取り、Activityを実行するWorkerを起動します。

```bash
npm run dev:worker
```

**ログ出力例:**
```
Temporal Worker started successfully
  Task Queue: main
  Temporal Address: localhost:7233
```

別のターミナルで次のステップに進んでください。

### 5. tRPC Server の起動

HTTP APIサーバーを起動します。

```bash
# 別のターミナルで
npm run dev:server
```

**ログ出力例:**
```
tRPC Server started {
  port: 4000,
  url: 'http://localhost:4000',
  trpcEndpoint: 'http://localhost:4000/trpc',
  healthEndpoint: 'http://localhost:4000/health'
}
```

## E2Eテストの実行

### 基本的なヘルスチェック

#### 1. サーバーのヘルスチェック

```bash
curl http://localhost:4000/health
```

**期待される結果:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-07T12:34:56.789Z",
  "service": "alllbe-trpc-server"
}
```

#### 2. tRPC Ping テスト

```bash
curl -X POST http://localhost:4000/trpc/health.ping \
  -H "Content-Type: application/json"
```

**期待される結果:**
```json
{
  "result": {
    "data": {
      "status": "ok",
      "timestamp": "2025-10-07T12:34:56.789Z",
      "service": "alllbe-backend"
    }
  }
}
```

#### 3. データベース接続チェック

```bash
curl -X POST http://localhost:4000/trpc/health.dbCheck \
  -H "Content-Type: application/json"
```

**期待される結果:**
```json
{
  "result": {
    "data": {
      "status": "ok",
      "message": "Database connection successful",
      "timestamp": "2025-10-07T12:34:56.789Z"
    }
  }
}
```

#### 4. Organizations リスト取得

```bash
curl -X POST http://localhost:4000/trpc/health.listOrganizations \
  -H "Content-Type: application/json"
```

**期待される結果:**
```json
{
  "result": {
    "data": {
      "status": "ok",
      "message": "Organizations fetched successfully",
      "count": 1,
      "organizations": [
        {
          "id": "test_org_001",
          "is_active": true,
          "created_at": "2025-10-07T12:00:00.000Z"
        }
      ],
      "timestamp": "2025-10-07T12:34:56.789Z"
    }
  }
}
```

### Temporal Workflow テスト（完全なE2Eパス）

curl → tRPC → Temporal → Worker → PostgreSQL の全パスをテストします。

```bash
curl -X POST http://localhost:4000/trpc/health.workflowTest \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "test_org_001",
    "brandName": "E2E Test Brand"
  }'
```

**期待される結果:**
```json
{
  "result": {
    "data": {
      "status": "ok",
      "message": "Temporal workflow executed successfully",
      "workflowId": "health-brand-1696684496789",
      "result": {
        "id": "uuid-here",
        "organizationId": "test_org_001",
        "name": "E2E Test Brand",
        "description": "E2E Test Brand",
        "isDefault": false,
        "isActive": true,
        "createdAt": "2025-10-07T12:34:56.789Z",
        "updatedAt": "2025-10-07T12:34:56.789Z"
      },
      "timestamp": "2025-10-07T12:34:56.789Z"
    }
  }
}
```

#### Temporal UI で確認

1. ブラウザで http://localhost:8080 を開く
2. Workflow ID `health-brand-*` を検索
3. Workflowの実行履歴、Activity呼び出し、ログを確認

### 統合E2Eテスト

すべてのコンポーネントの接続状態を確認します。

```bash
curl -X POST http://localhost:4000/trpc/health.e2eTest \
  -H "Content-Type: application/json"
```

**期待される結果:**
```json
{
  "result": {
    "data": {
      "status": "ok",
      "message": "All E2E tests passed",
      "results": {
        "database": {
          "status": "ok",
          "message": "Database connection successful"
        },
        "databaseQuery": {
          "status": "ok",
          "message": "Database query successful",
          "organizationCount": 1
        },
        "temporal": {
          "status": "ok",
          "message": "Temporal connection successful"
        }
      },
      "timestamp": "2025-10-07T12:34:56.789Z"
    }
  }
}
```

## トラブルシューティング

### 1. PostgreSQL に接続できない

**症状:**
```
Database connection failed
```

**対処法:**
```bash
# Dockerコンテナの状態確認
docker ps | grep postgres

# コンテナが起動していない場合
npm run docker:up

# ログ確認
docker logs alllbe-postgres
```

### 2. Temporal Server に接続できない

**症状:**
```
Temporal connection error
```

**対処法:**
```bash
# Temporalコンテナの状態確認
docker ps | grep temporal

# ヘルスチェック
docker exec alllbe-temporal tctl --address temporal:7233 cluster health

# 再起動
npm run docker:down
npm run docker:up
```

### 3. Worker が Activity を実行しない

**症状:**
- Workflowがタイムアウトする
- Temporal UI で Activity が "Scheduled" 状態のまま

**対処法:**
```bash
# Worker のログ確認
# Worker起動時のログで Task Queue 名を確認

# 環境変数の確認
echo $TEMPORAL_TASK_QUEUE

# Worker を再起動
# Ctrl+C で停止してから
npm run dev:worker
```

### 4. Brand が作成されない（BRAND_LIMIT_REACHED）

**症状:**
```json
{
  "error": {
    "message": "Workflow failed (BRAND_LIMIT_REACHED): Brand limit reached"
  }
}
```

**対処法:**
Standard プランではOrganization あたり1つのBrandしか作成できません。既存のBrandを削除してください。

```bash
# PostgreSQLに接続
docker exec -it alllbe-postgres psql -U postgres -d alllbe_dev

# 既存Brandを削除
DELETE FROM brands WHERE organization_id = 'test_org_001';

# 確認
SELECT * FROM brands WHERE organization_id = 'test_org_001';

\q
```

### 5. マイグレーションエラー

**症状:**
```
relation "organizations" does not exist
```

**対処法:**
```bash
# マイグレーションを再実行
npm run db:migrate

# またはDockerを再起動してマイグレーション
npm run docker:down
npm run docker:up
npm run db:migrate
```

## 環境変数

E2Eテストで使用する環境変数:

```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alllbe_dev
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_TASK_QUEUE=main
PORT=4000
NODE_ENV=development
```

## クリーンアップ

### Docker環境の停止

```bash
npm run docker:down
```

### データベースのリセット

```bash
# Dockerボリュームも削除（データ完全削除）
docker-compose down -v

# 再起動
npm run docker:up
npm run db:migrate
# テストデータ再投入
```

## 次のステップ

### 優先度順の実装タスク

1. **Experience Asset Workflow の実装** 🔴 高優先度
   - ファイル: `backend/src/workflows/experienceAsset.ts`
   - 関連コンテンツの作成・更新・削除

2. **E2Eテストシナリオの完成** 🟡 中優先度
   - シナリオ2: Multi-tenant データ分離
   - シナリオ3: プラン制限（Standard vs Enterprise）
   - シナリオ4: Experience ライフサイクル

3. **クリーンアップスクリプト** 🟡 中優先度
   - WorkOS/Auth0 のゴミデータ自動削除
   - テスト失敗時の復旧手順

4. **Payment システム完全実装** 🟢 低優先度
   - Workflow, Actions, tRPC Router の実装

### 関連ドキュメント

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - 詳細な実装状況
- [BUSINESS_VALIDATION.md](./BUSINESS_VALIDATION.md) - ビジネス要件検証ガイド
- [シナリオ1](./scenarios/scenario1-org-brand-lifecycle.ts) - Organization & Brand ライフサイクル

### 自動テストへの移行（将来）

1. **自動テストの実装**: vitest + @trpc/client でE2Eテストを自動化
2. **CI/CD統合**: GitHub Actions で自動テスト実行
3. **パフォーマンステスト**: 大量リクエスト時の動作確認
4. **モニタリング**: Temporal UI + Winston ログでワークフロー監視

## 参考資料

- [Temporal Documentation](https://docs.temporal.io/)
- [tRPC Documentation](https://trpc.io/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
