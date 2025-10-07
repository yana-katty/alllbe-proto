# Alllbe - 体験イベント予約管理システム

モノレポ構成の体験イベント予約管理システム

## プロジェクト構成

このプロジェクトは3つの主要なディレクトリで構成されるモノレポです：

```
alllbe-proto/
├── backend/         # バックエンドサービス
├── frontend/        # フロントエンド（Next.js）
└── shared/          # 型定義の共有
```

### Backend

- **tRPC**: 単純なCRUD処理用のHTTPサーバー
- **Temporal**: 非同期処理・ワークフロー管理
- **共有コード**: `backend/src/shared/` でビジネスロジックとDB操作を共有

詳細は [backend/README.md](./backend/README.md) を参照

### Frontend

- **Next.js 14**: App Router使用
- **tRPC**: backendのCRUD処理を呼び出し
- **Temporal**: backendの非同期処理を呼び出し

詳細は [frontend/README.md](./frontend/README.md) を参照

### Shared

- **型定義の共有**: backendとfrontend間でTypeScript型を共有
- **package.json不要**: tsconfig.jsonのみで型共有を実現

詳細は [shared/README.md](./shared/README.md) を参照

## 技術スタック

### Backend
- TypeScript
- Hono (Webフレームワーク)
- tRPC + @hono/trpc-server
- Temporal (ワークフローエンジン)
- Drizzle ORM
- Neon Database (PostgreSQL)
- neverthrow (Result型)
- vitest (テスト)

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- tRPC Client

### Shared
- TypeScript (型定義のみ)

## 開発環境のセットアップ

### 必要な環境変数

Backend用の環境変数を設定します:

```bash
# backend/.env を作成
cp backend/.env.example backend/.env

# 必要な値を設定:
# - DATABASE_URL (Neon Database)
# - TEMPORAL_ADDRESS (Temporal Cloud)
# - TEMPORAL_NAMESPACE
# - TEMPORAL_API_KEY
# - AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
# - WORKOS_API_KEY
```

### Docker Composeでの起動（推奨）

**Backend (tRPC Server + Temporal Worker) を Docker Compose で起動**:

```bash
# 初回またはDockerfileを変更した場合
docker compose build

# サービスを起動（デタッチモード）
docker compose up -d

# ログを確認
docker compose logs -f

# サービスを停止
docker compose down
```

起動されるサービス:
- **trpc**: tRPC Server (http://localhost:4000)
- **worker**: Temporal Worker

### ローカル開発（npm run）

Docker Composeを使わずに個別に起動する場合:

```bash
cd backend

# tRPC Server（別ターミナル）
npm run dev:server

# Temporal Worker（別ターミナル）
npm run dev:worker
```

### データベースマイグレーション

```bash
cd backend

# マイグレーションファイル生成
npm run db:generate

# マイグレーション実行
npm run db:migrate

# Drizzle Studio起動（DB GUI）
npm run db:studio
```

### テストデータ投入

```bash
cd backend

# tRPC APIを使用してテストデータを投入
npm run db:seed
```

実行前に以下が起動していることを確認:
- tRPC Server (docker compose up -d または npm run dev:server)
- Temporal Worker (docker compose up -d または npm run dev:worker)

### Frontend開発

```bash
cd frontend

# 環境変数設定
cp .env.local.example .env.local

# .env.localに以下を設定:
# NEXT_PUBLIC_TRPC_URL=http://localhost:4000/trpc
# NEXT_PUBLIC_MOCK_USER_ID=auth0|mock-user-001

# 開発サーバー起動
npm run dev
```

Frontendは http://localhost:3000 で起動します。

## 開発（旧）

### Backend

```bash
cd backend

# tRPCサーバーの起動
npm run dev:trpc

# Temporalワーカーの起動
npm run dev:temporal

# テスト実行
npm test
```

### Frontend

```bash
cd frontend

# 開発サーバーの起動
npm run dev
```

## アーキテクチャ

### API呼び出しパターン

```
Frontend → Backend
  ├─ CRUD処理 → tRPC
  └─ 非同期処理 → Temporal
```

### Backend内部構造

```
backend/src/
├── trpc/           # tRPCエントリーポイント
├── temporal/       # Temporalエントリーポイント
└── shared/         # 共有コード（ビジネスロジック、DB操作）
    ├── domain/
    ├── db/
    └── trpc/
```

### 型の共有

```
shared/types/ → backend & frontend
  └── tsconfig paths (@shared/*) で参照
```

## 開発ガイドライン

詳細なガイドラインは以下を参照：

- [全体ガイドライン](./.github/instructions/copilot-instructions.md)
- [Backend ガイドライン](./.github/instructions/backend.md)
- [Frontend ガイドライン](./.github/instructions/frontend.md)
- [Shared ガイドライン](./.github/instructions/shared.md)

## ライセンス

Private
