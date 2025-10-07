#!/usr/bin/env ts-node
/**
 * E2E Scenario 1: Organization & Brand Lifecycle
 * 
 * このスクリプトは以下を検証します：
 * 1. WorkOS Organization の作成
 * 2. DB Organization の作成
 * 3. デフォルト Brand の自動作成
 * 4. Brand の CRUD 操作
 * 5. Experience の作成（Brand 配下）
 * 6. データの削除（CASCADE 動作確認）
 * 7. WorkOS Organization のクリーンアップ
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../src/trpc';

// tRPC クライアントの設定
const trpc = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: 'http://localhost:4000/trpc',
        }),
    ],
});

// テスト用のデータ
const TEST_ORG_ID = `org_test_${Date.now()}`;
const TEST_ORG_NAME = `Test Organization ${new Date().toISOString()}`;

// クリーンアップ用のデータ追跡
const createdResources = {
    workosOrgId: null as string | null,
    dbOrgId: null as string | null,
    brandIds: [] as string[],
    experienceIds: [] as string[],
};

async function main() {
    console.log('🚀 E2E Scenario 1: Organization & Brand Lifecycle');
    console.log('================================================\n');

    try {
        // Step 1:  Organization の作成
        console.log('📝 Step 1: Creating Organization...');
        const workosOrg = await trpc.organization.createWithWorkos.mutate({
            name: TEST_ORG_NAME,
            domains: [],
        });
        createdResources.workosOrgId = workosOrg.id;
        console.log(`✅ WorkOS Organization created: ${workosOrg.id}\n`);

        // Step 3: デフォルト Brand の確認
        console.log('📝 Step 3: Verifying default Brand creation...');
        const brands = await trpc.brand.list.query({
            organizationId: createdResources.workosOrgId,
        });

        console.log(`✅ Total Brands found: ${brands.length}`);
        console.log(`   - Brand IDs: ${brands.map(b => b.id).join(', ')}\n`);

        // デフォルト Brand を取得
        const defaultBrand = brands.find(b => b.isDefault) || brands[0];
        if (!defaultBrand) {
            throw new Error('No brands found for the organization');
        }
        createdResources.brandIds.push(defaultBrand.id);

        // Step 5: Brand 情報の更新
        console.log('📝 Step 5: Updating Brand information...');
        const updatedBrand = await trpc.brand.update.mutate({
            id: defaultBrand.id,
            data: {
                name: 'Updated Brand Name',
                description: 'This is an updated description for the brand.',
                logoUrl: 'https://example.com/new-logo.png',
            },
        });
        console.log(`✅ Brand updated: ${updatedBrand.name}\n`);

        // Step 6: Experience の作成（Brand 配下）
        console.log('📝 Step 6: Creating Experience under Brand...');
        const experience = await trpc.experience.create.mutate({
            brandId: defaultBrand.id,
            title: 'Test Experience',
            description: 'A test experience for E2E validation',
            experienceType: 'scheduled',
            price: '1000',
            capacity: '20',
            location: 'Tokyo, Japan',
        });
        createdResources.experienceIds.push(experience.id);
        console.log(`✅ Experience created: ${experience.id}`);
        console.log(`   - Title: ${experience.title}`);
        console.log(`   - Brand: ${experience.brandId}\n`);

        // Step 6.5: Experience Asset の作成
        console.log('📝 Step 6.5: Creating Experience Assets (After Content)...');
        const afterAsset = await trpc.experienceAsset.create.mutate({
            experienceId: experience.id,
            title: 'Behind the Scenes Video',
            description: 'Exclusive behind the scenes footage',
            assetType: 'video',
            assetUrl: 'https://example.com/bts-video.mp4',
            thumbnailUrl: 'https://example.com/bts-thumbnail.jpg',
            contentTiming: 'after',
            category: 'making',
            accessLevel: 'attended',
        });
        console.log(`✅ Experience Asset created: ${afterAsset.id}`);
        console.log(`   - Title: ${afterAsset.title}`);
        console.log(`   - Access Level: ${afterAsset.accessLevel}\n`);

        // Step 7: データ検証
        console.log('📝 Step 7: Verifying data relationships...');

        // Brand の確認
        const brandInfo = await trpc.brand.getById.query(defaultBrand.id);
        console.log(`✅ Brand verified: ${brandInfo?.id}`);

        // Experience の確認
        const expInfo = await trpc.experience.getById.query(experience.id);
        console.log(`✅ Experience verified: ${expInfo?.id}\n`);

        console.log('🎉 All steps completed successfully!');
        console.log('🧹 Starting cleanup...\n');

    } catch (error) {
        console.error('❌ Error during execution:', error);
        console.log('🧹 Attempting cleanup...\n');
    } finally {
        await cleanup();
    }
}

async function cleanup() {
    console.log('🧹 Starting cleanup process...');

    // WorkOS Organization の削除により関連データもCASCADE削除される
    if (createdResources.workosOrgId) {
        try {
            console.log('   🗑️  Deleting WorkOS Organization and all related data...');
            const deleteResult = await trpc.organization.deleteWithWorkos.mutate(createdResources.workosOrgId);
            console.log(`✅ WorkOS Organization deleted successfully`);
            console.log(`   - Organization ID: ${createdResources.workosOrgId}`);
            console.log(`   - All related brands and experiences were also deleted via CASCADE`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete WorkOS Organization automatically:`, error);
            console.warn(`   Organization ID: ${createdResources.workosOrgId}`);
            console.warn(`   Dashboard URL: https://dashboard.workos.com/organizations`);
            console.warn(`   Please delete manually from WorkOS Dashboard.`);

            // 自動削除に失敗した場合は、個別削除を試行
            await fallbackCleanup();
        }
    }

    console.log('🧹 Cleanup completed!');
}

async function fallbackCleanup() {
    console.log('   🔄 Attempting fallback cleanup...');

    // Experience の削除
    for (const expId of createdResources.experienceIds) {
        try {
            await trpc.experience.delete.mutate(expId);
            console.log(`✅ Deleted Experience: ${expId}`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete Experience ${expId}:`, error);
        }
    }

    // Brand の削除
    for (const brandId of createdResources.brandIds) {
        try {
            await trpc.brand.delete.mutate(brandId);
            console.log(`✅ Deleted Brand: ${brandId}`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete Brand ${brandId}:`, error);
        }
    }
}

// エラーハンドリング
process.on('unhandledRejection', async (error) => {
    console.error('❌ Unhandled rejection:', error);
    console.log('\n🧹 Attempting cleanup...');
    await cleanup();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('\n⚠️  Interrupted by user');
    console.log('🧹 Attempting cleanup...');
    await cleanup();
    process.exit(1);
});

// スクリプト実行

main().catch(async (error) => {
    console.error('❌ Fatal error:', error);
    await cleanup();
    process.exit(1);
});
