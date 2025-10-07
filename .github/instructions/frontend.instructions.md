---
applyTo: "frontend/**"
---

# Frontend Instructions: Alllbe エンドユーザー向け Experience 予約 Web アプリケーション

## プロジェクト概要

- **目的**: エンドユーザーが Experience を検索・閲覧・予約できる Web アプリケーション
- **デザイン**: ill-be-platform のデザインシステムを踏襲（v0 で作成されたプロトタイプ）
- **技術スタック**: 
  - **フレームワーク**: Next.js 14 (App Router)
  - **言語**: TypeScript
  - **UI コンポーネント**: shadcn/ui
  - **スタイリング**: Tailwind CSS v4
  - **API 通信**: tRPC Client + TanStack Query
  - **フォーム**: React Hook Form + Zod
  - **認証**: 
    - **エンドユーザー**: Auth0 (ソーシャルログイン、メール/パスワード)
    - **Organization 管理者**: WorkOS (SSO、SAML、Enterprise Ready)

## 設計方針

### 1. デザインシステム

#### カラースキーム
- **プライマリ**: 黒/白のモノクロベース
- **アクセント**: 必要に応じてブランドカラー
- **ダークモード**: 初期実装では対応しない（Phase 2 以降）

#### タイポグラフィ
- **フォント**: Geist Sans (本文), Geist Mono (コード・カテゴリ表示)
- **スタイル**: 大胆な見出し、余白を活かしたレイアウト
- **トーン**: 「展示に来る前も来た後も楽しい」をコンセプトとした親しみやすさ

#### レイアウトパターン
- **ヒーローセクション**: 大きな画像 + オーバーレイテキスト
- **カードグリッド**: 3カラムグリッド（レスポンシブ: 1→2→3）
- **スティッキーヘッダー**: 常に表示されるナビゲーション
- **モバイルファースト**: スマートフォンでの体験を優先

### 2. ページ構成

#### エンドユーザー向けページ（実装対象）
```
/                           # トップページ（Featured Experiences）
/discover                   # Experience 一覧・検索
/experiences/[id]           # Experience 詳細ページ
/book/[experienceId]/       # 予約フロー
  ├── datetime              # 日時選択
  ├── participants          # 参加者情報入力
  └── confirm               # 予約確認・完了
/my-experiences             # マイページ（予約履歴・Experience Circle）
/auth/login                 # ログイン（Auth0）
/auth/signup                # サインアップ（Auth0）
```

#### 削除するページ（Organization 管理者向け）
```
/admin/**                   # 管理者ダッシュボード（別アプリで実装予定）
/dashboard/**               # Organization ダッシュボード（別アプリで実装予定）
/organization/**            # Organization 管理（別アプリで実装予定）
/profile                    # ユーザープロフィール（/my-experiences に統合）
```

### 3. ディレクトリ構造

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # ルートレイアウト
│   ├── page.tsx            # トップページ（Featured）
│   ├── globals.css         # グローバルスタイル
│   ├── providers.tsx       # tRPC Provider
│   ├── discover/           # Experience 一覧
│   │   └── page.tsx
│   ├── experiences/        # Experience 詳細
│   │   └── [id]/
│   │       └── page.tsx
│   ├── book/               # 予約フロー
│   │   └── [experienceId]/
│   │       ├── datetime/
│   │       ├── participants/
│   │       └── confirm/
│   ├── my-experiences/     # マイページ
│   │   └── page.tsx
│   └── auth/               # 認証
│       ├── login/
│       └── signup/
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── shared/             # 共通コンポーネント
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── loading.tsx
│   └── features/           # 機能別コンポーネント
│       ├── experience/
│       │   ├── experience-card.tsx
│       │   ├── experience-grid.tsx
│       │   └── experience-hero.tsx
│       └── booking/
│           ├── datetime-picker.tsx
│           ├── participant-form.tsx
│           └── booking-summary.tsx
├── lib/
│   ├── trpc.ts             # tRPC クライアント設定
│   ├── utils.ts            # ユーティリティ関数
│   └── constants.ts        # 定数定義
├── hooks/
│   ├── use-booking.ts      # カスタムフック
│   └── use-auth.ts
└── public/
    └── images/             # 静的画像ファイル
```

### 4. tRPC クライアント統合

#### セットアップ
```typescript
// lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@shared/types/trpc';

export const trpc = createTRPCReact<AppRouter>();
```

#### Provider 設定
```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: process.env.NEXT_PUBLIC_TRPC_URL || 'http://localhost:4000/trpc',
          headers() {
            // Auth0 トークンを追加（認証実装後）
            const token = typeof window !== 'undefined' 
              ? localStorage.getItem('auth0_token') 
              : null;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

#### データフェッチング例
```typescript
'use client';

import { trpc } from '@/lib/trpc';

export function ExperienceList() {
  const { data, isLoading, error } = trpc.experience.list.useQuery({
    limit: 12,
    status: 'published',
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {data?.experiences.map((experience) => (
        <ExperienceCard key={experience.id} experience={experience} />
      ))}
    </div>
  );
}
```

### 5. 認証統合

#### エンドユーザー認証（Auth0）

**目的**: 一般ユーザーの Experience 予約・体験履歴管理

##### 必要なパッケージ
```bash
npm install @auth0/auth0-react
```

##### Auth0 Provider 設定
```typescript
// app/providers.tsx に追加
import { Auth0Provider } from '@auth0/auth0-react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: typeof window !== 'undefined' 
          ? window.location.origin + '/auth/callback'
          : undefined,
        audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
        scope: 'openid profile email',
      }}
      cacheLocation="localstorage"
    >
      {/* tRPC Provider など */}
      {children}
    </Auth0Provider>
  );
}
```

##### カスタムフック
```typescript
// hooks/use-auth.ts
import { useAuth0 } from '@auth0/auth0-react';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const login = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname },
    });
  };

  const signout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout: signout,
    getAccessToken: getAccessTokenSilently,
  };
}
```

##### ログインボタン例
```typescript
// components/shared/login-button.tsx
'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export function LoginButton() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  if (isLoading) {
    return <Button variant="ghost" disabled>読み込み中...</Button>;
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm">{user?.name}</span>
        <Button variant="ghost" onClick={logout}>
          ログアウト
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" onClick={login}>
      ログイン
    </Button>
  );
}
```

##### 保護されたページ
```typescript
// app/my-experiences/page.tsx
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MyExperiencesPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      login();
    }
  }, [isLoading, isAuthenticated, login]);

  if (isLoading || !isAuthenticated) {
    return <LoadingSpinner />;
  }

  return <div>マイページコンテンツ</div>;
}
```

#### Organization 管理者認証（WorkOS）

**目的**: Enterprise の Organization 管理者が Experience を作成・管理

**注意**: Organization 管理画面は別アプリとして実装予定のため、エンドユーザー向け frontend では WorkOS 認証は**実装しない**。

WorkOS 認証は `backend/` で処理され、Organization 管理者専用の管理画面（今後実装）で使用されます。

##### WorkOS 認証フロー（参考: Backend 側）
```typescript
// backend/src/activities/auth/workos.ts で実装済み
// - SSO ログイン
// - Organization メンバー管理
// - SAML 認証

// Frontend（エンドユーザー向け）では WorkOS は使用しない
```

### 6. 段階的実装戦略

#### Phase 1: MVP（モックデータ）- 現在
**目標**: UI/UX を完成させ、予約フローを一通り体験できる

- [x] Next.js プロジェクトセットアップ
- [x] shadcn/ui コンポーネント移植
- [ ] トップページ（Featured Experiences）
- [ ] Experience 一覧ページ（モックデータ）
- [ ] Experience 詳細ページ（モックデータ）
- [ ] 予約フロー（モックデータ）
  - [ ] 日時選択
  - [ ] 参加者情報入力
  - [ ] 予約確認
- [ ] マイページ（モックデータ）

#### Phase 2: Backend 統合
**目標**: tRPC で Backend API と接続し、実データで動作

- [ ] tRPC クライアント統合
- [ ] Experience 一覧 API 連携（`experience.list`）
- [ ] Experience 詳細 API 連携（`experience.getById`）
- [ ] 予約作成 API 連携（`booking.create`）
- [ ] 予約一覧 API 連携（`booking.listByUser`）
- [ ] エラーハンドリング統一

#### Phase 3: Auth0 認証統合
**目標**: エンドユーザー認証を実装

- [ ] Auth0 SDK 統合（`@auth0/auth0-react`）
- [ ] Auth0 Provider 設定
- [ ] ログイン/ログアウト機能
- [ ] 認証状態管理（useAuth フック）
- [ ] 保護されたページ（予約フロー、マイページ）
- [ ] tRPC リクエストヘッダーに JWT 追加

#### Phase 4: 決済統合
**目標**: 決済プロバイダーと連携（Stripe など）

- [ ] 決済プロバイダー選定
- [ ] 決済フォーム実装
- [ ] 決済 Workflow 呼び出し
- [ ] 決済完了・失敗ハンドリング

#### Phase 5: Experience Circle（キラーフィーチャー）
**目標**: 体験後のコンテンツアクセス・コミュニティ機能

- [ ] Before/After コンテンツ表示
- [ ] アクセス権限管理（Public/チケット購入済み/体験済み）
- [ ] コンテンツ閲覧ページ
- [ ] Experience Circle UI/UX

### 7. 環境変数

```bash
# .env.local

# tRPC Backend URL
NEXT_PUBLIC_TRPC_URL=http://localhost:4000/trpc

# Auth0 設定（エンドユーザー認証）
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=https://api.alllbe.com
NEXT_PUBLIC_AUTH0_REDIRECT_URI=http://localhost:3000/auth/callback

# 環境
NODE_ENV=development
```

### 8. コンポーネント設計原則
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
