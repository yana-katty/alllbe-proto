# WorkOS Organization 設計方針

## 概要

Alllbe では WorkOS を使用して Enterprise Ready な Organization 管理を実現します。

参考: [Model your B2B SaaS with Organizations - WorkOS Blog](https://workos.com/blog/model-your-b2b-saas-with-organizations)

## Organization と Workspace の関係

### Enterprise Organization (Single Workspace)

**Enterprise プランの組織は1つのWorkspaceのみ強制**

```
┌─────────────────────────────────────────────────┐
│         Enterprise Organization                 │
│  - SSO 必須                                      │
│  - ドメイン制限                                  │
│  - 高度なセキュリティ                            │
├─────────────────────────────────────────────────┤
│           ▼ 1対1の関係                          │
│         Single Workspace                        │
│  - すべてのユーザーが同じWorkspaceを共有        │
│  - 統一された管理・権限体系                      │
│  - Experienceは全員がアクセス可能               │
└─────────────────────────────────────────────────┘
```

**理由**:
- **セキュリティ**: Enterprise ユーザーはSSO・ドメイン制限により厳格に管理
- **一元管理**: 全社的なガバナンスが容易
- **シンプルさ**: 複雑な権限管理を避け、Organization = Workspace として扱える

### Standard Organization (Multiple Workspace)

**Standard プランの組織は複数のWorkspaceを作成可能**

```
┌─────────────────────────────────────────────────┐
│        Standard Organization                    │
│  - 通常の認証                                    │
│  - 柔軟な構成                                    │
├─────────────────────────────────────────────────┤
│           ▼ 1対多の関係                         │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│   │Workspace 1│  │Workspace 2│  │Workspace 3│ │
│   │  (Tokyo)  │  │  (Osaka)  │  │  (Online) │ │
│   │  Team A   │  │  Team B   │  │  Project  │ │
│   └───────────┘  └───────────┘  └───────────┘ │
└─────────────────────────────────────────────────┘
```

**理由**:
- **柔軟性**: チーム・地域・プロジェクト単位でWorkspaceを分割
- **スケーラビリティ**: 組織成長に応じてWorkspaceを追加
- **コスト最適化**: 小規模から始めて段階的に拡大

## 現在の実装スコープ

### Phase 1 (MVP): Multiple Workspace のみ実装

**対象**: Standard Organization のみ

- Organization 作成時、デフォルトで1つのWorkspaceを作成
- Workspace は Organization に紐づく（1対多）
- Experience・Booking は Workspace に紐づく
- ユーザーは複数の Workspace にアクセス可能

**実装優先度**:
1. ✅ WorkOS Organization Activities (プリミティブAPI呼び出し)
2. ✅ DB Organization Model (workos_organization_id カラム)
3. ⏳ Workspace CRUD (DB スキーマ・Activity)
4. ⏳ Organization Workflow (WorkOS + DB の協調)
5. ⏳ Organization Actions (読み取り時の WorkOS データ統合)

### Phase 2 (Future): Single Workspace (Enterprise)

**対象**: Enterprise Organization

- Organization 作成時、Workspace を作成しない（Organization = Workspace）
- SSO 必須設定・ドメイン制限の実装
- 高度なセキュリティ・監査機能
- Enterprise 固有の料金・制限設定

## データモデル設計

### DB Schema

```sql
-- Organizations: 自社DBで管理する基本情報のみ
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    workos_organization_id VARCHAR(255) UNIQUE,  -- WorkOS Organization ID
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    -- 基本情報のみ、個人情報・Enterprise 設定は WorkOS で管理
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

-- Experiences: Workspace に紐づく
CREATE TABLE experiences (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),  -- NOT organization_id
    -- ... other fields
);
```

### WorkOS Organization (外部管理)

WorkOS が管理する情報:
- Organization の詳細情報（legal_name, industry, etc.）
- ドメイン・SSO 設定
- Organization 配下の管理ユーザーの個人情報・権限
- Enterprise 設定（SSO 必須、MFA 必須等）

## Activity 設計原則

### プリミティブな操作のみ

**✅ GOOD - 単一のAPI呼び出し**:
```typescript
export const createWorkosOrganization = (client: WorkOS) =>
    (input: { name: string; domains: string[] }): ResultAsync<WorkosOrganization, WorkosError> => {
        return ResultAsync.fromPromise(
            client.organizations.createOrganization({
                name: input.name,
                domainData: input.domains.map(domain => ({ domain, state: 'pending' })),
            }),
            mapWorkosError
        );
    };
```

**❌ BAD - 複数のAPI呼び出しを組み合わせ**:
```typescript
// ❌ これは Workflow で実装すべき
export const inviteWorkosOrganizationUser = (client: WorkOS) =>
    (organizationId: string, input: WorkosUserInviteInput) => {
        // 1. User 作成
        const user = await client.userManagement.createUser({ ... });
        // 2. Organization に関連付け
        await client.userManagement.createOrganizationMembership({ ... });
        // → これは Workflow の責務
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
        // Step 1: WorkOS User 作成
        const user = await createWorkosUser({ 
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
        });
        compensations.unshift({
            message: 'reversing WorkOS user creation',
            fn: () => deleteWorkosUser(user.id),
        });

        // Step 2: Organization Membership 作成
        await createWorkosOrganizationMembership({
            userId: user.id,
            organizationId,
        });

        // Step 3: DB に User 情報を保存
        const dbUser = await createOrganizationUserActivity({
            workosUserId: user.id,
            organizationId,
            ...input,
        });

        return dbUser;
    } catch (error) {
        await compensate(compensations);
        throw error;
    }
}
```

## 今後の拡張

### Enterprise Organization 対応

1. **Organization 作成時にプラン判定**:
   - Enterprise → 親 Enterprise workspace に紐づく
   - Standard  → 紐づかないかつ 1 つの Organization のみの所属制限

2. **SSO・ドメイン制限の実装**:
   - WorkOS SSO Connection の設定
   - ドメイン認証の強制

3. **料金・制限管理**:
   - Experience 作成数制限
   - 月間予約数制限
   - API アクセス制御

### Multiple Organization 拡張

1. **Organization 管理UI**:
   - Enterprise workspace 管理者が Organization を作成・編集・削除

2. **Organization 単位の権限管理**:
   - Organization Admin / Member の役割
   - Experience アクセス制御

3. **Organization 統計・分析**:
   - Organization 単位の売上・予約レポート
   - クロス Organization 分析

## まとめ

- **MVP (Phase 1)**: Standard Organization のみ実装
- **MVP (Phase 2)**: Enterprise Organization の実装
- **Activity 設計**: プリミティブな操作のみ、複雑な処理は Workflow で調整
- **データ分離**: DB は参照情報のみ、個人情報・Enterprise 設定は WorkOS で管理
