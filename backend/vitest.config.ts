import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // テスト実行時に .env.test を読み込む
    const env = loadEnv('test', process.cwd(), '');

    return {
        test: {
            globals: true,
            environment: 'node',
            env,
            setupFiles: ['./src/test/setup-env.ts'],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html'],
                exclude: [
                    'node_modules/',
                    'dist/',
                    '**/*.test.ts',
                    '**/*.config.ts',
                    'e2e/',
                ],
            },
            // Auth0 統合テストはタイムアウトを長めに設定
            testTimeout: 30000,
        },
    };
});
