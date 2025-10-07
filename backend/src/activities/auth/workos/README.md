# WorkOS Integration Guide

## 概要

Alllbe では WorkOS を使用して Enterprise Ready な Organization 管理を実現します。

**参考資料**:
- [WorkOS Organizations - Official Docs](https://workos.com/docs/organizations)
- [Model your B2B SaaS with Organizations - WorkOS Blog](https://workos.com/blog/model-your-b2b-saas-with-organizations)

## WorkOS APIキーの取得方法

### 1. WorkOS アカウントの作成

1. [WorkOS Dashboard](https://dashboard.workos.com/signup) にアクセス
2. GitHub または Google アカウントでサインアップ
3. Organization 名を入力（例: "Alllbe Dev"）

### 2. API キーの取得

#### Development 環境（テスト用）

1. WorkOS Dashboard にログイン
2. 左サイドバーから **"API Keys"** を選択
3. **"Test"** タブを開く（Developmentモード）
4. 以下の情報をコピー:
   - **API Key**: `sk_test_...` で始まる秘密鍵
   - **Client ID**: `client_...` で始まる公開ID

#### Production 環境

1. WorkOS Dashboard の **"API Keys"** ページ
2. **"Live"** タブを開く（Productionモード）
3. **"Generate New Key"** をクリック
4. APIキーとClient IDをコピー

⚠️ **重要**: 
- Test環境とLive環境のキーは異なります
- APIキーは一度しか表示されないため、必ず安全に保管してください
- 本番環境のキーは絶対にGitにコミットしないでください

### 3. 環境変数の設定

#### backend/.env（開発環境）

```bash
# WorkOS Configuration (Test Environment)
WORKOS_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx
```

#### backend/.env.test（統合テスト用）

```bash
# WorkOS Configuration (Test Environment for Integration Tests)
WORKOS_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx

# Database Configuration
DATABASE_URL=postgresql://test:test@localhost:5432/alllbe_test
```

#### backend/.env.production（本番環境）

```bash
# WorkOS Configuration (Live Environment)
WORKOS_API_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx

# Database Configuration
DATABASE_URL=postgresql://...
```

### 4. .gitignore の確認

以下のファイルが `.gitignore` に含まれていることを確認してください:

```
.env
.env.local
.env.test
.env.production
.env*.local
```

## Organization と Brand の関係

### 現在の設計（Phase 1: MVP）

Alllbe では **Organization → Brand → Experience** の3階層構造を採用しています。

```
┌─────────────────────────────────────────────────┐
│    WorkOS Organization (外部サービス)            │
│  - 企業・団体の基本情報                          │
│  - SSO・ドメイン設定                             │
│  - Organization メンバー管理                     │
│  - Enterprise セキュリティ設定                   │
└─────────────────┬───────────────────────────────┘
                  │ WorkOS Organization ID
                  ↓
┌─────────────────────────────────────────────────┐
│    DB Organization (自社DB - 参照テーブル)       │
│  - id: WorkOS Organization ID (主キー)          │
│  - isActive: プラットフォーム状態管理            │
│  - 個人情報は保存しない（WorkOSがマスター）      │
└─────────────────┬───────────────────────────────┘
                  │ 1対多（Standard: 1, Enterprise: 100）
                  ↓
┌─────────────────────────────────────────────────┐
│            Brand (ブランド管理)                  │
│  - Organization 配下の複数ブランド               │
│  - Standard: デフォルト1ブランドのみ             │
│  - Enterprise: 最大100ブランド                   │
│  - name, description, logoUrl, websiteUrl       │
└─────────────────┬───────────────────────────────┘
                  │ 1対多
                  ↓
┌─────────────────────────────────────────────────┐
│         Experience (体験イベント)                │
│  - Brand に紐づく Experience                     │
│  - title, description, location, capacity       │
└─────────────────────────────────────────────────┘
```

**設計の特徴**:

1. **WorkOS Organization ID を主キーとして使用**
   - 中間IDが不要、シンプルな設計
   - JOINの高速化、データ整合性の向上
   - 外部サービスとの紐付けが明確

2. **個人情報の二重管理を避ける**
   - WorkOS がマスターデータ
   - DB には状態管理のみ（isActive）
   - GDPR 対応: WorkOS での削除のみで完了

3. **Brand による柔軟な管理**
   - Standard プラン: 1 Brand（デフォルト）
   - Enterprise プラン: 最大100 Brands
   - マルチブランド運営に対応

### データモデル設計

#### DB Schema（実装済み）

```typescript
// backend/src/activities/db/schema.ts

// Organizations: WorkOS Organization IDを主キーとして使用
export const organizations = pgTable('organizations', {
    id: varchar('id', { length: 255 }).primaryKey(), // WorkOS Organization ID
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Brands: Organization配下のブランド管理
export const brands = pgTable('brands', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: varchar('organization_id', { length: 255 })
        .notNull()
        .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    websiteUrl: text('website_url'),
    isDefault: boolean('is_default').notNull().default(false), // Standardプラン用
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Experiences: Brand に紐づく
export const experiences = pgTable('experiences', {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
        .notNull()
        .references(() => brands.id, { onDelete: 'cascade' }),
    // ...その他のフィールド
});
```

#### WorkOS Organization（外部管理）

WorkOS が管理する情報:
- **基本情報**: name, legal_name, description, industry
- **ドメイン**: 組織ドメインの管理・検証
- **メンバー**: Organization Admin/Member の管理
- **SSO**: SAML/OIDC 接続設定
- **Enterprise設定**: MFA必須、セッション管理等

### 実装優先度（Phase 1: MVP）

1. ✅ **WorkOS Organization Activities** - プリミティブAPI呼び出し
2. ✅ **DB Organization Model** - WorkOS Organization ID を主キーとして使用
3. ✅ **Brand CRUD** - Organization 配下のブランド管理
4. 🚧 **Organization Workflow** - WorkOS + DB の協調処理（進行中）
5. ⏳ **Organization Actions** - 読み取り時の WorkOS データ統合

### 将来の拡張（Phase 2: Enterprise 機能）

1. **SSO 統合**
   - SAML/OIDC 接続の設定
   - ドメイン認証の強制

2. **高度なセキュリティ**
   - MFA 必須設定
   - セッション管理・監査ログ

3. **プラン制限管理**
   - Experience 作成数制限
   - 月間予約数制限
   - API レート制限


## Activity 設計原則

### プリミティブな操作のみ

**Activity は単一のWorkOS API呼び出しのみを行う**

WorkOS API の呼び出しは、Activity 層で行われます。Activity は以下の原則に従って実装されています:

1. **単一責任**: 1つのActivityは1つのWorkOS API呼び出しのみ
2. **ApplicationFailure**: エラーは ApplicationFailure で統一
3. **依存注入**: WorkOS Client を外部から注入
4. **型安全性**: Zod スキーマで実行時型検証

#### ✅ 推奨パターン - 単一のAPI呼び出し

```typescript
// backend/src/activities/auth/workos/organization.ts

/**
 * WorkOS Organization 作成 Activity
 * 
 * @throws ApplicationFailure (type: WORKOS_DOMAIN_ALREADY_EXISTS)
 * @throws ApplicationFailure (type: WORKOS_INVALID_DOMAIN)
 * @throws ApplicationFailure (type: WORKOS_API_ERROR)
 */
export const createWorkosOrganization = (client: WorkOS) =>
    async (input: { name: string; domains: string[] }): Promise<WorkosOrganization> => {
        try {
            const org = await client.organizations.createOrganization({
                name: input.name,
                domainData: input.domains.map(domain => ({
                    domain,
                    state: 'pending' as any
                })),
            });
            return workosOrganizationSchema.parse({
                id: org.id,
                name: org.name,
                domains: org.domains || [],
                created_at: org.createdAt,
                updated_at: org.updatedAt,
                metadata: {},
            });
        } catch (error) {
            throw mapWorkosError(error);
        }
    };
```

**特徴**:
- 単一のWorkOS API呼び出し（`createOrganization`）
- ApplicationFailure でエラーを統一
- Zod スキーマで実行時型検証

#### ❌ アンチパターン - 複数のAPI呼び出しを組み合わせ

```typescript
// ❌ BAD - これは Workflow で実装すべき
export const createOrganizationWithUser = (client: WorkOS) =>
    async (orgInput, userInput) => {
        // 1. Organization 作成
        const org = await client.organizations.createOrganization({ ... });
        
        // 2. User 作成
        const user = await client.userManagement.createUser({ ... });
        
        // 3. Membership 作成
        await client.userManagement.createOrganizationMembership({ ... });
        
        // → これらの複数API呼び出しは Workflow の責務
    };
```

### Workflow で複数の操作を調整

複数のActivity呼び出しを組み合わせる処理はWorkflowで実装します。

```typescript
// backend/src/workflows/organization.ts
import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type {
    createWorkosOrganization,
    deleteWorkosOrganization,
} from '../activities/auth/workos/organization';
import type {
    insertOrganization,
    insertBrand,
    deleteBrand,
    deleteOrganization,
} from '../activities/db/models';

const workosActivities = proxyActivities<{
    createWorkosOrganization: typeof createWorkosOrganization;
    deleteWorkosOrganization: typeof deleteWorkosOrganization;
}>({
    startToCloseTimeout: '30s',
});

const dbActivities = proxyActivities<{
    insertOrganization: typeof insertOrganization;
    insertBrand: typeof insertBrand;
    deleteBrand: typeof deleteBrand;
    deleteOrganization: typeof deleteOrganization;
}>({
    startToCloseTimeout: '10s',
});

/**
 * Organization 作成 Workflow (SAGAパターン)
 * 
 * WorkOS Organization + DB Organization + Default Brand を作成
 * 失敗時は補償処理で全てのデータを削除
 */
export async function createOrganizationWorkflow(
    input: { name: string; domains: string[] }
): Promise<{ organizationId: string; brandId: string }> {
    let workosOrgId: string | null = null;
    let dbOrgId: string | null = null;
    let defaultBrandId: string | null = null;

    try {
        // Step 1: WorkOS Organization 作成
        const workosOrg = await workosActivities.createWorkosOrganization({
            name: input.name,
            domains: input.domains,
        });
        workosOrgId = workosOrg.id;

        // Step 2: DB Organization 作成
        const dbOrg = await dbActivities.insertOrganization({
            id: workosOrg.id, // WorkOS Organization ID を主キーとして使用
        });
        dbOrgId = dbOrg.id;

        // Step 3: Default Brand 作成
        const defaultBrand = await dbActivities.insertBrand({
            organizationId: dbOrg.id,
            name: `${input.name} - Default`,
            isDefault: true,
        });
        defaultBrandId = defaultBrand.id;

        return {
            organizationId: dbOrg.id,
            brandId: defaultBrand.id,
        };
    } catch (error) {
        // 補償処理 (SAGA Pattern)
        
        // Step 3 の補償: Default Brand 削除
        if (defaultBrandId) {
            try {
                await dbActivities.deleteBrand(defaultBrandId);
            } catch (compensationError) {
                // 補償失敗のログ（Workflow Logger で記録）
            }
        }

        // Step 2 の補償: DB Organization 削除
        if (dbOrgId) {
            try {
                await dbActivities.deleteOrganization(dbOrgId);
            } catch (compensationError) {
                // 補償失敗のログ
            }
        }

        // Step 1 の補償: WorkOS Organization 削除
        if (workosOrgId) {
            try {
                await workosActivities.deleteWorkosOrganization(workosOrgId);
            } catch (compensationError) {
                // 補償失敗のログ
            }
        }

        throw error;
    }
}
```

**Workflow のメリット**:
- **補償処理**: 失敗時に全てのデータをロールバック
- **明確なフロー**: Step 1 → Step 2 → Step 3 の流れが可読性高い
- **テスト容易性**: 各Activityを個別にテスト可能
- **拡張性**: 通知、監査ログなどを追加しやすい

## テスト戦略

### 統合テスト

WorkOS Activities の統合テストは、実際の WorkOS API を使用して実行します。

#### テスト実行方法

1. **環境変数の設定**

```bash
# backend/.env.test を作成
cat > backend/.env.test << EOF
# WorkOS Configuration (Test Environment)
WORKOS_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx

# Database Configuration
DATABASE_URL=postgresql://test:test@localhost:5432/alllbe_test
EOF
```

2. **テスト実行**

```bash
# WorkOS 統合テストのみ実行
npm test -- workos

# 特定のテストスイートを実行
npm test -- organization.test.ts

# watch モードで実行
npm test -- workos --watch
```

#### テストファイルの構造

```typescript
// backend/src/activities/auth/workos/organization.test.ts

describe('WorkOS Organization Activities (Integration)', () => {
    let workosClient: WorkOS;
    const createdOrgIds: string[] = [];

    beforeAll(async () => {
        // WorkOS Client の初期化
        const config = getWorkosConfigFromEnv();
        workosClient = createWorkosClient(config);
        
        // テスト前のクリーンアップ
        await cleanupTestOrganizations();
    });

    afterAll(async () => {
        // テスト後のクリーンアップ
        await cleanupTestOrganizations();
    });

    describe('createWorkosOrganization', () => {
        it('should create organization successfully', async () => {
            const createFn = createWorkosOrganization(workosClient);
            const result = await createFn({
                name: 'Test Org',
                domains: ['test.com'],
            });
            
            createdOrgIds.push(result.id);
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Test Org');
        });
    });
    
    // ...その他のテスト
});
```

**テストのベストプラクティス**:
- ✅ テスト用の固定プレフィックス（`alllbe-test-`）を使用
- ✅ タイムスタンプで重複を避ける
- ✅ テスト後に必ずクリーンアップ
- ✅ ApplicationFailure の type フィールドを検証
- ✅ Test環境のAPIキーを使用（`sk_test_`）

### 単体テスト

Activity 関数自体は純粋関数として実装されているため、モックを使用した単体テストも可能です。

```typescript
import { vi } from 'vitest';
import { createWorkosOrganization } from './organization';
import type { WorkOS } from '@workos-inc/node';

describe('createWorkosOrganization (Unit)', () => {
    it('should call WorkOS API with correct parameters', async () => {
        const mockClient = {
            organizations: {
                createOrganization: vi.fn().mockResolvedValue({
                    id: 'org_123',
                    name: 'Test Org',
                    domains: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }),
            },
        } as unknown as WorkOS;

        const createFn = createWorkosOrganization(mockClient);
        const result = await createFn({
            name: 'Test Org',
            domains: [],
        });

        expect(mockClient.organizations.createOrganization).toHaveBeenCalledWith({
            name: 'Test Org',
            domainData: [],
        });
        expect(result.id).toBe('org_123');
    });
});
```

## 実装済み Activity 一覧

| Activity | 説明 | WorkOS API |
|----------|------|-----------|
| `getWorkosOrganization` | Organization 取得 | `organizations.getOrganization` |
| `getWorkosOrganizationSummary` | Organization サマリー取得 | `organizations.getOrganization` |
| `createWorkosOrganization` | Organization 作成 | `organizations.createOrganization` |
| `updateWorkosOrganization` | Organization 更新 | `organizations.updateOrganization` |
| `deleteWorkosOrganization` | Organization 削除 | `organizations.deleteOrganization` |
| `listWorkosOrganizations` | Organization 一覧取得 | `organizations.listOrganizations` |

## エラーハンドリング

すべてのActivityは ApplicationFailure を使用してエラーを報告します。

### エラータイプ一覧

```typescript
export enum WorkosOrganizationErrorType {
    NOT_FOUND = 'WORKOS_ORGANIZATION_NOT_FOUND',
    ALREADY_EXISTS = 'WORKOS_ORGANIZATION_ALREADY_EXISTS',
    DOMAIN_ALREADY_EXISTS = 'WORKOS_DOMAIN_ALREADY_EXISTS',
    INVALID_DOMAIN = 'WORKOS_INVALID_DOMAIN',
    INSUFFICIENT_PERMISSIONS = 'WORKOS_INSUFFICIENT_PERMISSIONS',
    API_ERROR = 'WORKOS_API_ERROR',
}
```

### エラーハンドリング例

```typescript
try {
    const org = await getWorkosOrganization(client)('org_123');
} catch (error) {
    if (error instanceof ApplicationFailure) {
        switch (error.type) {
            case WorkosOrganizationErrorType.NOT_FOUND:
                // Organization が見つからない場合の処理
                break;
            case WorkosOrganizationErrorType.API_ERROR:
                // WorkOS API エラーの処理（リトライ可能）
                break;
            default:
                // その他のエラー
                break;
        }
    }
}
```

## 参考資料

- [WorkOS Organizations - Official Docs](https://workos.com/docs/organizations)
- [WorkOS Node.js SDK](https://github.com/workos/workos-node)
- [Temporal ApplicationFailure](https://docs.temporal.io/develop/typescript/failure-detection)
- [プロジェクト Architecture Guidelines](../../../.github/instructions/architecture.instructions.md)
- [Backend Layers Instructions](../../../.github/instructions/backend-layers.instructions.md)

---

## クイックスタート: 統合テストの実行

### 1. 環境変数ファイルの作成

```bash
# backend/.env.test.example をコピー
cp .env.test.example .env.test
```

### 2. WorkOS APIキーの取得

1. [WorkOS Dashboard](https://dashboard.workos.com/) にアクセスしてサインアップ
2. 左サイドバーから **"API Keys"** を選択
3. **"Test"** タブを開く（Development環境）
4. **API Key** (`sk_test_...`) と **Client ID** (`client_...`) をコピー

### 3. .env.test に設定

```bash
# backend/.env.test
WORKOS_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. テスト実行

```bash
# WorkOS 統合テストを実行
npm test -- workos

# 特定のテストファイルを実行
npm test -- organization.test.ts

# watch モードで実行
npm test -- workos --watch
```

### トラブルシューティング

#### 環境変数が見つからない

```
❌ Missing required environment variables:
   - WORKOS_API_KEY
   - WORKOS_CLIENT_ID
```

**解決方法**:
1. `.env.test` ファイルが存在するか確認: `ls -la backend/.env.test`
2. APIキーが正しく設定されているか確認: `cat backend/.env.test`
3. Test環境のキー（`sk_test_`で始まる）を使用していることを確認

#### WorkOS API エラー

```
ApplicationFailure: WorkOS API error
```

**解決方法**:
1. WorkOS Dashboard で新しいAPIキーを生成
2. Test環境のAPIキーを使用していることを確認
3. APIキーに必要な権限があることを確認

#### テスト実行時のクリーンアップ

テストは自動的に以下をクリーンアップします:
- テスト中に作成されたOrganization
- `alllbe-test-` プレフィックスで始まる古いOrganization

手動でクリーンアップが必要な場合は、[WorkOS Dashboard](https://dashboard.workos.com/organizations) から削除してください。

---

## まとめ

- ✅ **WorkOS Organization Activities**: 実装済み（CRUD操作）
- ✅ **統合テスト**: `organization.test.ts` で実装済み
- ✅ **エラーハンドリング**: ApplicationFailure で統一
- ✅ **依存注入パターン**: カリー化による疎結合設計
- ✅ **自動クリーンアップ**: テスト前後で自動削除

次のステップ:
1. Organization Workflow の実装（WorkOS + DB の協調）
2. Brand との統合（Organization 作成時にデフォルトBrand作成）
3. Organization Actions の実装（読み取り時のWorkOSデータ統合）

