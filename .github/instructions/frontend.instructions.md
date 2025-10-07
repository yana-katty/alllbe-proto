---
applyTo: "frontend/**"
---

# Frontend Instructions: Alllbe エンドユーザー向け Experience 予約 Web アプリケーション

## 開発環境のセットアップ

Playwright MCPツールを使用してブラウザを実際に操作して開発してください


### Backend の起動（Docker Compose - 推奨）

Frontend開発を始める前に、BackendのtRPC ServerとTemporal Workerを起動します。

```bash
# プロジェクトルートで実行

# 初回またはDockerfileを変更した場合
docker compose build

# Backend サービスを起動（デタッチモード）
docker compose up -d

# ログを確認
docker compose logs -f trpc    # tRPC Serverのログ
docker compose logs -f worker  # Temporal Workerのログ

# サービスを停止
docker compose down
```

起動されるサービス:
- **trpc**: tRPC Server (http://localhost:4000/trpc)
- **worker**: Temporal Worker

### Backend の起動（ローカル開発 - 代替方法）

Docker Composeを使わない場合は、個別に起動:

```bash
cd backend

# ターミナル1: tRPC Server
npm run dev:server

# ターミナル2: Temporal Worker
npm run dev:worker
```

### Frontend の起動

```bash
cd frontend

# 環境変数設定（初回のみ）
cp .env.local.example .env.local

# .env.localに以下を設定:
# NEXT_PUBLIC_TRPC_URL=http://localhost:4000/trpc
# NEXT_PUBLIC_MOCK_USER_ID=auth0|mock-user-001

# 依存パッケージインストール（初回のみ）
npm install

# 開発サーバー起動
npm run dev
```

Frontendは http://localhost:3000 で起動します。

### テストデータの投入

```bash
cd backend

# tRPC APIを使用してテストデータを投入
npm run db:seed
```

実行前に以下が起動していることを確認:
- Backend tRPC Server (docker compose up -d または npm run dev:server)
- Temporal Worker (docker compose up -d または npm run dev:worker)

投入されるデータ:
- Users: 1件（auth0|mock-user-001）
- Organizations: 3件（WorkOS）
- Brands: 3件（Organization作成時に自動作成）
- Experiences: 6件（画像URL付き）
- ExperienceAssets: 12件（Before/Afterコンテンツ）

---

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

### 3. ディレクトリ構造（API統合完了）

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # ✅ ルートレイアウト（Providers 統合済み）
│   ├── page.tsx            # ✅ トップページ（API統合完了）
│   ├── globals.css         # ✅ グローバルスタイル
│   ├── providers.tsx       # ✅ tRPC + TanStack Query Provider
│   ├── loading.tsx         # ✅ ローディング表示
│   ├── discover/           # ✅ Experience 一覧（API統合完了）
│   │   ├── page.tsx        # ✅ trpc.experience.list.useQuery 統合済み
│   │   └── loading.tsx     # ✅ ローディング表示
│   ├── experiences/        # ✅ Experience 詳細（API統合完了）
│   │   └── [id]/
│   │       └── page.tsx    # ✅ trpc.experience.getById.useQuery 統合済み
│   ├── book/               # 🚧 予約フロー（部分実装）
│   │   └── [experienceId]/
│   │       ├── page.tsx    # ✅ 実装済み
│   │       ├── datetime/
│   │       │   └── page.tsx  # ✅ 実装済み（日時選択）
│   │       ├── participants/  # ⬜ 未実装
│   │       └── confirm/       # ⬜ 未実装
│   ├── my-experiences/     # ⬜ マイページ（未実装）
│   │   └── page.tsx
│   └── auth/               # ⬜ 認証（Phase 3）
│       ├── login/
│       └── callback/
├── components/
│   ├── ui/                 # ✅ shadcn/ui コンポーネント（移植済み）
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...（40+ components）
│   ├── shared/             # ✅ 共通コンポーネント
│   │   ├── header.tsx      # ✅ サイト共通ヘッダー
│   │   ├── footer.tsx      # ✅ サイト共通フッター
│   │   └── loading.tsx     # ✅ ローディング表示
│   └── features/           # ✅ 機能別コンポーネント（API統合完了）
│       └── experience/
│           ├── experience-card.tsx      # ✅ API型対応済み
│           ├── experience-grid.tsx      # ✅ API型対応済み
│           └── experience-hero.tsx      # ✅ API型対応済み
├── lib/
│   ├── trpc.ts             # ✅ tRPC クライアント設定
│   ├── utils.ts            # ✅ ユーティリティ関数（shadcn/ui）
│   └── mock-data.ts        # ⚠️ 非推奨（API統合により不要）
├── hooks/
│   ├── use-mobile.ts       # ✅ モバイル判定フック
│   └── use-toast.ts        # ✅ トースト通知フック
├── public/                 # ✅ 静的ファイル
│   └── *.jpg               # Experience 画像
├── .env.local              # ✅ 環境変数設定済み
├── package.json            # ✅ tRPC/Auth0 パッケージ追加済み
└── tsconfig.json           # ✅ @shared/* パスエイリアス設定済み
```

**凡例**:
- ✅ 実装済み
- 🚧 部分実装
- ⬜ 未実装

### 4. tRPC クライアント統合（実装済み）

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

#### データフェッチング例（実装済み）
```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { LoadingSpinner } from '@/components/shared/loading';

export function ExperienceList() {
  const { data: experiences, isLoading, error } = trpc.experience.list.useQuery({
    limit: 100,
    status: 'published',
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">データの取得に失敗しました</p>
        <p className="text-sm text-gray-500">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {(experiences || []).map((experience) => (
        <ExperienceCard key={experience.id} {...experience} />
      ))}
    </div>
  );
}
```

#### コンポーネント型定義（API統合済み）
```typescript
// components/features/experience/experience-card.tsx
interface ExperienceCardProps {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  location: string | null
  duration: string | null
  price: string | null
  experienceType: string
  featured?: boolean
}

// components/features/experience/experience-hero.tsx
interface ExperienceHeroProps {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  location: string | null
  duration: string | null
  experienceType: string
  featured?: string
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

#### Phase 1: MVP（モックデータ）- 完了
**目標**: UI/UX を完成させ、予約フローを一通り体験できる

- [x] Next.js プロジェクトセットアップ
- [x] shadcn/ui コンポーネント移植
- [x] 不要なディレクトリ削除（admin, dashboard, organization, profile）
- [x] tRPC クライアント設定（lib/trpc.ts）
- [x] Providers 統合（app/providers.tsx, layout.tsx）
- [x] 環境変数設定（.env.local）
- [x] 共通コンポーネント整理（components/shared/header.tsx, footer.tsx）
- [x] トップページ（Featured Experiences）- モックデータで動作確認
- [x] Experience 一覧ページ（/discover）- モックデータで動作確認
- [x] Experience 詳細ページ（/experiences/[id]）- モックデータで動作確認
- [x] 予約フロー（モックデータ）
  - [x] 日時選択（/book/[experienceId]/datetime）
  - [ ] 参加者情報入力
  - [ ] 予約確認

#### Phase 2: Backend 統合 - 完了
**目標**: tRPC で Backend API と接続し、実データで動作

- [x] tRPC クライアント統合
- [x] Experience 一覧 API 連携（`experience.list`）
- [x] Experience 詳細 API 連携（`experience.getById`）
- [x] ExperienceCard コンポーネント API型対応
- [x] ExperienceGrid コンポーネント API型対応
- [x] ExperienceHero コンポーネント API型対応
- [x] トップページ API統合（Featured Experiences）
- [x] Experience一覧ページ API統合
- [x] Experience詳細ページ API統合
- [x] エラーハンドリング統一（LoadingSpinner, ErrorMessage）
- [ ] 予約作成 API 連携（`booking.create`）
- [ ] 予約一覧 API 連携（`booking.listByUser`）

#### Phase 3: Auth0 認証統合 - 未着手
**目標**: エンドユーザー認証を実装

- [ ] Auth0 SDK 統合（`@auth0/auth0-react`）
- [ ] Auth0 Provider 設定
- [ ] ログイン/ログアウト機能
- [ ] 認証状態管理（useAuth フック）
- [ ] 保護されたページ（予約フロー、マイページ）
- [ ] tRPC リクエストヘッダーに JWT 追加

#### Phase 4: 決済統合 - 未着手
**目標**: 決済プロバイダーと連携（Stripe など）

- [ ] 決済プロバイダー選定
- [ ] 決済フォーム実装
- [ ] 決済 Workflow 呼び出し
- [ ] 決済完了・失敗ハンドリング

#### Phase 5: Experience Circle（キラーフィーチャー）- 未着手
**目標**: 体験後のコンテンツアクセス・コミュニティ機能

- [ ] Before/After コンテンツ表示
- [ ] アクセス権限管理（Public/チケット購入済み/体験済み）
- [ ] コンテンツ閲覧ページ
- [ ] Experience Circle UI/UX

### 7. 環境変数（設定済み）

```bash
# .env.local

# tRPC Backend URL（設定済み）
NEXT_PUBLIC_TRPC_URL=http://localhost:4000/trpc

# モックユーザーID（開発環境用・設定済み）
NEXT_PUBLIC_MOCK_USER_ID=auth0|mock-user-001

# Auth0 設定（エンドユーザー認証・Phase 3で設定予定）
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=https://api.alllbe.com
NEXT_PUBLIC_AUTH0_REDIRECT_URI=http://localhost:3000/auth/callback

# 環境
NODE_ENV=development
```

### 8. Phase 2 実装詳細（API統合完了）

#### 実装済みページ

**トップページ（app/page.tsx）**:
- ✅ `'use client'` ディレクティブ追加
- ✅ `trpc.experience.list.useQuery({ limit: 4, status: 'published' })` で Featured Experiences 取得
- ✅ Loading/Error 状態の適切なハンドリング
- ✅ ExperienceHero コンポーネントで最初の Experience を表示
- ✅ ExperienceCard で残り3件を表示

**Experience一覧ページ（app/discover/page.tsx）**:
- ✅ `'use client'` ディレクティブ追加
- ✅ `trpc.experience.list.useQuery({ limit: 100, status: 'published' })` で全 Experience 取得
- ✅ ExperienceGrid コンポーネントで3カラムグリッド表示
- ✅ Loading/Error 状態の適切なハンドリング

**Experience詳細ページ（app/experiences/[id]/page.tsx）**:
- ✅ `'use client'` ディレクティブ追加
- ✅ `trpc.experience.getById.useQuery(params.id)` で Experience 詳細取得
- ✅ heroImageUrl, coverImageUrl のフォールバック処理
- ✅ highlights フィールドの JSON パース処理
- ✅ Loading/Error/NotFound 状態の適切なハンドリング
- ⚠️ beforeContent/afterContent は削除（ExperienceAssets API で別途取得予定）

#### 更新済みコンポーネント

**ExperienceCard（components/features/experience/experience-card.tsx）**:
- ✅ API型に対応（`ExperienceCardProps` 更新）
- ✅ `experienceType` から category へのマッピング（'scheduled' → '日時指定', 'period' → '期間指定'）
- ✅ `coverImageUrl` のフォールバック処理（defaultImage）
- ✅ `price` フィールドの表示追加
- ✅ `description` の `line-clamp-2` による省略表示

**ExperienceGrid（components/features/experience/experience-grid.tsx）**:
- ✅ API型に対応（`Experience` interface 更新）
- ✅ 不要なフィールド削除（category, image, subtitle）
- ✅ 必要なフィールド追加（description, coverImageUrl, price, experienceType, status）

**ExperienceHero（components/features/experience/experience-hero.tsx）**:
- ✅ API型に対応（`ExperienceHeroProps` 更新）
- ✅ `experienceType` から category へのマッピング
- ✅ `coverImageUrl` のフォールバック処理
- ✅ `description` の条件付き表示（`line-clamp-3`）
- ✅ location, duration の null チェック

#### データフロー

```
Backend (tRPC Server)
  ↓ HTTP/JSON
tRPC Client (lib/trpc.ts)
  ↓ React Query
Page Components (app/**/*.tsx)
  ↓ Props
Feature Components (components/features/**/*.tsx)
  ↓ Render
UI Components (components/ui/**/*.tsx)
```

### 9. コンポーネント設計原則
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
