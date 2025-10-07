# Backend Setup Guide

このガイドでは、alllbe-backend を End-to-End で動作させるための手順を説明します。

## 前提条件

- Node.js 20.x 以上
- PostgreSQL 14.x 以上（または Neon）
- Temporal Server（開発環境では temporalite を推奨）

## 1. 環境変数の設定

### 1.1 環境変数ファイルの作成

```bash
# .env ファイルを作成
cp .env.example .env
```

### 1.2 必要な設定値の取得と設定

#### WorkOS の設定

1. https://dashboard.workos.com/ にアクセス
2. 左サイドバーから "API Keys" を選択
3. "Test" タブを開く
4. API Key と Client ID をコピーして `.env` に設定

```bash
WORKOS_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx
```

#### Auth0 の設定

1. https://manage.auth0.com/ にアクセス
2. Applications → Machine to Machine Applications
3. "Auth0 Management API" を選択
4. Domain, Client ID, Client Secret をコピーして `.env` に設定

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_MANAGEMENT_CLIENT_ID=your_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_client_secret
AUTH0_CONNECTION_NAME=Username-Password-Authentication
```

#### Database の設定

```bash
# ローカル PostgreSQL の場合
DATABASE_URL=postgresql://user:password@localhost:5432/alllbe

# Neon の場合
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/alllbe
```

## 2. データベースのセットアップ

### 2.1 マイグレーション実行

```bash
npm run db:migrate
```

### 2.2 データベーススキーマの確認

```bash
npm run db:studio
```

Drizzle Studio が起動し、ブラウザでスキーマを確認できます。

## 3. サービスの起動

### 3.1 Temporal Server の起動（開発環境）

```bash
# 別のターミナルで実行
temporalite start --namespace default
```

または Docker を使用する場合:

```bash
docker run --rm -p 7233:7233 temporalio/temporalite:latest
```

### 3.2 Temporal Worker の起動

```bash
# 別のターミナルで実行
npm run dev:worker
```

以下のようなログが表示されれば成功:

```
Temporal Worker started successfully
  Task Queue: main
  Temporal Address: localhost:7233
  Database: Connected
  Auth0: Configured
  WorkOS: Configured
```

### 3.3 tRPC Server の起動

```bash
# 別のターミナルで実行
npm run dev:server
```

以下のようなログが表示されれば成功:

```
tRPC Server started
  port: 4000
  url: http://localhost:4000
  trpcEndpoint: http://localhost:4000/trpc
  healthEndpoint: http://localhost:4000/health
```

## 4. 動作確認

### 4.1 ヘルスチェック

```bash
curl http://localhost:4000/health
```

以下のようなレスポンスが返れば正常:

```json
{
  "status": "ok",
  "timestamp": "2025-10-07T12:00:00.000Z",
  "service": "alllbe-trpc-server"
}
```

### 4.2 tRPC エンドポイントのテスト

tRPC クライアントまたは以下のコマンドでテスト:

```bash
# Organization 作成のテスト例
curl -X POST http://localhost:4000/trpc/organization.create \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["example.com"],
    "name": "Example Organization",
    "organizationName": "Example Org"
  }'
```

## 5. テストの実行

### 5.1 テスト環境の設定

```bash
# テスト用の環境変数ファイルを作成
cp .env.test.example .env.test
```

`.env.test` にテスト用の設定を記載します。

### 5.2 テストの実行

```bash
# 全テストの実行
npm test

# Auth0 統合テストのみ
npm test -- auth0

# WorkOS 統合テストのみ
npm test -- workos

# Watch モード
npm run test:watch
```

## 6. トラブルシューティング

### Temporal Worker が起動しない

- Temporal Server が起動しているか確認
- `TEMPORAL_ADDRESS` の設定を確認（デフォルト: localhost:7233）

### Database 接続エラー

- PostgreSQL が起動しているか確認
- `DATABASE_URL` の設定を確認
- データベースが作成されているか確認

### Auth0/WorkOS のエラー

- API キーが正しく設定されているか確認
- Test 環境のキーを使用しているか確認（本番環境のキーは使用しない）

## 7. 開発の流れ

### 7.1 Activity の追加

1. `src/activities/` に新しい Activity を追加
2. `src/worker.ts` で Activity を登録
3. テストを作成して動作確認

### 7.2 Workflow の追加

1. `src/workflows/` に新しい Workflow を追加
2. `src/workflows/index.ts` でエクスポート
3. テストを作成して動作確認

### 7.3 tRPC エンドポイントの追加

1. `src/trpc/` に新しいルーターを追加
2. `src/trpc/index.ts` の `appRouter` に統合
3. テストを作成して動作確認

## 参考リンク

- [Temporal Documentation](https://docs.temporal.io/)
- [WorkOS Documentation](https://workos.com/docs)
- [Auth0 Documentation](https://auth0.com/docs)
- [tRPC Documentation](https://trpc.io/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
