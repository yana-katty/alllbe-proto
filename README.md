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
- vitest (テスト)
- ApplicationFailure (エラーハンドリング)

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- tRPC Client

### Shared
- TypeScript (型定義のみ)

## 開発

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
