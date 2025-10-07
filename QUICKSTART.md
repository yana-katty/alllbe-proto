# Alllbe 開発環境セットアップガイド

このガイドでは、Alllbeの開発環境を最速でセットアップする手順を説明します。

## 前提条件

- Node.js 22以上
- Docker & Docker Compose
- npm または yarn

## セットアップ手順

### 1. Backend環境変数の設定

```bash
# backend/.envを作成
cp backend/.env.example backend/.env
```

`backend/.env`に以下の値を設定:
- `DATABASE_URL`: Neon DatabaseのPostgreSQL接続文字列
- `TEMPORAL_ADDRESS`: Temporal Cloudアドレス
- `TEMPORAL_NAMESPACE`: Temporal Cloudネームスペース
- `TEMPORAL_API_KEY`: Temporal Cloud APIキー
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`: Auth0設定
- `WORKOS_API_KEY`: WorkOS APIキー

### 2. Backendサービスの起動

```bash
# プロジェクトルートで実行

# Docker Composeでビルド&起動
docker compose build
docker compose up -d

# ログ確認
docker compose logs -f
```

起動確認:
- tRPC Server: http://localhost:4000/health
- tRPC Endpoint: http://localhost:4000/trpc

### 3. データベースマイグレーション

```bash
cd backend

# マイグレーション実行（初回のみ）
npm run db:migrate
```

### 4. テストデータの投入

```bash
cd backend

# テストデータ投入
npm run db:seed
```

投入されるデータ:
- Organizations: 3件（WorkOS Organization ID使用）
- Brands: 3件（Organization作成時に自動作成）
- Experiences: 6件（画像URL付き）

### 5. Frontend環境変数の設定

```bash
cd frontend

# .env.localを作成
cp .env.local.example .env.local
```

`frontend/.env.local`に以下を設定:
```bash
NEXT_PUBLIC_TRPC_URL=http://localhost:4000/trpc
NEXT_PUBLIC_MOCK_USER_ID=auth0|mock-user-001
```

### 6. Frontendの起動

```bash
cd frontend

# 依存パッケージインストール（初回のみ）
npm install

# 開発サーバー起動
npm run dev
```

Frontend起動確認: http://localhost:3000

## 開発フロー

### Backend

**Docker Composeを使用（推奨）**:

```bash
# サービス起動
docker compose up -d

# ログ確認
docker compose logs -f trpc    # tRPC Server
docker compose logs -f worker  # Temporal Worker

# サービス停止
docker compose down

# 再ビルド（コード変更時）
docker compose build
docker compose up -d
```

**ローカル開発（npm run）**:

```bash
cd backend

# ターミナル1: tRPC Server
npm run dev:server

# ターミナル2: Temporal Worker
npm run dev:worker
```

### Frontend

```bash
cd frontend

# 開発サーバー起動
npm run dev
```

### データベース

```bash
cd backend

# マイグレーションファイル生成
npm run db:generate

# マイグレーション実行
npm run db:migrate

# Drizzle Studio起動（DB GUI）
npm run db:studio

# テストデータ再投入
npm run db:seed
```

## トラブルシューティング

### Backend起動エラー

**症状**: `docker compose up -d`でエラーが発生

**確認事項**:
1. `backend/.env`が存在し、必要な環境変数が設定されているか
2. Docker Desktopが起動しているか

### データ投入エラー

**症状**: `npm run db:seed`で`Default Brand ID: undefined`と表示される

**解決策**:
1. Temporal Workerが起動しているか確認: `docker compose logs worker`
2. tRPC Serverが起動しているか確認: `docker compose logs trpc`
3. `docker compose restart`でサービスを再起動

### Frontend接続エラー

**症状**: FrontendからBackendに接続できない

**確認事項**:
1. `frontend/.env.local`に`NEXT_PUBLIC_TRPC_URL=http://localhost:4000/trpc`が設定されているか
2. tRPC Serverが起動しているか: `curl http://localhost:4000/health`

## 便利なコマンド

```bash
# すべてのログをリアルタイム表示
docker compose logs -f

# 特定のサービスのみ再起動
docker compose restart trpc
docker compose restart worker

# コンテナ内でコマンド実行
docker compose exec trpc sh
docker compose exec worker sh

# すべてのコンテナとネットワークを削除
docker compose down --volumes --remove-orphans
```

## 次のステップ

1. **Phase 2: Backend API統合**
   - Frontend各ページでtRPC APIを呼び出し
   - モックデータを実データに置き換え

2. **Phase 3: 認証実装**
   - Auth0エンドユーザー認証
   - ログイン/ログアウト機能

3. **Phase 4: 予約フロー完成**
   - 予約作成API統合
   - 決済処理実装

詳細は `.github/instructions/frontend.instructions.md` を参照してください。
