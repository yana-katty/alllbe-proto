---
applyTo: "frontend/**"
---

# Frontend 開発ガイドライン

## アーキテクチャ

### Next.js 14 (App Router)
- **フレームワーク**: Next.js 14 with App Router
- **API通信**:
  - **CRUD処理**: tRPC経由でbackendと通信
  - **非同期処理**: Temporal経由でbackendの長時間実行タスクを呼び出し

### ディレクトリ構造
```
frontend/
├── app/              # Next.js App Router
│   ├── layout.tsx    # ルートレイアウト
│   ├── page.tsx      # トップページ
│   └── globals.css   # グローバルスタイル
└── src/
    └── lib/          # ユーティリティ・設定
        └── trpc.ts   # tRPCクライアント設定
```

## 技術スタック

- **Next.js 14**: React フレームワーク (App Router)
- **React 18**: UI ライブラリ
- **TypeScript**: 型安全性
- **tRPC**: 型安全なAPI通信 (backendのCRUD処理)
- **Temporal Client**: 非同期処理の呼び出し

## API通信パターン

### 1. CRUD処理 (tRPC)
```typescript
// src/lib/trpc.ts でクライアント設定
import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '@shared/types/trpc';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

// コンポーネントから使用
const organizations = await trpc.organization.list.query();
```

### 2. 非同期処理 (Temporal)
```typescript
// Temporalワークフローの開始
const workflowHandle = await temporalClient.workflow.start(MyWorkflow, {
  args: [data],
  taskQueue: 'main',
});

// ステータス確認
const status = await workflowHandle.describe();
```

## コーディング規約

### コンポーネント設計
- **Server Components 優先**: デフォルトでServer Components
- **Client Components**: 必要な場合のみ `'use client'` ディレクティブ
- **型安全性**: propsは必ず型定義

```typescript
// Server Component
export default async function OrganizationList() {
  const orgs = await trpc.organization.list.query();
  return <ul>{orgs.map(org => <li key={org.id}>{org.name}</li>)}</ul>;
}

// Client Component
'use client';
export function OrganizationForm() {
  // イベントハンドラやhooksを使用
}
```

### エラーハンドリング
```typescript
// エラーバウンダリを活用
// app/error.tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### スタイリング
- **CSS Modules** または **Tailwind CSS** を推奨
- **グローバルスタイル**: `app/globals.css`
- **コンポーネントスタイル**: CSS Modules または styled-components

## パス設定

### tsconfig.json
```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@shared/*": ["../shared/*"]
  }
}
```

- `@/*`: frontend内部のパス
- `@shared/*`: ルートの `shared/` ディレクトリ（型定義）

## 禁止事項

- ❌ `any` 型の使用
- ❌ 不必要な `'use client'` ディレクティブ
- ❌ 直接的なDB接続（必ずbackend経由）
- ❌ 環境変数のクライアント露出（`NEXT_PUBLIC_` 接頭辞に注意）

## パフォーマンス最適化

### 画像最適化
```tsx
import Image from 'next/image';

<Image src="/photo.jpg" alt="Photo" width={500} height={300} />
```

### 動的インポート
```typescript
import dynamic from 'next/dynamic';

const DynamicComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <p>Loading...</p>,
});
```

## 自動更新要件

### このファイルを更新すべきタイミング
- frontend のディレクトリ構造が変更された時
- 新しい技術スタックが追加された時
- API通信パターンが変更された時
- コーディング規約が変更された時

**更新は変更完了後すぐに実行すること。**
