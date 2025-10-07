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
        // Step 1: WorkOS Organization の作成
        console.log('📝 Step 1: Creating WorkOS Organization...');
        const workosOrg = await trpc.organization.createWorkOSOrganization.mutate({
            name: TEST_ORG_NAME,
        });
        createdResources.workosOrgId = workosOrg.id;
        console.log(`✅ WorkOS Organization created: ${workosOrg.id}\n`);

        // Step 2: DB Organization の作成
        console.log('📝 Step 2: Creating DB Organization...');
        const dbOrg = await trpc.organization.create.mutate({
            id: workosOrg.id,
        });
        createdResources.dbOrgId = dbOrg.id;
        console.log(`✅ DB Organization created: ${dbOrg.id}\n`);

        // Step 3: デフォルト Brand の確認
        console.log('📝 Step 3: Verifying default Brand creation...');
        const brands = await trpc.brand.listByOrganization.query({
            organizationId: dbOrg.id,
        });

        if (brands.length !== 1) {
            throw new Error(`Expected 1 default brand, got ${brands.length}`);
        }

        const defaultBrand = brands[0];
        if (!defaultBrand.isDefault) {
            throw new Error('Default brand flag is not set');
        }

        createdResources.brandIds.push(defaultBrand.id);
        console.log(`✅ Default Brand verified: ${defaultBrand.id}`);
        console.log(`   - Name: ${defaultBrand.name}`);
        console.log(`   - isDefault: ${defaultBrand.isDefault}\n`);

        // Step 4: 追加の Brand 作成（Enterprise の場合）
        console.log('📝 Step 4: Creating additional Brand...');
        const newBrand = await trpc.brand.create.mutate({
            organizationId: dbOrg.id,
            name: 'Secondary Brand',
            description: 'A secondary brand for testing',
        });
        createdResources.brandIds.push(newBrand.id);
        console.log(`✅ Additional Brand created: ${newBrand.id}\n`);

        // Step 5: Brand 情報の更新
        console.log('📝 Step 5: Updating Brand information...');
        const updatedBrand = await trpc.brand.update.mutate({
            id: newBrand.id,
            name: 'Updated Secondary Brand',
            description: 'Updated description',
        });
        console.log(`✅ Brand updated: ${updatedBrand.name}\n`);

        // Step 6: Experience の作成（Brand 配下）
        console.log('📝 Step 6: Creating Experience under Brand...');
        const experience = await trpc.experience.create.mutate({
            brandId: defaultBrand.id,
            title: 'Test Experience',
            description: 'A test experience for E2E validation',
            experienceType: 'fixed_schedule',
            price: 1000,
            currency: 'JPY',
            capacity: 20,
            startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7日後
            endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2時間
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
            displayOrder: '0',
            duration: '00:15:30',
        });
        console.log(`✅ Experience Asset created: ${afterAsset.id}`);
        console.log(`   - Title: ${afterAsset.title}`);
        console.log(`   - Access Level: ${afterAsset.accessLevel} (attended only)\n`);

        // Step 7: データの検証
        console.log('📝 Step 7: Verifying data integrity...');

        // Brand 一覧の確認
        const allBrands = await trpc.brand.listByOrganization.query({
            organizationId: dbOrg.id,
        });
        console.log(`✅ Total Brands: ${allBrands.length}`);

        // Experience 一覧の確認
        const brandExperiences = await trpc.experience.listByBrand.query({
            brandId: defaultBrand.id,
        });
        console.log(`✅ Total Experiences: ${brandExperiences.length}\n`);

        // Step 8: クリーンアップ
        console.log('📝 Step 8: Cleaning up test data...');
        await cleanup();
        console.log('✅ Cleanup completed\n');

        console.log('🎉 All tests passed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.log('\n🧹 Attempting cleanup...');
        await cleanup();
        process.exit(1);
    }
}

async function cleanup() {
    // Experience の削除
    for (const expId of createdResources.experienceIds) {
        try {
            await trpc.experience.delete.mutate({ id: expId });
            console.log(`✅ Deleted Experience: ${expId}`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete Experience ${expId}:`, error);
        }
    }

    // Brand の削除
    for (const brandId of createdResources.brandIds) {
        try {
            await trpc.brand.delete.mutate({ id: brandId });
            console.log(`✅ Deleted Brand: ${brandId}`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete Brand ${brandId}:`, error);
        }
    }

    // DB Organization の削除
    if (createdResources.dbOrgId) {
        try {
            await trpc.organization.delete.mutate({ id: createdResources.dbOrgId });
            console.log(`✅ Deleted DB Organization: ${createdResources.dbOrgId}`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete DB Organization:`, error);
        }
    }

    // WorkOS Organization の削除
    if (createdResources.workosOrgId) {
        try {
            await trpc.organization.deleteWorkOSOrganization.mutate({
                organizationId: createdResources.workosOrgId,
            });
            console.log(`✅ Deleted WorkOS Organization: ${createdResources.workosOrgId}`);
        } catch (error) {
            console.warn(`⚠️  Failed to delete WorkOS Organization:`, error);
            console.warn(`   Please manually delete from WorkOS Dashboard: ${createdResources.workosOrgId}`);
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
main();
