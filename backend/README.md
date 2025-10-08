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

1. **Activity層**: ApplicationFailure を throw（try-catchベース）
2. **Workflow層**: ApplicationFailure を throw（Temporal標準）
3. **tRPC層**: Read操作は通常関数、CUD操作はWorkflow Client経由
4. **重複制御**: Workflow Id Reuse Policy: Duplicate で client側管理
5. **エラーハンドリング**: ErrorType enum + createXXXError() ファクトリ関数パターン

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

## 起動方法（本番用 Docker + .env）

1. backend/.env を編集し、必要な環境変数（DB, Temporal, 認証など）を設定
2. Docker イメージをビルド

```bash
# プロジェクトルートで実行
# イメージビルド（trpc/worker 共通）
docker compose build

# サービス起動（.env の内容が各サービスに適用されます）
docker compose up -d
```

- trpc サーバー: http://localhost:3000
- Temporal Worker: backend/src/worker.ts
- Temporal Server/DB も docker-compose で自動起動

環境変数例（backend/.env）:
```
DATABASE_URL=postgres://alllbe:password@db:5432/alllbe

# Temporal Cloud設定（本番環境）
TEMPORAL_ADDRESS=ap-northeast-1.aws.api.temporal.io:7233
TEMPORAL_NAMESPACE=quickstart-alllbe-proto.f1qvm
TEMPORAL_API_KEY=your_temporal_api_key_here

# または、ローカル開発環境の場合
# TEMPORAL_ADDRESS=temporal:7233
# TEMPORAL_NAMESPACE=default
# （TEMPORAL_API_KEYは不要）

AUTH0_DOMAIN=xxx
WORKOS_API_KEY=xxx
...etc
```

### Temporal Cloud vs ローカル開発

**Temporal Cloud使用時**:
- `TEMPORAL_ADDRESS`: Temporal Cloudのエンドポイント（例: `ap-northeast-1.aws.api.temporal.io:7233`）
- `TEMPORAL_NAMESPACE`: Temporal Cloudで作成したNamespace
- `TEMPORAL_API_KEY`: Temporal Cloudで発行したAPI Key（必須）
- TLS接続が自動的に有効化されます

**ローカル開発時**:
- `TEMPORAL_ADDRESS`: `localhost:7233` または `temporal:7233`（Docker環境）
- `TEMPORAL_NAMESPACE`: `default`
- `TEMPORAL_API_KEY`: 設定不要
- TLS接続は無効（平文通信）

**詳細な設計・運用方針は `.github/instructions/architecture.instructions.md` を参照してください。**

## 参考資料

- [Temporal TypeScript Samples](https://github.com/temporalio/samples-typescript/tree/main)
- [SAGA Pattern Example](https://github.com/temporalio/samples-typescript/tree/main/saga)
- [Temporal ApplicationFailure Documentation](https://typescript.temporal.io/api/classes/common.ApplicationFailure)
