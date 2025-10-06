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
backend/src/
├── activities/
│   ├── index.ts              # Activity exports
│   ├── db/
│   │   ├── models/
│   │   │   └── organization.ts  # Organization Activity implementations
│   │   ├── connection.ts     # Neon DB接続設定
│   │   ├── schema.ts         # Drizzleスキーマ定義
│   │   └── migrate.ts        # マイグレーション実行
│   └── auth/                 # Auth Activity implementations
├── workflows/
│   ├── index.ts              # Workflow exports
│   ├── organization.ts       # Organization Workflows (CUD + Read)
│   └── *.ts                  # Other workflows
└── trpc/
    ├── base.ts               # tRPC設定・ミドルウェア
    ├── index.ts              # ルーターの統合
    ├── organization.ts       # Organization tRPC routes
    └── *.ts                  # Other routes
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
