---
applyTo: "backend/src/activities/auth/**"
---

# 認証・データ管理指示書: Auth0/WorkOS 責務分離アーキテクチャ + Temporal Integration

## 適用範囲

この指示書は `backend/src/activities/auth/**` および `backend/src/workflows/**` の認証関連ワークフローに適用されます。

## アーキテクチャ概要

### Temporal Activity/Workflow パターン

```
┌─────────────────────────────────────────────────────────────┐
│                    Temporal Workflows                      │
│ ┌─────────────────┬─────────────────┬─────────────────────┐ │
│ │  EndUser        │  Organization   │  OrganizationUser   │ │
│ │  Workflows      │  Workflows      │  Workflows          │ │
│ │                 │                 │                     │ │
│ │ • create        │ • create        │ • invite            │ │
│ │ • update        │ • update        │ • update            │ │
│ │ • delete        │ • delete        │ • delete            │ │
│ │ • get           │ • get           │ • get               │ │
│ └─────────────────┴─────────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Individual Activities                   │
│ ┌─────────────────┬─────────────────┬─────────────────────┐ │
│ │  Auth0          │  WorkOS         │  DB Integration     │ │
│ │  Activities     │  Activities     │  Activities         │ │
│ │                 │                 │                     │ │
│ │ • getUser       │ • getOrg        │ • getDbUser         │ │
│ │ • createUser    │ • createOrg     │ • createDbUser      │ │
│ │ • updateUser    │ • updateOrg     │ • updateDbUser      │ │
│ │ • deleteUser    │ • deleteOrg     │ • markDeleted       │ │
│ └─────────────────┴─────────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 責務分離の基本原則

```
┌─────────────────┬─────────────────┬─────────────────┐
│     Auth0       │     WorkOS      │     自社DB      │
│ (エンドユーザー)  │  (Organization) │  (ID参照のみ)    │
├─────────────────┼─────────────────┼─────────────────┤
│ ✅ 個人情報      │ ❌              │ ❌              │
│ ✅ 認証情報      │ ❌              │ 📋 ID参照       │
│ ❌              │ ✅ 企業情報      │ ❌              │
│ ❌              │ ✅ 管理ユーザー  │ 📋 ID参照       │
│ ❌              │ ✅ SSO設定      │ ❌              │
│ ❌              │ ❌              │ ✅ Experience   │
│ ❌              │ ❌              │ ✅ Booking      │
│ ❌              │ ❌              │ ✅ 統計データ   │
└─────────────────┴─────────────────┴─────────────────┘
```

## WorkOS Organization と Brand の関係設計

参考: [Model your B2B SaaS with Organizations - WorkOS Blog](https://workos.com/blog/model-your-b2b-saas-with-organizations)

### アーキテクチャ概要

WorkOS Organization が最上位エンティティであり、その配下に **Brand（ブランド）** を配置します：

```
WorkOS Organization (WorkOS管理)
  ↓ (1対1 または 1対多、プランによって異なる)
Brand (自社DB管理)
  ↓ (1対多)
Experience (体験コンテンツ)
  ↓ (1対多)
Booking (予約)
```

### Standard プラン (Phase 1実装中)

**小規模事業者向け、シンプルな運営体制**:

```
WorkOS Organization
  ↓ (1対1)
Single Brand (デフォルト、固定)
  ↓ (1対多)
Experiences
```

**制約**:
- **Brand数**: 1つのみ（固定、追加作成不可）
- **メンバー数**: 最大10人
- **SSO**: 不要（Email/Passwordログイン）
- **ドメイン制限**: なし

**用途**: 個人クリエイター、小規模チーム、スタートアップ

**実装**:
- Organization作成時に自動で1つのデフォルトBrand（`isDefault: true`）を作成
- Brand削除は不可（Organization削除時に連動削除）
- UI上でBrand作成ボタンを非表示

### Enterprise プラン (Phase 2実装予定)

**大企業向け、複数ブランド・拠点の統合管理**:

```
WorkOS Organization
  ↓ (1対多)
Multiple Brands (最大100個)
  ↓ (1対多)
Experiences
```

**機能**:
- **Brand数**: 最大100個
- **メンバー数**: 無制限（または高い上限、例: 1,000人）
- **SSO**: 必須（WorkOS SSO統合）
- **ドメイン制限**: 有効化可能

**用途**: 複数ブランド運営企業、多拠点展開企業、大規模組織

**実装**:
- Brandの自由な作成・編集・削除
- Brand間の統合レポート・分析
- Brand別の権限管理・アクセス制御
- SSO経由での厳格な従業員管理

## Activity 設計原則

### プリミティブな操作のみ

**Activity は単一のAPI呼び出しのみを行う**:

✅ **GOOD - 単一のAPI呼び出し**:
```typescript
export const createWorkosOrganization = (client: WorkOS) =>
    async (input: { name: string; domains: string[] }): Promise<WorkosOrganization> => {
        try {
            return await client.organizations.createOrganization({ ... });
        } catch (error) {
            throw createWorkosError({
                type: WorkosErrorType.API_ERROR,
                message: 'Failed to create organization',
                details: error,
                nonRetryable: false,
            });
        }
    };
```

❌ **BAD - 複数のAPI呼び出しを組み合わせ**:
```typescript
// ❌ これは Workflow で実装すべき
export const inviteWorkosOrganizationUser = (client: WorkOS) =>
    (organizationId: string, input: InviteInput) => {
        // 1. User 作成
        const user = await client.userManagement.createUser({ ... });
        // 2. Organization に関連付け
        await client.userManagement.createOrganizationMembership({ ... });
        // → 複数のAPI呼び出しは Workflow の責務
    };
```

### Workflow で調整

複数のActivity呼び出しを組み合わせる処理はWorkflowで実装:

```typescript
// backend/src/workflows/organization.ts
export async function inviteOrganizationUserWorkflow(
    organizationId: string,
    input: InviteUserInput
): Promise<OrganizationUser> {
    const compensations: Compensation[] = [];
    
    try {
        // Step 1: WorkOS User 作成 (Activity)
        const user = await createWorkosUser({ 
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
        });
        compensations.unshift({
            message: 'reversing WorkOS user creation',
            fn: () => deleteWorkosUser(user.id),
        });

        // Step 2: Organization Membership 作成 (Activity)
        await createWorkosOrganizationMembership({
            userId: user.id,
            organizationId,
        });

        // Step 3: DB に User 情報を保存 (Activity)
        const dbUser = await createOrganizationUserActivity({
            workosUserId: user.id,
            organizationId,
            ...input,
        });

        return dbUser;
    } catch (error) {
        // SAGA パターン: 補償処理
        await compensate(compensations);
        throw error;
    }
}
```

## データモデル設計

### DB Schema

```sql
-- Organizations: WorkOS Organization IDの参照テーブル
CREATE TABLE organizations (
    id VARCHAR(255) PRIMARY KEY,  -- WorkOS Organization ID
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Brands: Organization配下のブランド管理
CREATE TABLE brands (
    id UUID PRIMARY KEY,
    organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,  -- Standardプランのデフォルトフラグ
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Experiences: Brand に紐づく（NOT organization_id）
CREATE TABLE experiences (
    id UUID PRIMARY KEY,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    -- ... other fields
);
```

### プラン制限の実装

```typescript
// Brandの制限をチェック
export async function canCreateBrand(
    organizationId: string, 
    planType: 'standard' | 'enterprise'
): Promise<boolean> {
    const existingBrands = await db.select()
        .from(brands)
        .where(eq(brands.organizationId, organizationId));
    
    if (planType === 'standard') {
        // Standardは1つまで（実際は作成済みのため常にfalse）
        return existingBrands.length === 0;
    } else {
        // Enterpriseは100個まで
        return existingBrands.length < 100;
    }
}

// メンバー数の制限をチェック（WorkOS側）
export async function canInviteMember(
    organizationId: string, 
    planType: 'standard' | 'enterprise'
): Promise<boolean> {
    const members = await workos.userManagement.listOrganizationMemberships({
        organizationId,
    });
    
    if (planType === 'standard') {
        // Standardは10人まで
        return members.data.length < 10;
    } else {
        // Enterpriseは無制限（または1000人）
        return members.data.length < 1000;
    }
}
```

### WorkOS Organization (外部管理)

WorkOS が管理する情報:
- Organization の詳細情報（legal_name, industry, etc.）
- ドメイン・SSO 設定
- Organization 配下の管理ユーザーの個人情報・権限
- Enterprise 設定（SSO 必須、MFA 必須等）

**DBには WorkOS の ID のみを保存**:
- `organizations.workos_organization_id`: WorkOS Organization ID
- 個人情報・Enterprise 設定の実体は WorkOS で管理
- GDPR対応: 個人情報削除時は WorkOS での削除のみで完了

## まとめ

### Activity 設計
- ✅ プリミティブな操作のみ（単一のAPI呼び出し）
- ❌ 複数のAPI呼び出しを組み合わせない
- ✅ Workflow で複雑な処理を調整

### Organization 設計
- **MVP (Phase 1)**: Single Brand のみ実装（Standard プラン）
- **Future (Phase 2)**: Multiple Brands 対応（Enterprise プラン）

### データ分離
- **Auth0**: エンドユーザーの個人情報・認証情報
- **WorkOS**: Organization・管理ユーザーの情報・Enterprise 設定
- **自社DB**: ID参照のみ、Experience・Booking・統計データ

詳細は `backend/src/activities/auth/workos/README.md` を参照してください。
