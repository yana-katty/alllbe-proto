---
applyTo: "backend/src/**/*.test.ts"
---

# Testing Instructions: Alllbe Backend テストガイドライン

## テストファイル命名規則

### ファイル命名パターン
- **Workflow テスト**: `{feature}.workflow.test.ts`
- **Activity テスト**: `{feature}.activity.test.ts`
- **Domain ロジックテスト**: `{feature}.domain.test.ts`
- **tRPC ハンドラテスト**: `{feature}.trpc.test.ts`

### 配置場所
- テストファイルは**テスト対象と同じディレクトリ**に配置
- `__tests__` ディレクトリは使用しない
- 例:
  ```
  backend/src/workflows/
  ├── organization.ts
  └── organization.workflow.test.ts
  ```

## Temporal Workflow テスト

### 基本方針

1. **TestWorkflowEnvironment を使用**: Temporal のテストサーバーを起動し、時間スキップ機能を活用
2. **Activity のモック**: 実際の Activity を実行せず、Workflow のロジックのみをテスト
3. **Worker.runUntil()**: Workflow 完了まで待機してテスト
4. **成功・失敗の両方をテスト**: 正常系とエラー系の包括的なテスト

### テストテンプレート

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { randomUUID } from 'crypto';

describe('Feature Workflows', () => {
    let testEnv: TestWorkflowEnvironment;

    // テスト環境のセットアップ - 時間スキップ可能なテストサーバーを起動
    beforeAll(async () => {
        testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    });

    // テスト環境のクリーンアップ
    afterAll(async () => {
        await testEnv?.teardown();
    });

    describe('createFeatureWorkflow', () => {
        it('should create feature successfully', async () => {
            // モック Activity の作成
            const mockActivities = {
                createFeatureActivity: async (input) => {
                    return {
                        ok: true,
                        value: { id: randomUUID(), ...input },
                    };
                },
            };

            // Worker の作成
            const worker = await Worker.create({
                connection: testEnv.nativeConnection,
                taskQueue: 'test',
                workflowsPath: require.resolve('./feature'),
                activities: mockActivities,
            });

            // Workflow の実行
            const result = await worker.runUntil(
                testEnv.client.workflow.execute('createFeatureWorkflow', {
                    workflowId: randomUUID(),
                    taskQueue: 'test',
                    args: [{ name: 'Test' }],
                })
            );

            // アサーション
            expect(result).toBeDefined();
            expect(result.name).toBe('Test');
        });

        it('should throw error when operation fails', async () => {
            const mockActivities = {
                createFeatureActivity: async () => {
                    return {
                        ok: false,
                        error: {
                            code: 'DATABASE',
                            message: 'Database error',
                        },
                    };
                },
            };

            const worker = await Worker.create({
                connection: testEnv.nativeConnection,
                taskQueue: 'test',
                workflowsPath: require.resolve('./feature'),
                activities: mockActivities,
            });

            await expect(
                worker.runUntil(
                    testEnv.client.workflow.execute('createFeatureWorkflow', {
                        workflowId: randomUUID(),
                        taskQueue: 'test',
                        args: [{ name: 'Test' }],
                    })
                )
            ).rejects.toThrow('Database error');
        });
    });
});
```

### Workflow テストのベストプラクティス

1. **UUID 生成**: `crypto.randomUUID()` を使用（外部パッケージ不要）
2. **型安全なモック**: Activity の戻り値の型を厳密に定義
3. **Result 型パターン**: `{ ok: true, value: T }` または `{ ok: false, error: E }` の形式
4. **時間スキップ**: `testEnv.sleep()` で手動で時間を進めることも可能
5. **独立したテスト**: 各テストは独立して実行可能にする

## Activity テスト

### 基本方針

Activity は通常の TypeScript 関数として実装されているため、**通常の単体テストとして実行**します。Temporal 固有の機能（Context など）を使う場合のみ、`MockActivityEnvironment` を使用します。

**DB操作Activityのテスト戦略**:
- **推奨**: PGlite を使用した実際のDB操作テスト（モックではなく実際のPostgreSQL互換環境）
- **利点**: 実際のSQL実行により、スキーマ変更・制約・インデックスの動作を検証可能
- **代替**: モックを使用した単体テスト（シンプルなロジックのみの場合）

### テストテンプレート（PGlite を使用した実際のDB操作テスト）

**推奨パターン**: DB操作Activityは実際のPostgreSQL互換環境でテストすることで信頼性を向上

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ApplicationFailure } from '@temporalio/common';
import {
    insertBrand,
    findBrandById,
    updateBrand,
    deleteBrand,
    BrandErrorType,
    type BrandCreateInput,
    type BrandUpdateInput,
} from './brand';
import {
    setupTestDb,
    teardownTestDb,
    cleanDatabase,
    createTestOrganization,
} from '../../../test/setup';
import type { Database } from '../connection';

describe('Brand Activity Functions (PGlite)', () => {
    let db: Database;

    // テスト環境のセットアップ - PGlite（メモリ内PostgreSQL互換DB）を起動
    beforeAll(async () => {
        db = await setupTestDb();
    });

    // テスト環境のクリーンアップ
    afterAll(async () => {
        await teardownTestDb();
    });

    // 各テスト前にDBをクリア（テスト間の独立性を確保）
    beforeEach(async () => {
        await cleanDatabase();
    });

    describe('insertBrand', () => {
        it('should create brand successfully', async () => {
            // テストデータ準備（実際のOrganizationレコードを作成）
            const orgId = await createTestOrganization('org_test_1');

            const input: BrandCreateInput = {
                organizationId: orgId,
                name: 'Test Brand',
                description: 'Test Description',
                isDefault: false,
            };

            // 実際のDB操作を実行
            const insertFn = insertBrand(db);
            const result = await insertFn(input);

            // 実際にDBに保存されたデータを検証
            expect(result.id).toBeDefined();
            expect(result.organizationId).toBe(orgId);
            expect(result.name).toBe('Test Brand');
            expect(result.description).toBe('Test Description');
            expect(result.isDefault).toBe(false);
            expect(result.isActive).toBe(true);
        });

        it('should throw BRAND_INVALID_INPUT for invalid input', async () => {
            const input = {
                organizationId: '',
                name: '',
                isDefault: false,
            } as BrandCreateInput;

            const insertFn = insertBrand(db);

            // ApplicationFailureが投げられることを検証
            await expect(insertFn(input)).rejects.toThrow(ApplicationFailure);

            try {
                await insertFn(input);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.INVALID_INPUT);
            }
        });
    });

    describe('findBrandById', () => {
        it('should return brand when found', async () => {
            const orgId = await createTestOrganization('org_test_2');

            const input: BrandCreateInput = {
                organizationId: orgId,
                name: 'Findable Brand',
                isDefault: false,
            };

            const insertFn = insertBrand(db);
            const created = await insertFn(input);

            // 実際にDBから検索
            const findFn = findBrandById(db);
            const result = await findFn(created.id);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(created.id);
            expect(result?.name).toBe('Findable Brand');
        });

        it('should return null when brand not found', async () => {
            const findFn = findBrandById(db);
            const result = await findFn('00000000-0000-0000-0000-000000000000');

            expect(result).toBeNull();
        });
    });

    describe('updateBrand', () => {
        it('should update brand successfully', async () => {
            const orgId = await createTestOrganization('org_test_3');

            const insertFn = insertBrand(db);
            const created = await insertFn({
                organizationId: orgId,
                name: 'Old Name',
                isDefault: false,
            });

            const patch: BrandUpdateInput = {
                name: 'New Name',
                description: 'Updated Description',
            };

            // 実際にDBを更新
            const updateFn = updateBrand(db);
            const result = await updateFn(created.id, patch);

            expect(result.name).toBe('New Name');
            expect(result.description).toBe('Updated Description');
            expect(result.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
        });

        it('should throw BRAND_NOT_FOUND when brand does not exist', async () => {
            const patch: BrandUpdateInput = {
                name: 'New Name',
            };

            const updateFn = updateBrand(db);

            await expect(updateFn('00000000-0000-0000-0000-000000000000', patch)).rejects.toThrow(ApplicationFailure);

            try {
                await updateFn('00000000-0000-0000-0000-000000000000', patch);
            } catch (error) {
                expect(error).toBeInstanceOf(ApplicationFailure);
                expect((error as ApplicationFailure).type).toBe(BrandErrorType.NOT_FOUND);
            }
        });
    });
});
```

### テストヘルパー設定（backend/src/test/setup.ts）

PGliteを使用した実際のDB操作テストには、以下のヘルパー関数が必要です：

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Database } from '../activities/db/connection';
import * as schema from '../activities/db/schema';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

let testDb: Database;
let pglite: PGlite;

/**
 * テスト用DBのセットアップ
 * - メモリ内にPostgreSQL互換DBを作成
 * - 実際のマイグレーションファイルを適用
 */
export async function setupTestDb(): Promise<Database> {
    // PGliteインスタンス作成（メモリ内DB）
    pglite = new PGlite();

    // Drizzle ORMでラップ
    testDb = drizzle(pglite, { schema }) as Database;

    // 実際のマイグレーションファイルを適用
    await applyMigrations();

    return testDb;
}

/**
 * テスト用DBのクリーンアップ
 */
export async function teardownTestDb(): Promise<void> {
    if (pglite) {
        await pglite.close();
    }
}

/**
 * 実際のマイグレーションファイルを適用
 */
async function applyMigrations(): Promise<void> {
    const migrationPath = join(__dirname, '../../drizzle/0000_empty_plazm.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // SQLをステートメントごとに分割して実行
    const statements = migrationSql
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        try {
            await testDb.execute(sql.raw(statement));
        } catch (error) {
            // すでに存在するオブジェクトのエラーは無視（冪等性のため）
            if (!(error as Error).message.includes('already exists')) {
                throw error;
            }
        }
    }
}

/**
 * テスト前にテーブルをクリア
 */
export async function cleanDatabase(): Promise<void> {
    if (!testDb) {
        throw new Error('Test DB not initialized. Call setupTestDb() first.');
    }

    // 外部キー制約を一時的に無効化してテーブルをクリア
    await testDb.execute(sql`SET session_replication_role = 'replica'`);

    // 全テーブルをTRUNCATEで完全クリア
    const tables = [
        'payments',
        'bookings',
        'experience_assets',
        'experiences',
        'brands',
        'users',
        'organizations',
    ];

    for (const table of tables) {
        await testDb.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`));
    }

    // 外部キー制約を再度有効化
    await testDb.execute(sql`SET session_replication_role = 'origin'`);
}

/**
 * テスト用のヘルパー関数: Organization作成
 */
export async function createTestOrganization(id: string = 'test_org_123'): Promise<string> {
    await testDb.execute(sql`
        INSERT INTO organizations (id, is_active)
        VALUES (${id}, TRUE)
        ON CONFLICT (id) DO NOTHING
    `);
    return id;
}
```

### 依存パッケージ

```json
{
  "devDependencies": {
    "@electric-sql/pglite": "^0.3.10",
    "@temporalio/testing": "^1.13.0",
    "vitest": "^3.2.4"
  }
}
```

### テストテンプレート（モックを使用した単体テスト）

**使用ケース**: シンプルなロジックのみで、実際のDB操作が不要な場合

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createFeatureActivity } from './feature.activity';
import type { Database } from '../db/connection';

describe('Feature Activities', () => {
    describe('createFeatureActivity', () => {
        it('should create feature successfully', async () => {
            // DB のモック
            const mockDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: 'test-id', name: 'Test' }])
                    })
                })
            } as unknown as Database;

            const result = await createFeatureActivity({ name: 'Test' });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.name).toBe('Test');
            }
        });

        it('should return error when database fails', async () => {
            // エラーをシミュレート
            const result = await createFeatureActivity({ name: '' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID');
            }
        });
    });
});
```

### Activity テストのベストプラクティス

1. **PGlite を優先使用**: DB操作Activityは実際のPostgreSQL互換環境でテスト
2. **マイグレーションファイルを使用**: 実際のスキーマ定義を使用してテスト
3. **テスト間の独立性**: beforeEach で cleanDatabase() を実行
4. **ApplicationFailure の検証**: error.type で詳細なエラー種別を確認
5. **エラーケースの網羅**: 正常系と異常系を両方テスト
6. **型安全性**: TypeScript の型推論を最大限活用

## Domain ロジックテスト

### 基本方針

Domain ロジック（ビジネスロジック）は純粋関数として実装し、**依存関数を最小限に絞った単体テスト**を行います。

### テストテンプレート

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createFeature } from './feature.domain';
import type { FeatureActionDeps } from './feature.domain';

describe('Feature Domain Logic', () => {
    describe('createFeature', () => {
        it('should create feature when input is valid', async () => {
            const mockDeps: Pick<FeatureActionDeps, 'insertFeature' | 'findFeatureByName'> = {
                insertFeature: vi.fn().mockResolvedValue({
                    ok: true,
                    value: { id: 'test-id', name: 'Test' }
                }),
                findFeatureByName: vi.fn().mockResolvedValue({
                    ok: true,
                    value: null // 重複なし
                }),
            };

            const logic = createFeature(mockDeps);
            const result = await logic({ name: 'Test' });

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap().data.name).toBe('Test');
            expect(mockDeps.findFeatureByName).toHaveBeenCalledWith('Test');
        });

        it('should return error when feature already exists', async () => {
            const mockDeps: Pick<FeatureActionDeps, 'insertFeature' | 'findFeatureByName'> = {
                insertFeature: vi.fn(),
                findFeatureByName: vi.fn().mockResolvedValue({
                    ok: true,
                    value: { id: 'existing-id', name: 'Test' } // 既存データ
                }),
            };

            const logic = createFeature(mockDeps);
            const result = await logic({ name: 'Test' });

            expect(result.isErr()).toBe(true);
            expect(result._unsafeUnwrapErr().code).toBe('ALREADY_EXISTS');
            expect(mockDeps.insertFeature).not.toHaveBeenCalled();
        });
    });
});
```

### Domain ロジックテストのベストプラクティス

1. **Pick<>で依存を最小化**: 必要な関数のみモック
2. **Result 型の厳密な検証**: `result.isOk()` / `result.isErr()` でアサーション
3. **関数呼び出しの検証**: `toHaveBeenCalledWith()` で引数を確認
4. **エラーパスの網羅**: すべてのエラーケースをテスト

## テスト実行

### コマンド

```bash
# すべてのテストを実行
npm test

# 特定のファイルのみ実行
npm test organization.workflow.test.ts

# watch モードで実行
npm test -- --watch

# カバレッジを測定
npm test -- --coverage
```

### vitest 設定

`backend/vitest.config.ts` に以下の設定を追加（推奨）:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
        },
    },
});
```

## テスト設計の原則

### 1. テストは独立している

- 各テストは他のテストに依存しない
- テスト順序が変わっても結果は同じ
- 共有状態を避ける

### 2. テストは読みやすい

- Arrange（準備）、Act（実行）、Assert（検証）のパターン
- わかりやすいテスト名（何をテストしているか明確に）
- 必要最小限のモック

### 3. テストは高速

- 外部依存を避ける（DB、API など）
- モックを活用
- Temporal TestWorkflowEnvironment の時間スキップ機能を活用

### 4. テストは信頼できる

- flaky なテストを避ける
- 非決定的な要素をモック（日時、ランダム値）
- エラーメッセージが明確

## テストカバレッジ目標

- **全体**: 90% 以上
- **Domain ロジック**: 95% 以上（最も重要）
- **Workflow**: 85% 以上
- **Activity**: 85% 以上
- **tRPC ハンドラ**: 最小限（スモークテストのみ）

### tRPC ハンドラのテスト戦略

**方針**: tRPCレイヤーは薄いルーティング層であり、実際のロジックはActivity/Actions/Workflowで検証済み。そのため、tRPCのテストは**最小限のスモークテスト**で十分。

**テスト範囲**:
- ✅ ルーターがエクスポートされていること（スモークテスト）
- ❌ 各エンドポイントの詳細なロジック（Activity/Actionsでテスト済み）
- ❌ エラーハンドリングの網羅的テスト（mapTemporalErrorToTRPCの責務）
- ❌ 複数のエラーケース（下位レイヤーで検証済み）

**テストテンプレート**:
```typescript
/**
 * Feature tRPC Router テスト
 * 
 * tRPCレイヤーのテスト戦略:
 * - 最小限のスモークテスト（正常系のみ、1エンドポイント1テスト）
 * - 詳細なロジックはActivity/Actions層で検証済み
 * - tRPCの役割はルーティングとエラーマッピングのみ
 */

import { describe, it, expect, vi } from 'vitest';

// 必要最小限のモック
vi.mock('../activities/db/connection', () => ({
    getDatabase: vi.fn(() => ({} as any)),
}));

// ... その他の基本的なモック

describe('featureRouter - Smoke Tests', () => {
    it('should export featureRouter', async () => {
        const { featureRouter } = await import('./feature');
        expect(featureRouter).toBeDefined();
    });
});
```

**理由**:
1. **責任分離**: tRPCはルーティングとエラーマッピングのみ担当
2. **重複排除**: 実際のビジネスロジックは下位レイヤーで包括的にテスト済み
3. **保守性向上**: tRPCエンドポイント追加時にテスト修正が最小限
4. **テスト高速化**: 複雑なモックセットアップが不要

## 禁止事項

1. **実際の DB への接続**: テストでは常にモックを使用 (Activity のテスト内では可能であれば、pglite を使う。)
2. **外部 API 呼び出し**: WorkOS、Auth0 などはモック必須 (Activity の テスト内ではOK)
3. **テスト間の依存**: 各テストは独立して実行可能に
4. **不確定な値の直接使用**: `new Date()` や `Math.random()` はモック
5. **console.log() デバッグ**: テストコードには残さない

## 参考資料

- [Temporal Testing Documentation](https://docs.temporal.io/develop/typescript/testing-suite)
- [Vitest Documentation](https://vitest.dev/)
- [Temporal ApplicationFailure Documentation](https://typescript.temporal.io/api/classes/common.ApplicationFailure)

このガイドラインに従って、保守性が高く、信頼できるテストを作成してください.
