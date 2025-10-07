---
applyTo: "backend/src/**"
---

# Brand エンティティ要件定義: Organization配下のブランド管理

## 概要

このドキュメントは、WorkOS Organization 配下に配置する「Brand（ブランド）」エンティティの要件を定義します。

## 背景・問題意識

### WorkOS Organization の制約

WorkOS では **Organization が最上位エンティティ** であり、それ以下に細分化する構造が提供されていません。このため、以下の問題が発生します：

1. **Standard vs Enterprise の設計破綻**: 
   - 1つのOrganizationで複数の事業・ブランドを運営したい場合に対応できない
   - プラン間のスケーラビリティが確保できない

2. **マルチブランド運営の困難**: 
   - 企業が複数の独立したブランド・事業部を持つ場合、それぞれを別のOrganizationにする必要がある
   - Organization間の統合管理ができない

### 解決策: Brand エンティティの導入

WorkOS Organization の **下位概念として「Brand（ブランド）」** を導入し、自社DBで管理します。

```
WorkOS Organization (最上位 - WorkOS管理)
  ↓ (1対1 または 1対多、プランによって異なる)
Brand (自社DB管理)
  ↓ (1対多)
Experience (体験コンテンツ)
  ↓ (1対多)
Booking (予約)
```

## プラン設計

### Standard プラン（MVP: Phase 1実装対象）

**特徴**: 小規模事業者向け、シンプルな運営体制

- **Brand数**: 1つのみ（固定）
- **メンバー数**: 最大10人
- **SSO**: 不要（Email/Passwordログイン）
- **ドメイン制限**: なし
- **用途**: 個人クリエイター、小規模チーム、スタートアップ

**制約**:
- Organization作成時に自動で1つのBrandが作成される
- 追加のBrandは作成不可（UI上でも制限）
- Brand削除は不可（Organization削除時に連動削除）

### Enterprise プラン（Phase 2実装予定）

**特徴**: 大企業向け、複数ブランド・拠点の統合管理

- **Brand数**: 最大100個
- **メンバー数**: 無制限（または高い上限、例: 1,000人）
- **SSO**: 必須（WorkOS SSO統合）
- **ドメイン制限**: 有効化可能
- **用途**: 複数ブランド運営企業、多拠点展開企業、大規模組織

**機能**:
- Brandの自由な作成・編集・削除
- Brand間の統合レポート・分析
- Brand別の権限管理・アクセス制御
- SSO経由での厳格な従業員管理

## データモデル設計

### Brand テーブル（新規作成）

```typescript
export const brands = pgTable('brands', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // WorkOS Organization への参照
    organizationId: varchar('organization_id', { length: 255 })
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // Brand基本情報
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    websiteUrl: text('website_url'),
    
    // プラン制限チェック用
    // Standard: isDefault=true のBrandが1つだけ存在
    // Enterprise: 複数のBrandを作成可能
    isDefault: boolean('is_default').notNull().default(false),
    
    // 状態管理
    isActive: boolean('is_active').notNull().default(true),
    
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    // Organization別のBrand検索用
    organizationIdIdx: index('brands_organization_id_idx').on(table.organizationId),
    // Standardプランでのデフォルトチェック用
    orgDefaultIdx: index('brands_org_default_idx').on(table.organizationId, table.isDefault),
}));
```

### Experience テーブルの変更

**変更前**:
```typescript
organizationId: varchar('organization_id', { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
```

**変更後**:
```typescript
brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
```

**影響範囲**:
- `experiences` テーブル: `organization_id` → `brand_id`
- `experienceAssets` テーブル: Experienceに紐づくため変更なし（間接的にBrandに紐づく）
- `bookings` テーブル: Experienceに紐づくため変更なし

## ビジネスルール

### Brand作成ルール

#### Standard プラン
1. **Organization作成時に自動作成**: 
   - Organization作成Workflowで、自動的に1つのデフォルトBrand（`isDefault: true`）を作成
   - Brand名は Organization名を初期値として使用（後で変更可能）

2. **追加作成の禁止**: 
   - UI上でBrand作成ボタンを非表示
   - API層で作成リクエストを拒否（`BRAND_LIMIT_REACHED` エラー）

3. **削除の禁止**: 
   - デフォルトBrandは削除不可
   - Organization削除時のみ連動削除

#### Enterprise プラン
1. **複数Brand作成**: 
   - 最大100個までBrandを作成可能
   - 100個に達した場合は `BRAND_LIMIT_REACHED` エラー

2. **Brand削除**: 
   - Experience・Bookingが存在しない場合のみ削除可能
   - Experience等が存在する場合は `BRAND_HAS_DEPENDENCIES` エラー

### Brand制限のチェック

```typescript
// Brandの制限をチェックする関数
export async function canCreateBrand(
    organizationId: string, 
    planType: 'standard' | 'enterprise'
): Promise<boolean> {
    const existingBrands = await db.select()
        .from(brands)
        .where(eq(brands.organizationId, organizationId));
    
    if (planType === 'standard') {
        // Standardは1つまで
        return existingBrands.length === 0;
    } else {
        // Enterpriseは100個まで
        return existingBrands.length < 100;
    }
}
```

### メンバー制限のチェック（WorkOS側）

```typescript
// Organizationのメンバー数制限をチェック
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

## 権限管理

### Brand単位のアクセス制御

Organization配下の管理ユーザーは、**特定のBrandに対する権限** を持ちます：

```typescript
export const brandMemberships = pgTable('brand_memberships', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    brandId: uuid('brand_id')
        .notNull()
        .references(() => brands.id, { onDelete: 'cascade' }),
    
    // WorkOS User ID (Organization Member)
    workosUserId: varchar('workos_user_id', { length: 255 }).notNull(),
    
    // Brand内での役割
    role: varchar('role', { length: 50 }).notNull(), // 'admin', 'manager', 'viewer'
    
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    brandUserIdx: index('brand_memberships_brand_user_idx')
        .on(table.brandId, table.workosUserId),
}));
```

**役割定義**:
- **admin**: Brand設定の編集、メンバー管理、Experience管理
- **manager**: Experience管理、コンテンツ管理
- **viewer**: 閲覧のみ

## マイグレーション戦略

### Phase 1 → Phase 1.5（Brand導入）

#### ステップ1: Brand テーブル追加
```sql
-- Brand テーブル作成
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX brands_organization_id_idx ON brands(organization_id);
CREATE INDEX brands_org_default_idx ON brands(organization_id, is_default);
```

#### ステップ2: 既存Organizationに対してデフォルトBrandを作成
```sql
-- 既存の全Organizationに対してデフォルトBrandを作成
INSERT INTO brands (organization_id, name, is_default, is_active)
SELECT 
    id, 
    'Default Brand', -- 初期値（後で変更可能）
    TRUE,
    TRUE
FROM organizations;
```

#### ステップ3: Experience テーブルに brand_id カラム追加
```sql
-- brand_id カラム追加（NULL許可）
ALTER TABLE experiences ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;

-- 既存のExperienceに対して、Organizationのデフォルトブランドを関連付け
UPDATE experiences e
SET brand_id = (
    SELECT b.id
    FROM brands b
    WHERE b.organization_id = e.organization_id
    AND b.is_default = TRUE
    LIMIT 1
);

-- brand_id を NOT NULL に変更
ALTER TABLE experiences ALTER COLUMN brand_id SET NOT NULL;

-- organization_id カラムを削除
ALTER TABLE experiences DROP COLUMN organization_id;

-- インデックス追加
CREATE INDEX experiences_brand_id_idx ON experiences(brand_id);
```

## API設計

### Brand管理エンドポイント（tRPC）

```typescript
// backend/src/trpc/brand.ts
export const brandRouter = router({
    // Brand一覧取得（Organization内）
    list: protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ input }) => {
            // Workflow経由でBrand一覧取得
        }),
    
    // Brand作成（Enterpriseプランのみ）
    create: protectedProcedure
        .input(z.object({
            organizationId: z.string(),
            name: z.string(),
            description: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            // プラン制限チェック → Workflow経由で作成
        }),
    
    // Brand更新
    update: protectedProcedure
        .input(z.object({
            brandId: z.string(),
            name: z.string().optional(),
            description: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            // Workflow経由で更新
        }),
    
    // Brand削除（Enterpriseプランのみ、依存関係チェック）
    delete: protectedProcedure
        .input(z.object({ brandId: z.string() }))
        .mutation(async ({ input }) => {
            // 依存関係チェック → Workflow経由で削除
        }),
});
```

## 実装の優先順位

### Phase 1.5: Brand導入（即時実装）
- [x] Brand要件定義ドキュメント作成
- [ ] auth.instructions.md 更新（Workspace → Brand）
- [ ] business-requirements.instructions.md 更新
- [ ] schema.ts へのBrandテーブル追加
- [ ] マイグレーションファイル作成・実行
- [ ] Brand Activity/Workflow 実装
- [ ] Brand tRPC エンドポイント実装
- [ ] Organization作成時のデフォルトBrand自動作成

### Phase 2: Enterprise機能（将来実装）
- [ ] 複数Brand作成UI
- [ ] Brand間の統合レポート
- [ ] Brand別権限管理
- [ ] SSO統合強化

## 参考資料

- [WorkOS Organizations Documentation](https://workos.com/docs/user-management/organizations)
- [Model your B2B SaaS with Organizations - WorkOS Blog](https://workos.com/blog/model-your-b2b-saas-with-organizations)
- `auth.instructions.md`: 認証・Organization管理の全体設計
- `business-requirements.instructions.md`: ビジネス要件全体

## まとめ

**Brand エンティティの導入により、以下を実現**:

1. **柔軟なプラン設計**: Standard（1 Brand）→ Enterprise（100 Brands）への自然な拡張
2. **WorkOS制約の回避**: Organization配下での細分化構造を自社DB側で実現
3. **マルチブランド運営**: 大企業の複数ブランド・事業部管理に対応
4. **段階的実装**: Phase 1ではStandardプラン（1 Brand）のみ、Phase 2でEnterprise機能を追加
