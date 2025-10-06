# Shared

backend と frontend で共有される型定義

## 目的

- **tRPCのTypeScriptインターフェース**: backendとfrontendで型の整合性を保つ
- **package.json不要**: tsconfig.jsonのみで型共有を実現
- **モノレポ内での型安全性**: backendとfrontend間の通信を型安全に

## ディレクトリ構造

```
shared/
├── types/           # 型定義
│   └── trpc.ts      # tRPC関連の型定義
├── tsconfig.json    # TypeScript設定
└── README.md
```

## 使用方法

### backend から参照

```typescript
import type { SomeType } from '@shared/types/trpc';
```

### frontend から参照

```typescript
import type { SomeType } from '@shared/types/trpc';
```

tsconfig.json の `paths` 設定により、`@shared/*` でアクセス可能。
