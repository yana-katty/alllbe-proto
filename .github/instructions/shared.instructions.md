---
applyTo: "shared/**"
---

# Shared 型定義ガイドライン

## 目的

backend と frontend で型定義を共有し、型安全な通信を実現する。

## ディレクトリ構造

```
shared/
├── types/           # 型定義
│   └── trpc.ts      # tRPC関連の型定義
├── tsconfig.json    # TypeScript設定
└── README.md
```

## 型定義の追加方法

### tRPC Router型のエクスポート

```typescript
// shared/types/trpc.ts
import type { AppRouter } from '../../backend/src/shared/trpc/router';

// backend の AppRouter 型を re-export
export type { AppRouter };

// 個別の型定義も追加可能
export interface Organization {
  id: string;
  name: string;
  email: string;
}
```

## 使用方法

### Backend から参照
```typescript
import type { Organization } from '@shared/types/trpc';

const org: Organization = {
  id: '1',
  name: 'Test Org',
  email: 'test@example.com',
};
```

### Frontend から参照
```typescript
import type { AppRouter } from '@shared/types/trpc';
import { createTRPCClient } from '@trpc/client';

const trpc = createTRPCClient<AppRouter>({
  // ...
});
```

## TypeScript設定

### tsconfig.json
```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "paths": {
      "@shared/*": ["./*"]
    }
  }
}
```

- **declaration**: 型定義ファイル (`.d.ts`) を生成
- **declarationMap**: 型定義のソースマップを生成
- **paths**: `@shared/*` エイリアス設定

## コーディング規約

### 型定義のみ配置
- ❌ 実装コードは配置しない
- ✅ `type`、`interface`、`enum` のみ
- ✅ 型のre-exportも可

### 命名規則
- **型**: PascalCase `OrganizationData`
- **インターフェース**: PascalCase `IOrganization` または `Organization`
- **列挙型**: PascalCase `ErrorCode`

### ファイル構成
```typescript
// ✅ 良い例: 型のみ
export interface User {
  id: string;
  name: string;
}

export type UserId = string;

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// ❌ 悪い例: 実装コードを含む
export function createUser(data: User): User {
  // 実装コードはbackendまたはfrontendに配置
}
```

## 禁止事項

- ❌ 実装コード（関数の本体）
- ❌ `any` 型の使用
- ❌ 外部依存の追加（型定義のみに集中）
- ❌ `package.json` の作成（tsconfig.json のみ使用）

## 型の依存関係

### Backend → Shared
backend の型を shared で re-export して frontend に公開

```typescript
// backend/src/shared/trpc/router.ts
export const appRouter = t.router({
  // ...
});

export type AppRouter = typeof appRouter;

// shared/types/trpc.ts
export type { AppRouter } from '../../backend/src/shared/trpc/router';
```

### Frontend → Shared
frontend は shared から型をインポート

```typescript
// frontend/src/lib/trpc.ts
import type { AppRouter } from '@shared/types/trpc';
```

## 自動更新要件

### このファイルを更新すべきタイミング
- shared のディレクトリ構造が変更された時
- 新しい型定義パターンが追加された時
- TypeScript設定が変更された時
- 型共有の方法が変更された時

**更新は変更完了後すぐに実行すること。**
