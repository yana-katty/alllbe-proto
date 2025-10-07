/**
 * Test Setup with PGlite
 * 
 * PGliteを使用した実際のPostgreSQL互換環境でのテスト
 * モックではなく、実際のDB操作をテストすることで信頼性を向上
 */

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
 * - スキーマを適用
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
    // マイグレーションファイルのパスを解決
    const migrationPath = join(__dirname, '../../drizzle/0000_empty_plazm.sql');

    // マイグレーションSQLを読み込み
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // SQLをステートメントごとに分割して実行
    // "--> statement-breakpoint" で区切られている
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
                console.error('Migration error:', error);
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

/**
 * テスト用のヘルパー関数: User作成
 */
export async function createTestUser(id: string = 'test_user_123'): Promise<string> {
    await testDb.execute(sql`
        INSERT INTO users (id, is_active)
        VALUES (${id}, TRUE)
        ON CONFLICT (id) DO NOTHING
    `);
    return id;
}

/**
 * テスト用DBインスタンスを取得
 */
export function getTestDb(): Database {
    if (!testDb) {
        throw new Error('Test DB not initialized. Call setupTestDb() first.');
    }
    return testDb;
}
