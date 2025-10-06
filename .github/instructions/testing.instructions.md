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

### テストテンプレート（Context を使わない場合）

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

1. **Result 型の検証**: `result.ok` で型ガードしてから値を取得
2. **依存関数のモック**: `vi.fn()` で DB 操作などをモック
3. **エラーケースの網羅**: 正常系と異常系を両方テスト
4. **型安全性**: TypeScript の型推論を最大限活用

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
- **tRPC ハンドラ**: 80% 以上

## 禁止事項

1. **実際の DB への接続**: テストでは常にモックを使用
2. **外部 API 呼び出し**: WorkOS、Auth0 などはモック必須
3. **テスト間の依存**: 各テストは独立して実行可能に
4. **不確定な値の直接使用**: `new Date()` や `Math.random()` はモック
5. **console.log() デバッグ**: テストコードには残さない

## 参考資料

- [Temporal Testing Documentation](https://docs.temporal.io/develop/typescript/testing-suite)
- [Vitest Documentation](https://vitest.dev/)
- [neverthrow Documentation](https://github.com/supermacro/neverthrow)

このガイドラインに従って、保守性が高く、信頼できるテストを作成してください。
