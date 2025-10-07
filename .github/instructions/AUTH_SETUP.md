# 認証設定ガイド: Auth0 & WorkOS セットアップ手順

## 目次

1. [認証戦略概要](#認証戦略概要)
2. [Auth0 設定（エンドユーザー認証）](#auth0-設定エンドユーザー認証)
3. [WorkOS 設定（Organization 管理者認証）](#workos-設定organization-管理者認証)
4. [認証フロー比較](#認証フロー比較)
5. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
6. [トラブルシューティング](#トラブルシューティング)

---

## 認証戦略概要

Alllbe プラットフォームでは、ユーザータイプに応じて異なる認証プロバイダーを使用します：

| ユーザータイプ | 認証プロバイダー | 用途 | 実装場所 |
|---------------|-----------------|------|----------|
| **エンドユーザー** | Auth0 | Experience 予約・体験履歴管理 | `frontend/` |
| **Organization 管理者** | WorkOS | Enterprise SSO、Organization 管理 | `backend/` + 管理画面（別アプリ） |

### データ管理方針

- **Auth0**: エンドユーザーのプロフィール情報（名前、メール、写真など）
- **WorkOS**: Organization 情報、Organization メンバー管理
- **自社 DB**: Auth0/WorkOS の ID のみを保存し、詳細情報は API で取得

詳細は `.github/instructions/auth.instructions.md` を参照してください。

---

## Auth0 設定（エンドユーザー認証）

### 1. Auth0 アカウント作成

1. [Auth0](https://auth0.com/) にアクセス
2. "Sign Up" でアカウント作成
3. Tenant 名を設定（例: `alllbe-prod`, `alllbe-dev`）
4. Region: **Japan (Tokyo)** を推奨

### 2. Application 作成

1. Dashboard → **Applications** → **Create Application**
2. Application 名: `Alllbe Frontend (Development)`
3. Application Type: **Single Page Application (SPA)**
4. Technology: **React**
5. **Create** をクリック

### 3. Application 設定

**Settings** タブで以下を設定：

#### Allowed Callback URLs
```
http://localhost:3000/auth/callback,
https://alllbe.com/auth/callback
```

#### Allowed Logout URLs
```
http://localhost:3000,
https://alllbe.com
```

#### Allowed Web Origins
```
http://localhost:3000,
https://alllbe.com
```

#### Allowed Origins (CORS)
```
http://localhost:3000,
https://alllbe.com
```

#### Token Endpoint Authentication Method
- **None** を選択（SPA のため）

**Save Changes** をクリック

### 4. API 設定（Backend 連携用）

1. Dashboard → **Applications** → **APIs** → **Create API**
2. Name: `Alllbe Backend API`
3. Identifier: `https://api.alllbe.com` ← これが Audience として使用される
4. Signing Algorithm: **RS256**
5. **Create** をクリック

#### Permissions 設定（Scopes）
**Permissions** タブで以下の Scope を追加：

```
read:experiences     - Experience の閲覧
write:bookings       - 予約の作成・更新
read:bookings        - 予約の閲覧
read:user_profile    - ユーザープロフィールの閲覧
write:user_profile   - ユーザープロフィールの更新
```

### 5. 環境変数設定

#### Frontend 用
```bash
# frontend/.env.local

# Auth0 Domain（Settings > Basic Information > Domain）
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com

# Auth0 Client ID（Settings > Basic Information > Client ID）
NEXT_PUBLIC_AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API Audience（APIs > Alllbe Backend API > Identifier）
NEXT_PUBLIC_AUTH0_AUDIENCE=https://api.alllbe.com

# Callback URL
NEXT_PUBLIC_AUTH0_REDIRECT_URI=http://localhost:3000/auth/callback
```

#### Backend 用（Management API）
```bash
# backend/.env

# Auth0 Management API（Backend でユーザー管理する場合）
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-management-client-id
AUTH0_CLIENT_SECRET=your-management-client-secret
AUTH0_AUDIENCE=https://api.alllbe.com
```

**Management API の取得方法**:
1. Dashboard → **Applications** → **Applications**
2. "Auth0 Management API" を選択
3. **Machine to Machine Applications** タブ
4. Alllbe Backend を有効化
5. Scopes を選択（`read:users`, `update:users` など）

### 6. Social Connections 設定（オプション）

日本向けに推奨する Social Connections：

#### Google
1. Dashboard → **Authentication** → **Social** → **Google**
2. [Google Cloud Console](https://console.cloud.google.com/) で OAuth Client ID 作成
3. Auth0 の Callback URL を Google の Authorized redirect URIs に追加：
   ```
   https://your-tenant.auth0.com/login/callback
   ```
4. Client ID と Client Secret を Auth0 に入力

#### LINE
1. Dashboard → **Authentication** → **Social** → **Create Connection**
2. **LINE** を選択
3. [LINE Developers](https://developers.line.biz/console/) で Channel 作成
4. Channel ID と Channel Secret を Auth0 に入力
5. Callback URL を LINE に設定：
   ```
   https://your-tenant.auth0.com/login/callback
   ```

#### Twitter / X
1. Dashboard → **Authentication** → **Social** → **Twitter**
2. [Twitter Developer Portal](https://developer.twitter.com/) で App 作成
3. API Key と API Secret を Auth0 に入力

### 7. Branding 設定（オプション）

Universal Login の見た目をカスタマイズ：

1. Dashboard → **Branding** → **Universal Login**
2. **Settings** タブ:
   - **Logo URL**: `https://alllbe.com/logo.png`
   - **Primary Color**: `#000000`（黒）
   - **Background Color**: `#FFFFFF`（白）

3. **Advanced Options** タブ:
   - **Customization Template**: **New Universal Login** を選択
   - カスタム CSS/JS を追加可能

### 8. Rules / Actions 設定

#### ユーザーメタデータを JWT に追加

1. Dashboard → **Actions** → **Flows** → **Login**
2. **Custom** → **Build Custom** をクリック
3. Action 名: `Add User Metadata to Token`
4. Code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://alllbe.com';
  
  if (event.authorization) {
    // Access Token にユーザー情報を追加
    api.accessToken.setCustomClaim(`${namespace}/user_id`, event.user.user_id);
    api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
    api.accessToken.setCustomClaim(`${namespace}/name`, event.user.name);
    
    // ID Token にも追加（Frontend で使用）
    api.idToken.setCustomClaim(`${namespace}/user_id`, event.user.user_id);
  }
};
```

5. **Deploy** をクリック
6. **Login** Flow にドラッグ&ドロップして追加

### 9. 動作確認

#### 1. Test Login（Dashboard 内）
1. Application Settings → **Quick Start** → **React**
2. **Test Login** ボタンで動作確認

#### 2. Frontend でのテスト
```bash
cd frontend
npm run dev
```

1. http://localhost:3000 にアクセス
2. ログインボタンをクリック
3. Auth0 Universal Login が表示されることを確認
4. ログイン後、JWT が発行されることを確認

#### 3. JWT のデバッグ
取得した JWT を https://jwt.io/ に貼り付けて内容を確認：

```json
{
  "https://alllbe.com/user_id": "auth0|123456",
  "https://alllbe.com/email": "user@example.com",
  "https://alllbe.com/name": "田中太郎",
  "iss": "https://your-tenant.auth0.com/",
  "sub": "auth0|123456",
  "aud": "https://api.alllbe.com",
  "exp": 1234567890
}
```

---

## WorkOS 設定（Organization 管理者認証）

### 1. WorkOS アカウント作成

1. [WorkOS](https://workos.com/) にアクセス
2. "Sign Up" でアカウント作成
3. 会社情報を入力

### 2. Environment 設定

WorkOS には2つの環境があります：

- **Development**: テスト・開発用（無料、SSO 接続数制限あり）
- **Production**: 本番環境（有料、制限なし）

### 3. API Keys 取得

1. Dashboard → **Developers** → **API Keys**
2. **Development** 環境の以下の情報を取得：
   - **Client ID**: `client_xxxxx`
   - **API Key**: `sk_xxxxx`（Secret Key）

3. **Production** 環境の情報も取得（本番デプロイ時に使用）

### 4. Redirect URI 設定

1. Dashboard → **Configuration** → **Redirects**
2. Redirect URIs を追加：

**Development**:
```
http://localhost:3000/auth/workos/callback
http://localhost:4000/auth/workos/callback
```

**Production**:
```
https://admin.alllbe.com/auth/workos/callback
https://api.alllbe.com/auth/workos/callback
```

### 5. 環境変数設定

```bash
# backend/.env

# WorkOS API Key（Development）
WORKOS_API_KEY=sk_test_xxxxx

# WorkOS Client ID
WORKOS_CLIENT_ID=client_xxxxx

# Redirect URI（Backend のコールバック URL）
WORKOS_REDIRECT_URI=http://localhost:4000/auth/workos/callback

# Webhook Secret（後で設定）
WORKOS_WEBHOOK_SECRET=
```

### 6. Organizations 設定

#### テスト用 Organization の作成

1. Dashboard → **Organizations** → **Create Organization**
2. 以下の情報を入力：
   - **Name**: `Example Corp`
   - **Domains**: `example.com`（カンマ区切りで複数可）

3. **Create Organization** をクリック
4. Organization ID（`org_xxxxx`）をメモ

#### API での Organization 作成（本番環境）

```typescript
// backend/src/activities/auth/workos.ts で実装済み
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const organization = await workos.organizations.createOrganization({
  name: 'Example Corp',
  domains: ['example.com'],
});
```

### 7. SSO Connections 設定

#### Google OAuth Connection（テスト用）

1. Dashboard → **SSO** → **Connections** → **Create Connection**
2. **Connection Type**: **GoogleOAuth**
3. **Organization** を選択
4. **Google Workspace Domain** を入力（例: `example.com`）
5. **Create Connection** をクリック

#### SAML Connection（Enterprise 用）

1. Dashboard → **SSO** → **Connections** → **Create Connection**
2. **Connection Type**: **GenericSAML**
3. **Organization** を選択
4. IdP（Identity Provider）情報を入力：
   - **IdP Entity ID**: `https://idp.example.com`
   - **SSO URL**: `https://idp.example.com/sso`
   - **X.509 Certificate**: IdP の証明書をペースト

5. **Create Connection** をクリック

#### ACS URL と Entity ID を IdP に設定

WorkOS が提供する情報を IdP（Okta、Azure AD など）に設定：

- **ACS URL**: `https://api.workos.com/sso/saml/acs/{connection_id}`
- **Entity ID**: `https://api.workos.com/sso/saml/metadata/{connection_id}`

### 8. Webhooks 設定

1. Dashboard → **Developers** → **Webhooks** → **Create Endpoint**
2. **Endpoint URL**: `https://api.alllbe.com/webhooks/workos`
3. **Events to listen**:
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `user.created`
   - `user.updated`
   - `user.deleted`

4. **Create Endpoint** をクリック
5. **Signing Secret** をコピーして環境変数に設定：

```bash
# backend/.env
WORKOS_WEBHOOK_SECRET=wh_xxxxx
```

### 9. 動作確認

#### 1. SSO ログインテスト

Backend に実装された認証フローをテスト：

```bash
# Backend を起動
cd backend
npm run dev
```

```bash
# SSO 認証 URL を取得
curl -X POST http://localhost:4000/trpc/auth.workosAuthUrl \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org_xxxxx"}'
```

返却された URL にアクセスして SSO ログインをテスト。

#### 2. Webhook テスト

1. Dashboard → **Webhooks** → 作成した Endpoint を選択
2. **Send Test Event** をクリック
3. Event Type: `organization.created`
4. Backend のログで Webhook が受信されたことを確認

---

## 認証フロー比較

### Auth0（エンドユーザー）

```
1. ユーザーが「ログイン」ボタンをクリック
   ↓
2. Auth0 Universal Login にリダイレクト
   ↓
3. ユーザーがメール/パスワード or ソーシャルログインで認証
   ↓
4. Auth0 が JWT（Access Token + ID Token）を発行
   ↓
5. Frontend の /auth/callback にリダイレクト
   ↓
6. JWT を取得して localStorage に保存
   ↓
7. tRPC リクエストヘッダーに Access Token を追加
   ↓
8. Backend が JWT を検証してユーザー情報を取得
```

**使用する Token**:
- **ID Token**: Frontend でユーザー情報表示用
- **Access Token**: Backend API 呼び出し用

### WorkOS（Organization 管理者）

```
1. 管理者が Organization 管理画面にアクセス
   ↓
2. Backend が WorkOS 認証 URL を生成
   （organizationId を指定）
   ↓
3. WorkOS SSO ページにリダイレクト
   ↓
4. 管理者が企業の SSO（SAML/OAuth）で認証
   ↓
5. WorkOS が認証コード（code）を発行
   ↓
6. Backend の /auth/workos/callback にリダイレクト
   ↓
7. Backend が認証コードを検証
   WorkOS から Profile + Access Token を取得
   ↓
8. Backend が自社 DB にユーザー情報を保存/更新
   ↓
9. Backend が JWT（自社発行）を生成
   ↓
10. 管理画面に JWT を返す
   ↓
11. 管理画面が API リクエストに JWT を追加
```

**使用する Token**:
- **WorkOS Access Token**: WorkOS API 呼び出し用（Backend 内部）
- **自社 JWT**: 管理画面 ↔ Backend API 用

---

## セキュリティベストプラクティス

### 共通

✅ **必須対応**:
- HTTPS を必ず使用（本番環境）
- JWT の有効期限を短く設定（1時間推奨）
- Refresh Token で自動更新
- 環境変数をコミットしない（`.env` を `.gitignore` に追加）
- CORS を適切に設定
- Rate Limiting を実装

❌ **禁止事項**:
- JWT を URL パラメータに含めない
- localStorage に Refresh Token を保存しない
- Secret Key をクライアントに露出しない

### Auth0 専用

✅ **推奨設定**:
- Universal Login を使用（カスタムログイン画面は避ける）
- Refresh Token Rotation を有効化
- Brute Force Protection を有効化
- Multi-Factor Authentication (MFA) を推奨
- 疑わしいログインの通知を有効化

**設定方法**:
1. Dashboard → **Security** → **Attack Protection**
2. **Brute Force Protection**: ON
3. **Suspicious IP Throttling**: ON
4. **Breached Password Detection**: ON

### WorkOS 専用

✅ **推奨設定**:
- Organization ID を必ず検証（異なる Organization への不正アクセスを防ぐ）
- Webhook の署名を必ず検証
- SSO Connection は Organization 管理者のみが設定可能に
- メンバー招待は Organization 管理者のみが実行可能に

**Webhook 検証例**:
```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const event = workos.webhooks.constructEvent({
  payload: body,
  sigHeader: signature,
  secret: process.env.WORKOS_WEBHOOK_SECRET!,
});
```

---

## トラブルシューティング

### Auth0

#### 問題: `invalid_grant` エラー
**原因**: Redirect URI が一致しない

**解決策**:
1. Auth0 Dashboard → Application Settings → Allowed Callback URLs を確認
2. Frontend の環境変数 `NEXT_PUBLIC_AUTH0_REDIRECT_URI` を確認
3. URL が完全一致しているか確認（末尾のスラッシュに注意）

#### 問題: CORS エラー
**原因**: Origin が許可されていない

**解決策**:
1. Auth0 Dashboard → Application Settings → Allowed Web Origins を確認
2. `http://localhost:3000` が含まれているか確認
3. カンマ区切りで複数の Origin を設定可能

#### 問題: JWT 検証失敗
**原因**: Audience が一致しない

**解決策**:
1. Backend の `AUTH0_AUDIENCE` と API Identifier が一致するか確認
2. Frontend で `getAccessTokenSilently` を呼び出す際に Audience を指定：
```typescript
const token = await getAccessTokenSilently({
  authorizationParams: {
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  },
});
```

#### 問題: ユーザー情報が取得できない
**原因**: Scope が不足している

**解決策**:
1. Auth0 Provider で `scope` を指定：
```typescript
<Auth0Provider
  scope="openid profile email"
  // ...
>
```

### WorkOS

#### 問題: Organization not found
**原因**: Organization ID が間違っている

**解決策**:
1. WorkOS Dashboard → Organizations で Organization ID を確認
2. `org_` で始まる ID であることを確認

#### 問題: Webhook signature invalid
**原因**: Webhook Secret が間違っている

**解決策**:
1. WorkOS Dashboard → Webhooks → Endpoint → Signing Secret を確認
2. Backend の `WORKOS_WEBHOOK_SECRET` が一致しているか確認
3. Secret を再生成して更新

#### 問題: SSO Connection エラー
**原因**: IdP 設定が間違っている

**解決策**:
1. SAML メタデータが正しいか確認
2. SSO URL が正しいか確認
3. X.509 証明書が正しいか確認（有効期限も確認）
4. IdP 側の ACS URL と Entity ID が WorkOS のものと一致しているか確認

#### 問題: Authorization URL が生成できない
**原因**: Client ID が設定されていない

**解決策**:
```bash
# .env を確認
WORKOS_CLIENT_ID=client_xxxxx  # 設定されているか確認
```

---

## 参考資料

### Auth0
- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 React SDK](https://github.com/auth0/auth0-react)
- [Auth0 Management API](https://auth0.com/docs/api/management/v2)
- [Auth0 Rules](https://auth0.com/docs/customize/rules)
- [Auth0 Actions](https://auth0.com/docs/customize/actions)

### WorkOS
- [WorkOS Documentation](https://workos.com/docs)
- [WorkOS Node SDK](https://github.com/workos/workos-node)
- [WorkOS SSO Guide](https://workos.com/docs/sso)
- [WorkOS Organizations](https://workos.com/docs/organizations)
- [WorkOS Webhooks](https://workos.com/docs/webhooks)

### ツール
- [JWT.io](https://jwt.io/) - JWT デバッグツール
- [SAML Tracer](https://addons.mozilla.org/ja/firefox/addon/saml-tracer/) - SAML デバッグツール（Firefox）

---

この設定ガイドに従って、セキュアで Enterprise Ready な認証システムを構築してください。
