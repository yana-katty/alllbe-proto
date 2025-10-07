# Backend

体験イベント予約管理システムのバックエンド

## アーキテクチャ

```
Client (Frontend) 
    ↓ tRPC
Backend (tRPC Handlers)
    ↓ Temporal Client
Temporal Workflows
    ↓ proxyActivities
Temporal Activities
    ↓ Database/External APIs
```

**詳細な設計方針**: `.github/instructions/architecture.instructions.md` を参照

## ディレクトリ構造

```
backend/
├── src/
│   ├── activities/    # Temporal Activities（DB操作・外部API）
│   │   ├── db/
│   │   │   ├── connection.ts  # Neon DB接続設定
│   │   │   ├── migrate.ts     # マイグレーション実行
│   │   │   ├── schema.ts      # Drizzleスキーマ定義
│   │   │   └── models/        # データモデル（organization, brand, etc.）
│   │   └── auth/              # 認証関連Activity（Auth0, WorkOS）
│   ├── workflows/     # Temporal Workflows（ビジネスロジック協調）
│   │   ├── index.ts
│   │   └── *.ts               # Organization, Brand, etc.
│   ├── actions/       # Read操作の通常関数（tRPCから直接呼び出し可能）
│   │   └── *.ts
│   ├── trpc/          # tRPC API handlers
│   │   ├── base.ts
│   │   ├── index.ts
│   │   └── *.ts               # Organization, Brand, etc.
│   ├── shared/        # 共通ユーティリティ
│   │   └── logger/    # ロガー
│   ├── server.ts      # tRPCサーバーエントリーポイント
│   └── worker.ts      # Temporalワーカーエントリーポイント
├── e2e/               # E2Eテスト環境
│   ├── README.md      # E2Eテストガイド
│   ├── docker-compose.yml  # テスト環境（PostgreSQL, Temporal）
│   └── test-data.sql  # テストデータ
├── drizzle/           # マイグレーションファイル
├── drizzle.config.ts  # Drizzle Kit設定
├── package.json
└── tsconfig.json
```

## 主要な設計原則

1. **Activity層**: Neverthrow使用、Errorをthrowしない
2. **Workflow層**: Errorをthrow可能（Temporal標準）
3. **tRPC層**: Read操作は通常関数、CUD操作はWorkflow Client経由
4. **重複制御**: Workflow Id Reuse Policy: Duplicate で client側管理

**詳細**: `.github/instructions/` 配下の各instructionsファイルを参照

## 開発

```bash
# 依存関係のインストール
npm install

# DBマイグレーション
npm run db:migrate

# tRPCサーバーの起動
npm run dev:trpc

# Temporalワーカーの起動
npm run dev:temporal
```

## 参考資料

- [Temporal TypeScript Samples](https://github.com/temporalio/samples-typescript/tree/main)
- [SAGA Pattern Example](https://github.com/temporalio/samples-typescript/tree/main/saga)
- [Neverthrow Documentation](https://github.com/supermacro/neverthrow)
