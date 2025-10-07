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

### Phase 1.5: Brand導入 - ドキュメント整理（完了✅）
- [x] Brand要件定義ドキュメント作成
- [x] auth.instructions.md 更新（Workspace → Brand）
- [x] business-requirements.instructions.md 更新
- [x] database.instructions.md 更新
- [x] schema.ts へのBrandテーブル追加
- [x] マイグレーションファイル作成

### Phase 1.5: Brand導入 - 実装作業（次のタスク🚀）

#### 1. マイグレーション実行とDB確認
```bash
cd backend
npm run db:migrate
# または
npm run db:push  # 開発環境の場合
```

**確認事項**:
- [ ] `brands` テーブルが作成されていること
- [ ] 既存の `organizations` に対してデフォルトBrandが作成されていること
- [ ] `experiences.brand_id` カラムが追加され、既存データが正しく紐づいていること
- [ ] インデックスが正しく作成されていること

#### 2. Brand Activity 実装（backend/src/activities/db/models/brand.ts）
```typescript
// 以下の関数を実装:
// - insertBrand(db: Database): InsertBrand
// - findBrandById(db: Database): FindBrandById
// - findBrandsByOrganizationId(db: Database): FindBrandsByOrganizationId
// - findDefaultBrandByOrganizationId(db: Database): FindDefaultBrandByOrganizationId
// - updateBrand(db: Database): UpdateBrand
// - deleteBrand(db: Database): DeleteBrand
// - countBrandsByOrganizationId(db: Database): CountBrandsByOrganizationId
```

**エラーハンドリング**:
- [ ] `BrandErrorType` enum の定義（NOT_FOUND, ALREADY_EXISTS, LIMIT_REACHED, HAS_DEPENDENCIES, etc.）
- [ ] `createBrandError` ファクトリ関数の実装
- [ ] ApplicationFailure による統一的なエラー処理

#### 3. Brand Actions 実装（backend/src/actions/brand.ts）
```typescript
// 以下のビジネスロジック関数を実装:
// - canCreateBrand(): プラン制限チェック（Standard: 1, Enterprise: 100）
// - createBrand(): Brand作成（制限チェック含む）
// - getBrandById(): Brand取得
// - listBrandsByOrganization(): Organization配下のBrand一覧
// - updateBrand(): Brand更新
// - deleteBrand(): Brand削除（依存関係チェック含む）
```

#### 4. Brand Workflow 実装（backend/src/workflows/brand.ts）
```typescript
// 以下のWorkflowを実装:
// - createBrandWorkflow(): Brand作成（SAGAパターン）
// - updateBrandWorkflow(): Brand更新
// - deleteBrandWorkflow(): Brand削除（Experience等のチェック）
```

**重要**: Organization作成Workflowも更新が必要
- `backend/src/workflows/organization.ts` の `createOrganizationWorkflow` 内で、
  Organization作成後に自動でデフォルトBrandを作成するステップを追加

#### 5. Brand tRPC エンドポイント実装（backend/src/trpc/brand.ts）
```typescript
export const brandRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => { /* ... */ }),
  
  create: protectedProcedure  // Enterpriseプランのみ
    .input(z.object({ organizationId: z.string(), name: z.string(), ... }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  update: protectedProcedure
    .input(z.object({ brandId: z.string(), name: z.string().optional(), ... }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  delete: protectedProcedure  // Enterpriseプランのみ
    .input(z.object({ brandId: z.string() }))
    .mutation(async ({ input }) => { /* ... */ }),
});
```

#### 6. 既存コードの更新
- [ ] `backend/src/activities/db/models/experience.ts`: `organizationId` → `brandId` に変更
- [ ] `backend/src/actions/experience.ts`: Brand経由のアクセス制御に変更
- [ ] `backend/src/workflows/experience.ts`: Brand検証ステップの追加
- [ ] `backend/src/trpc/experience.ts`: Brand IDを使用するように変更

#### 7. テストの実装
- [ ] `backend/src/activities/db/models/brand.test.ts`: Activity単体テスト
- [ ] `backend/src/actions/brand.test.ts`: Actions単体テスト
- [ ] `backend/src/workflows/brand.test.ts`: Workflow統合テスト

### Phase 2: Enterprise機能（将来実装）
- [ ] 複数Brand作成UI
- [ ] Brand間の統合レポート
- [ ] Brand別権限管理（brand_memberships テーブル）
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

## 次のエージェントへの引き継ぎ事項

### 📋 実装完了（2025年10月7日）

**✅ Phase 1.5: Brand導入 - 完全実装済み**:

1. **データベース層**:
   - ✅ `brands` テーブル作成（schema.ts + マイグレーション）
   - ✅ `experiences.brandId` への移行（organizationId → brandId）
   - ✅ インデックスと外部キー制約の設定

2. **Activity層**（backend/src/activities/db/models/brand.ts）:
   - ✅ 7つのBrand Activity関数実装
   - ✅ ApplicationFailureベースのエラーハンドリング
   - ✅ 16テスト（全通過）

3. **Actions層**（backend/src/actions/brand.ts）:
   - ✅ 9つのBrand Actions実装
   - ✅ プラン制限チェック（Standard: 1個、Enterprise: 100個）
   - ✅ 22テスト（全通過）

4. **Workflow層**（backend/src/workflows/brand.ts + organization.ts）:
   - ✅ Brand作成・更新・削除Workflow（SAGAパターン）
   - ✅ Organization作成時のデフォルトBrand自動作成
   - ✅ 補償処理の完全実装

5. **tRPC API層**（backend/src/trpc/brand.ts）:
   - ✅ 6エンドポイント（list/getById/getDefault/create/update/delete）
   - ✅ Temporal Workflowとの統合
   - ✅ 1スモークテスト（全通過）

6. **Experience層のBrand移行**:
   - ✅ Experience Activity層でのbrandId利用
   - ✅ 既存コードの更新完了

7. **テスト**:
   - ✅ 合計46テスト全通過（Brand: 39, Organization: 7）
   - ✅ テスト戦略の確立と文書化

**Phase 1.5は完全に完了しています。次フェーズへ進む準備が整いました。**

### 🎯 実装時の重要ポイント

#### Standard プラン（Phase 1）の制約
```typescript
// Brand数制限: 1つのみ（Organization作成時に自動作成）
// - isDefault: true のBrandが1つだけ存在
// - UI上でBrand作成ボタンは非表示
// - API層でも追加作成を拒否

// メンバー数制限: 10人まで（WorkOS側でチェック）
export async function canInviteMember(
    organizationId: string, 
    planType: 'standard' | 'enterprise'
): Promise<boolean> {
    const members = await workos.userManagement.listOrganizationMemberships({
        organizationId,
    });
    return planType === 'standard' 
        ? members.data.length < 10 
        : members.data.length < 1000;
}
```

#### エラーハンドリングパターン
```typescript
// backend/src/activities/db/models/brand.ts
export enum BrandErrorType {
    NOT_FOUND = 'BRAND_NOT_FOUND',
    ALREADY_EXISTS = 'BRAND_ALREADY_EXISTS',
    LIMIT_REACHED = 'BRAND_LIMIT_REACHED',
    HAS_DEPENDENCIES = 'BRAND_HAS_DEPENDENCIES',
    INVALID_INPUT = 'BRAND_INVALID_INPUT',
    DATABASE_ERROR = 'BRAND_DATABASE_ERROR',
}

export const createBrandError = (info: BrandErrorInfo): ApplicationFailure => {
    return ApplicationFailure.create({
        message: info.message,
        type: info.type,
        details: info.details ? [info.details] : undefined,
        nonRetryable: info.nonRetryable ?? true,
    });
};
```

#### Organization作成時のデフォルトBrand作成
```typescript
// backend/src/workflows/organization.ts
export async function createOrganizationWorkflow(
    input: CreateOrganizationInput
): Promise<Organization> {
    const compensations: Compensation[] = [];
    
    try {
        // Step 1: WorkOS Organization 作成
        const workosOrg = await createWorkosOrganizationActivity({ ... });
        compensations.unshift({ ... });

        // Step 2: DB に Organization 保存
        const org = await insertOrganizationActivity({ id: workosOrg.id });
        compensations.unshift({ ... });

        // Step 3: デフォルトBrand作成（新規追加）⭐
        const defaultBrand = await insertBrandActivity({
            organizationId: org.id,
            name: 'Default Brand', // または Organization名を使用
            isDefault: true,
            isActive: true,
        });
        compensations.unshift({
            message: 'reversing default brand creation',
            fn: () => deleteBrandActivity(defaultBrand.id),
        });

        return org;
    } catch (error) {
        await compensate(compensations);
        throw error;
    }
}
```

### 📚 参考資料

**実装パターン参考**:
- `backend/src/activities/db/models/organization.ts`: 基本的なActivity実装パターン
- `backend/src/actions/organization.ts`: Actions層の依存注入パターン
- `backend/src/workflows/organization.ts`: Workflow + SAGAパターン
- `backend/src/trpc/organization.ts`: tRPCエンドポイント実装

**設計ドキュメント**:
- `.github/instructions/activities.instructions.md`: Activity実装ガイドライン
- `.github/instructions/actions.instructions.md`: Actions実装ガイドライン
- `.github/instructions/workflows.instructions.md`: Workflow実装ガイドライン
- `.github/instructions/trpc.instructions.md`: tRPC実装ガイドライン
- `.github/instructions/testing.instructions.md`: テスト実装ガイドライン

### ⚠️ 注意事項

1. **マイグレーション実行後の確認必須**:
   - 既存の全OrganizationにデフォルトBrandが作成されているか
   - 既存のExperienceがBrandに正しく紐づいているか

2. **後方互換性**:
   - 既存のExperience関連のAPIは、Brand経由でもアクセス可能にする
   - Organization IDからBrand IDへの変換ロジックが必要な場合がある

3. **プラン制限の実装**:
   - Standard プランでは UI 上で Brand 作成ボタンを非表示
   - API層でも `BRAND_LIMIT_REACHED` エラーで拒否
   - Enterprise プランへのアップグレードパスを考慮

4. **Brand削除時の依存関係チェック**:
   - Experience、Booking等が存在する場合は削除不可
   - デフォルトBrand（isDefault: true）は削除不可

### 🧪 テスト戦略

```typescript
// 優先的にテストすべき項目:
// 1. Brand作成時のプラン制限チェック（Standard: 1個まで）
// 2. デフォルトBrandの自動作成（Organization作成時）
// 3. Brand削除時の依存関係チェック（Experience存在時は削除不可）
// 4. Experience → Brand → Organization の参照整合性
// 5. ApplicationFailure による適切なエラーハンドリング
```

実装を開始する際は、上記の「Phase 1.5: Brand導入 - 実装作業」のチェックリストに従って進めてください。
