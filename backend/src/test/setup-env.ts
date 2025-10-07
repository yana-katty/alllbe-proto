/**
 * Vitest セットアップ - 環境変数の読み込み
 * 
 * このファイルは vitest 実行時に自動的に読み込まれます。
 * .env.test ファイルから環境変数を読み込みます。
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.test を読み込む
const envPath = resolve(process.cwd(), '.env.test');
const result = config({ path: envPath });

if (result.error) {
    console.warn('⚠️  .env.test file not found. Using environment variables from system.');
    console.warn('   Please create .env.test file for Auth0 integration tests.');
    console.warn('   See .env.test.example for reference.');
} else {
    console.log('✓ Loaded .env.test successfully');
}

// 必須の環境変数をチェック
const requiredEnvVars = [
    'AUTH0_DOMAIN',
    'AUTH0_MANAGEMENT_CLIENT_ID',
    'AUTH0_MANAGEMENT_CLIENT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in .env.test file.');
    console.error('See .env.test.example for reference.\n');
}
