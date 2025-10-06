# 認証・データ管理責務分離設計書

## 概要

Alllbe プラットフォームでは、個人情報保護とGDPR準拠を最優先に、Auth0・WorkOS・自社DBの責務を明確に分離してデータ管理を行います。

**基本原則**:
- **個人情報の二重管理禁止**: Auth0・WorkOS がマスター、DBは参照IDのみ
- **データソースの一元化**: 個人情報削除は外部サービスで完結
- **最小権限の原則**: 必要最小限のデータのみDBに保存

## 責務分離マトリックス

| データカテゴリ | Auth0 | WorkOS | 自社DB | 備考 |
|---|---|---|---|---|
| **エンドユーザー個人情報** | ✅ Master | ❌ | ❌ | 氏名、メール、プロフィール等 |
| **エンドユーザー認証** | ✅ Master | ❌ | 📋 ID参照 | ソーシャルログイン、MFA等 |
| **Organization企業情報** | ❌ | ✅ Master | ❌ | 企業名、住所、連絡先等 |
| **Organization管理ユーザー** | ❌ | ✅ Master | 📋 ID参照 | 管理者の個人情報・権限 |
| **SSO・Enterprise設定** | ❌ | ✅ Master | ❌ | SAML、OIDC設定等 |
| **Experience情報** | ❌ | ❌ | ✅ Master | タイトル、説明、料金等 |
| **Booking・予約情報** | ❌ | ❌ | ✅ Master | 予約詳細、決済状況等 |
| **プラットフォーム統計** | ❌ | ❌ | ✅ Master | 非個人化された利用統計 |
| **関連コンテンツ** | ❌ | ❌ | ✅ Master | Before/After コンテンツ |

**凡例**:
- ✅ Master: そのサービスがデータの権威ソース
- 📋 ID参照: 外部IDを参照するが実体データは保存しない
- ❌: データを保存しない

## データフロー設計

### 1. エンドユーザー登録・認証フロー

```
1. ユーザー登録/ログイン
   └─ Auth0 ── (個人情報保存) ── Auth0 Database
   └─ Auth0 ── (user_id通知) ── 自社API
       └─ 自社DB ── (auth0_user_id, プラットフォーム設定のみ保存)

2. ユーザー情報取得
   ├─ 自社DB ── (auth0_user_id取得)
   └─ Auth0 API ── (個人情報取得) ── フロントエンド表示
```

### 2. Organization・管理ユーザー登録フロー

```
1. Organization登録
   ├─ WorkOS ── (企業情報保存) ── WorkOS Database
   ├─ WorkOS ── (管理ユーザー作成) ── WorkOS Database
   └─ WorkOS ── (organization_id, user_id通知) ── 自社API
       └─ 自社DB ── (workos_organization_id, workos_user_id, 設定のみ保存)

2. Organization情報取得
   ├─ 自社DB ── (workos_organization_id取得)
   └─ WorkOS API ── (企業情報取得) ── 管理画面表示
```

### 3. GDPR データ削除フロー

```
個人情報削除要求
├─ エンドユーザーの場合:
│   ├─ Auth0 ── (個人情報削除) ── 完了
│   └─ 自社DB ── (auth0_user_id は残存、紐づけデータは孤立)
│
└─ Organization管理ユーザーの場合:
    ├─ WorkOS ── (個人情報削除) ── 完了
    └─ 自社DB ── (workos_user_id は残存、紐づけデータは孤立)
```

## 技術実装ガイドライン

### 1. DB設計原則

**✅ 保存してよいデータ**:
- Auth0/WorkOS の ID参照
- プラットフォーム固有の設定・統計
- 非個人化された集計データ
- ビジネスロジックに必要な関連データ

**❌ 保存してはいけないデータ**:
- 氏名、メールアドレス
- 住所、電話番号
- 生年月日、性別
- その他の個人を特定可能な情報

### 2. API設計パターン

#### エンドユーザー情報取得
```typescript
// ❌ 悪い例: DBに個人情報を保存
const getUserInfo = async (userId: string) => {
  return await db.select().from(users).where(eq(users.id, userId));
  // { id: "123", name: "田中太郎", email: "tanaka@example.com" } // ❌
};

// ✅ 良い例: Auth0から個人情報を取得
const getUserInfo = async (userId: string) => {
  const dbUser = await db.select().from(users).where(eq(users.id, userId));
  const auth0Profile = await auth0.getUser(dbUser.auth0_user_id);
  return {
    platform_data: dbUser, // プラットフォーム設定のみ
    personal_info: auth0Profile, // 個人情報は Auth0 から
  };
};
```

#### Organization情報取得
```typescript
// ✅ 良い例: WorkOSから企業情報を取得
const getOrganizationInfo = async (orgId: string) => {
  const dbOrg = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const workosOrg = await workos.getOrganization(dbOrg.workos_organization_id);
  return {
    platform_data: dbOrg, // プラットフォーム設定のみ
    organization_info: workosOrg, // 企業情報は WorkOS から
  };
};
```

### 3. 型安全性の確保

```typescript
// 型レベルでの個人情報漏洩防止
type SafeDbUser = Omit<DbUserEntity, 'name' | 'email'>; // コンパイルエラーで防止

// Runtime でのバリデーション
const validateNonPersonalData = (data: unknown) => {
  const personalInfoFields = ['name', 'email', 'phone', 'address'];
  const keys = Object.keys(data);
  const hasPersonalInfo = keys.some(key => personalInfoFields.includes(key));
  
  if (hasPersonalInfo) {
    throw new Error('Personal information detected in DB data');
  }
};
```

## GDPR・プライバシー対応

### 1. データ主体の権利対応

| 権利 | 実装方法 | 技術的実現 |
|---|---|---|
| **アクセス権** | Auth0/WorkOS API経由で個人情報取得 | 外部API統合 |
| **修正権** | Auth0/WorkOS で直接修正 | 外部サービス画面 |
| **削除権** | Auth0/WorkOS で削除実行 | 外部API呼び出し |
| **データポータビリティ** | Auth0/WorkOS からエクスポート | API統合 + フォーマット変換 |
| **処理停止権** | アカウント無効化 | ステータス管理 |

### 2. 技術的対応策

#### 匿名化・仮名化
```typescript
// 統計・分析用の匿名化データ生成
const createAnonymizedStats = (userActivities: UserActivity[]) => {
  return userActivities.map(activity => ({
    // 個人特定情報を除去
    experience_type: activity.experience_type,
    booking_date: activity.booking_date,
    completion_status: activity.completion_status,
    region: activity.location?.region, // 市区町村レベルで匿名化
    age_group: calculateAgeGroup(activity.user_birth_date), // 年代で匿名化
    // user_id, email, name等は除外
  }));
};
```

#### データ保持期間管理
```typescript
// 法的根拠に基づく保持期間設定
const DATA_RETENTION_POLICY = {
  booking_records: { years: 7 }, // 会計法に基づく
  analytics_data: { years: 2 }, // ビジネス目的
  audit_logs: { years: 10 }, // セキュリティ監査
  marketing_consent: { years: 1 }, // マーケティング同意
} as const;

// 自動削除処理
const scheduleDataCleanup = async () => {
  const cutoffDate = subYears(new Date(), DATA_RETENTION_POLICY.analytics_data.years);
  await db.delete(analytics_events).where(lt(analytics_events.created_at, cutoffDate));
};
```

### 3. 監査・コンプライアンス

#### データアクセスログ
```typescript
// 個人情報アクセスの監査ログ
const logPersonalDataAccess = async (params: {
  user_id: string;
  accessed_by: string;
  data_type: 'profile' | 'organization' | 'analytics';
  legal_basis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest';
  purpose: string;
}) => {
  await db.insert(audit_logs).values({
    ...params,
    accessed_at: new Date(),
    ip_address: getClientIp(),
    user_agent: getUserAgent(),
  });
};
```

#### 定期コンプライアンスチェック
```typescript
// DBに個人情報が漏洩していないかの定期チェック
const runComplianceAudit = async () => {
  const suspiciousColumns = await db.execute(sql`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE column_name IN ('name', 'email', 'phone', 'address', 'birth_date')
    AND table_schema = 'public'
  `);
  
  if (suspiciousColumns.length > 0) {
    await notifyComplianceTeam(suspiciousColumns);
  }
};
```

## 運用・監視

### 1. データ同期監視

Auth0/WorkOS とのデータ同期状態を監視し、不整合を検出します。

```typescript
// 同期状態チェック
const validateDataSync = async () => {
  // Auth0 に存在するが DB に存在しないユーザー
  const orphanedAuth0Users = await findOrphanedAuth0Users();
  
  // DB に存在するが Auth0 に存在しないユーザー参照
  const invalidDbReferences = await findInvalidDbReferences();
  
  if (orphanedAuth0Users.length > 0 || invalidDbReferences.length > 0) {
    await alertDataInconsistency({
      orphaned_users: orphanedAuth0Users.length,
      invalid_references: invalidDbReferences.length,
    });
  }
};
```

### 2. セキュリティ監視

```typescript
// 異常なデータアクセスパターンの検出
const detectAnomalousAccess = async () => {
  // 短時間での大量個人情報アクセス
  const suspiciousActivity = await db.select()
    .from(audit_logs)
    .where(
      and(
        gte(audit_logs.accessed_at, subHours(new Date(), 1)),
        eq(audit_logs.data_type, 'profile')
      )
    )
    .groupBy(audit_logs.accessed_by)
    .having(count(audit_logs.id), '>', 100);
    
  if (suspiciousActivity.length > 0) {
    await alertSecurityTeam(suspiciousActivity);
  }
};
```

## 緊急時対応

### 1. データ漏洩対応

万が一DBに個人情報が保存されてしまった場合の緊急対応手順:

1. **即座にサービス停止**: 被害拡大防止
2. **データ削除**: 個人情報の完全削除
3. **影響範囲調査**: ログ解析による影響ユーザー特定
4. **当局・ユーザー通知**: GDPR要件に基づく72時間以内通知
5. **再発防止策**: システム修正とプロセス改善

### 2. 外部サービス障害対応

Auth0/WorkOS 障害時の代替手段:

- **キャッシュ機能**: 重要な認証情報の一時的キャッシュ
- **グレースフル縮退**: 個人情報を除いた機能の継続提供
- **障害通知**: ユーザーへの適切な状況説明

## まとめ

この設計により以下を実現します:

✅ **GDPR完全準拠**: 個人情報削除は外部サービスで完結  
✅ **データ主権の確保**: Auth0/WorkOS がデータの権威ソース  
✅ **運用負荷軽減**: 個人情報保護の責任を外部サービスに委託  
✅ **セキュリティ向上**: 個人情報の分散保存によるリスク軽減  
✅ **開発効率化**: 型安全性によるコンパイル時チェック  

この設計は、プライバシー重視の現代的なプラットフォームとして必要不可欠な基盤となります。