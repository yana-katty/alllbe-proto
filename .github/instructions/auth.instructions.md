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

## WorkOS Organization 設計: Single vs Multiple Workspace

参考: [Model your B2B SaaS with Organizations - WorkOS Blog](https://workos.com/blog/model-your-b2b-saas-with-organizations)

### Enterprise Organization (Single Workspace) - Phase 2実装予定

**Enterprise プランは1つのWorkspaceのみ強制**:

```
Enterprise Organization
  ↓ (1対1)
Single Workspace
  - 全ユーザーが同じWorkspaceを共有
  - SSO必須・ドメイン制限
  - 統一された管理体系
```

**メリット**:
- セキュリティ強化（SSO・ドメイン制限）
- 一元管理が容易
- シンプルな権限体系

### Standard Organization (Multiple Workspace) - Phase 1実装中

**Standard プランは複数のWorkspaceを作成可能**:

```
Standard Organization
  ↓ (1対多)
Multiple Workspaces
  - チーム・地域・プロジェクト単位で分割
  - 柔軟な構成
  - 段階的な拡大が可能
```

**メリット**:
- 柔軟性（チーム・拠点ごとに分離）
- スケーラビリティ
- コスト最適化

### 現在の実装スコープ (MVP: Phase 1)

**Multiple Workspace のみ実装**:
- Organization 作成時、デフォルトで1つのWorkspaceを作成
- Workspace は Organization に紐づく（1対多）
- Experience・Booking は Workspace に紐づく
- ユーザーは複数の Workspace にアクセス可能

**Phase 2での拡張**:
- Enterprise Organization は Single Workspace
- SSO 必須設定・ドメイン制限
- Organization = Workspace として扱う

## Activity 設計原則

### プリミティブな操作のみ

**Activity は単一のAPI呼び出しのみを行う**:

✅ **GOOD - 単一のAPI呼び出し**:
```typescript
export const createWorkosOrganization = (client: WorkOS) =>
    (input: { name: string; domains: string[] }) => {
        return ResultAsync.fromPromise(
            client.organizations.createOrganization({ ... }),
            mapWorkosError
        );
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
-- Organizations: 自社DBで管理する基本情報のみ
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    workos_organization_id VARCHAR(255) UNIQUE,  -- WorkOS Organization ID
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Workspaces: Standard Organization 用の複数 Workspace 対応
CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Experiences: Workspace に紐づく（NOT organization_id）
CREATE TABLE experiences (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    -- ... other fields
);
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
- **MVP (Phase 1)**: Multiple Workspace のみ実装（Standard Organization）
- **Future (Phase 2)**: Single Workspace 追加（Enterprise Organization）

### データ分離
- **Auth0**: エンドユーザーの個人情報・認証情報
- **WorkOS**: Organization・管理ユーザーの情報・Enterprise 設定
- **自社DB**: ID参照のみ、Experience・Booking・統計データ

詳細は `backend/src/activities/auth/workos/README.md` を参照してください。
