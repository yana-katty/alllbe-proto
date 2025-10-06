# Backend

体験イベント予約管理システムのバックエンド

## 構成

- **tRPC**: 単純なCRUD処理用のHTTPサーバー
- **Temporal**: 非同期処理・ワークフロー管理

## ディレクトリ構造

```
backend/
├── src/
│   ├── trpc/          # tRPCエントリーポイントとルーター
│   │   ├── index.ts   # tRPCサーバーエントリーポイント
│   │   └── logger.ts  # tRPC用ロガー初期化
│   ├── temporal/      # Temporalワークフロー・アクティビティ
│   │   ├── index.ts   # Temporalワーカーエントリーポイント
│   │   └── logger.ts  # Temporal用ロガー初期化
│   └── shared/        # tRPCとTemporalで共有するコード
│       ├── domain/    # ビジネスロジック
│       ├── db/        # データベース操作
│       │   ├── connection.ts  # Neon DB接続設定
│       │   ├── migrate.ts     # マイグレーション実行
│       │   ├── schema.ts      # Drizzleスキーマ定義
│       │   └── models/        # データモデル
│       └── logger/    # 共通ロガー（依存注入可能）
│           ├── types.ts     # Loggerインターフェース
│           ├── winston.ts   # Winston実装
│           ├── temporal.ts  # Temporalアダプター
│           ├── examples.ts  # 使用例
│           └── README.md    # ロガー使用ガイド
├── drizzle.config.ts  # Drizzle Kit設定
├── package.json
└── tsconfig.json
```

## 開発

```bash
# tRPCサーバーの起動
npm run dev:trpc

# Temporalワーカーの起動
npm run dev:temporal
```

## ロガー

backendでは依存注入可能な共通ロガーインターフェースを提供しています。
tRPC と Temporal の両方で同じコードを使用できます。

### 主な特徴

- **共通インターフェース**: `Logger` 型で統一
- **Winston実装**: tRPC用の実装
- **Temporalアダプター**: `@temporalio/activity`, `@temporalio/workflow` の log を共通インターフェースに変換
- **依存注入**: domain層やdb層の関数にloggerを渡すことで、tRPC/Temporal両方で動作

詳細は [src/shared/logger/README.md](./src/shared/logger/README.md) を参照してください。

### 使用例

```typescript
// 共有コード（domain層）
import type { Logger } from '@/shared/logger';

export const createOrganization = (
  deps: Pick<Deps, 'logger' | 'insertOrganization'>
) => async (input) => {
  deps.logger.info('Creating organization', { email: input.email });
  // ...
};

// tRPC
import { trpcLogger } from '@/trpc/logger';
const result = await createOrganization({ logger: trpcLogger, ... })(input);

// Temporal Activity
import { log } from '@temporalio/activity';
import { createTemporalLogger } from '@/shared/logger';
const logger = createTemporalLogger(log);
const result = await createOrganization({ logger, ... })(input);
```
