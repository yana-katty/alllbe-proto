/**
 * Experience データ投入スクリプト（tRPC API使用版）
 * 
 * フロントエンドのモックデータをバックエンドAPIを通じて投入します
 * 
 * 実行前に必要な準備:
 * 1. docker compose up -d でバックエンドサーバーを起動
 * 2. npm run db:migrate でマイグレーション実行
 * 3. バックエンドサーバーを別ターミナルで起動: npm run dev:server
 * 
 * 実行方法:
 * npm run db:seed                    # 冪等性あり（既存データをスキップ）
 * npm run db:seed --clean            # 既存データを削除してから投入（未実装）
 * 
 * 冪等性について:
 * - User: 固定メールアドレスで存在チェック、既存ならスキップ
 * - Organization: WorkOS の名前一意制約により、ALREADY_EXISTS エラーで検出
 *   ※ 既存の場合は Brand ID を取得できないため、Experience 作成はスキップされます
 *   ※ 完全なクリーンアップが必要な場合は、WorkOS Console で手動削除してください
 * - Experience: タイトルで既存チェック、既存ならスキップ
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../src/trpc';

const TRPC_URL = process.env.TRPC_URL || 'http://localhost:4000/trpc';

// tRPC クライアント作成
const client = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: TRPC_URL,
        }),
    ],
});

// モックユーザー（Auth0 ID 想定）
const MOCK_USER_ID = 'auth0|mock-user-001';
const MOCK_USER_PASSWORD = 'TestPassword123!@#'; // Auth0要求: 大文字、小文字、数字、記号を含む8文字以上

// モックOrganization（WorkOS ID 想定）
const MOCK_ORGANIZATIONS = [
    { id: 'org_mock_001', name: 'エンターテイメント株式会社' },
    { id: 'org_mock_002', name: 'VR体験ラボ' },
    { id: 'org_mock_003', name: '国立美術館' },
];

// モックBrand（Organization作成時に自動作成されるため、参照用）
const MOCK_BRANDS_MAP: Record<string, string> = {};

// Experience ID マッピング（Asset紐付け用）
const EXPERIENCE_IDS_MAP: Record<string, string> = {};

// モック ExperienceAssets（Experience 作成後に投入）
const MOCK_EXPERIENCE_ASSETS = [
    // 闇の館VR のアセット
    {
        experienceTitle: '闇の館VR',
        assets: [
            {
                title: '呪いの歴史',
                description: '洋館に宿る呪いの起源と、過去に起きた不可解な事件の真相',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/cursed-history',
                category: 'story' as const,
                contentTiming: 'before' as const,
                accessLevel: 'public' as const,
                displayOrder: 1,
            },
            {
                title: '体験前の心構え',
                description: 'VR ホラー体験を最大限楽しむためのガイド',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/vr-guide',
                category: 'guide' as const,
                contentTiming: 'before' as const,
                accessLevel: 'ticket_holder' as const,
                displayOrder: 2,
            },
            {
                title: 'メイキング映像',
                description: 'VR 空間制作の裏側と、恐怖演出の秘密',
                assetType: 'video' as const,
                assetUrl: 'http://localhost:3000/vr-development-behind-the-scenes.jpg',
                thumbnailUrl: 'http://localhost:3000/vr-development-behind-the-scenes.jpg',
                category: 'making' as const,
                contentTiming: 'after' as const,
                accessLevel: 'attended' as const,
                displayOrder: 1,
                duration: '5:30',
            },
        ],
    },
    // 巨神戦記 のアセット
    {
        experienceTitle: '巨神戦記',
        assets: [
            {
                title: '神話の世界観',
                description: '巨神戦記の舞台となる神話世界の設定と登場する神々の紹介',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/mythology-world',
                category: 'story' as const,
                contentTiming: 'before' as const,
                accessLevel: 'public' as const,
                displayOrder: 1,
            },
            {
                title: '演出家インタビュー',
                description: '壮大なスケール感をどう表現したか',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/director-interview',
                category: 'interview' as const,
                contentTiming: 'after' as const,
                accessLevel: 'attended' as const,
                displayOrder: 1,
            },
        ],
    },
    // 魔法の迷宮 のアセット
    {
        experienceTitle: '魔法の迷宮',
        assets: [
            {
                title: '魔法の基礎知識',
                description: '迷宮で使える魔法の種類と使い方ガイド',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/magic-guide',
                category: 'guide' as const,
                contentTiming: 'before' as const,
                accessLevel: 'ticket_holder' as const,
                displayOrder: 1,
            },
        ],
    },
    // ネオン・シティ のアセット
    {
        experienceTitle: 'ネオン・シティ',
        assets: [
            {
                title: 'サイバーパンク世界の歩き方',
                description: '未来都市の設定とおすすめ体験ポイント',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/cyberpunk-guide',
                category: 'guide' as const,
                contentTiming: 'before' as const,
                accessLevel: 'public' as const,
                displayOrder: 1,
            },
            {
                title: 'VR 技術解説',
                description: 'ネオン・シティの映像美を支える技術',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/vr-tech',
                category: 'making' as const,
                contentTiming: 'after' as const,
                accessLevel: 'attended' as const,
                displayOrder: 1,
            },
        ],
    },
    // 廃校の謎 のアセット
    {
        experienceTitle: '廃校の謎',
        assets: [
            {
                title: '学校の怪談',
                description: '廃校にまつわる都市伝説と実際の事件',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/school-legend',
                category: 'story' as const,
                contentTiming: 'before' as const,
                accessLevel: 'public' as const,
                displayOrder: 1,
            },
        ],
    },
    // 深夜の美術館 のアセット
    {
        experienceTitle: '深夜の美術館',
        assets: [
            {
                title: '展示作品の見どころ',
                description: 'ナイトツアーで鑑賞できる名品の解説',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/artwork-highlights',
                category: 'guide' as const,
                contentTiming: 'before' as const,
                accessLevel: 'ticket_holder' as const,
                displayOrder: 1,
            },
            {
                title: 'キュレーターインタビュー',
                description: '夜の美術館の魅力と展示のこだわり',
                assetType: 'article' as const,
                assetUrl: 'https://example.com/articles/curator-interview',
                category: 'interview' as const,
                contentTiming: 'after' as const,
                accessLevel: 'attended' as const,
                displayOrder: 1,
            },
            {
                title: 'アートギャラリー交流会',
                description: '体験者同士でアートについて語り合う',
                assetType: 'image' as const,
                assetUrl: 'http://localhost:3000/community-interaction-art-gallery-people-discussin.jpg',
                thumbnailUrl: 'http://localhost:3000/community-interaction-art-gallery-people-discussin.jpg',
                category: 'other' as const,
                contentTiming: 'after' as const,
                accessLevel: 'attended' as const,
                displayOrder: 2,
            },
        ],
    },
];

// モックExperience
const MOCK_EXPERIENCES = [
    {
        organizationId: 'org_mock_001',
        title: '闇の館VR',
        description: '呪われた洋館で繰り広げられる恐怖体験。VR技術を駆使した最恐のホラー体験。あなたは呪われた洋館から脱出できるか？',
        location: '渋谷VRパーク',
        duration: '45分',
        capacity: '1-4名',
        maxParticipants: '4',
        price: '¥6,800',
        paymentMethods: JSON.stringify(['onsite']),
        ageRestriction: '18歳以上推奨',
        highlights: JSON.stringify([
            '最新VR技術による圧倒的没入感',
            '恐怖と謎解きが融合した体験',
            '4人までの協力プレイ可能',
        ]),
        coverImageUrl: 'http://localhost:3000/dark-haunted-mansion-vr-horror-experience-with-eer.jpg',
        heroImageUrl: 'http://localhost:3000/dark-haunted-mansion-vr-horror-experience-with-eer.jpg',
        experienceType: 'scheduled' as const,
        status: 'published' as const,
    },
    {
        organizationId: 'org_mock_001',
        title: '巨神戦記',
        description: '巨大な神々との壮大な戦い。巨大な神々との壮大な戦いを体験する没入型演劇',
        location: 'お台場',
        duration: '90分',
        capacity: '最大20名',
        maxParticipants: '20',
        price: '¥12,000',
        paymentMethods: JSON.stringify(['onsite', 'online']),
        coverImageUrl: 'http://localhost:3000/giant-warriors-battle-immersive-theater-experience.jpg',
        heroImageUrl: 'http://localhost:3000/giant-warriors-battle-immersive-theater-experience.jpg',
        experienceType: 'scheduled' as const,
        status: 'published' as const,
    },
    {
        organizationId: 'org_mock_001',
        title: '魔法の迷宮',
        description: '魔法の力で謎を解き明かせ。魔法の力を使って謎を解く体験型アドベンチャー',
        location: '銀座',
        duration: '120分',
        capacity: '最大15名',
        maxParticipants: '15',
        price: '¥15,000',
        paymentMethods: JSON.stringify(['onsite', 'online']),
        coverImageUrl: 'http://localhost:3000/magical-fantasy-maze-with-glowing-portals-and-myst.jpg',
        heroImageUrl: 'http://localhost:3000/magical-fantasy-maze-with-glowing-portals-and-myst.jpg',
        experienceType: 'period' as const,
        status: 'published' as const,
    },
    {
        organizationId: 'org_mock_002',
        title: 'ネオン・シティ',
        description: '未来都市を駆け抜けるVR体験。サイバーパンクな未来都市を駆け抜けるVR体験',
        location: '秋葉原',
        duration: '60分',
        capacity: '最大2名',
        maxParticipants: '2',
        price: '¥8,500',
        paymentMethods: JSON.stringify(['online']),
        coverImageUrl: 'http://localhost:3000/futuristic-neon-cyberpunk-city-vr-experience-with-.jpg',
        heroImageUrl: 'http://localhost:3000/futuristic-neon-cyberpunk-city-vr-experience-with-.jpg',
        experienceType: 'scheduled' as const,
        status: 'published' as const,
    },
    {
        organizationId: 'org_mock_002',
        title: '廃校の謎',
        description: '閉鎖された学校に隠された秘密。閉鎖された学校に隠された秘密を解き明かすホラーミステリー',
        location: '新宿ミステリーハウス',
        duration: '60分',
        capacity: '最大6名',
        maxParticipants: '6',
        price: '¥7,500',
        paymentMethods: JSON.stringify(['onsite', 'online']),
        coverImageUrl: 'http://localhost:3000/abandoned-school-at-night-horror-atmosphere-with-d.jpg',
        heroImageUrl: 'http://localhost:3000/abandoned-school-at-night-horror-atmosphere-with-d.jpg',
        experienceType: 'scheduled' as const,
        status: 'published' as const,
    },
    {
        organizationId: 'org_mock_003',
        title: '深夜の美術館',
        description: '特別ナイトツアー。夜の美術館を特別に巡るナイトツアー',
        location: '上野国立美術館',
        duration: '90分',
        capacity: '最大10名',
        maxParticipants: '10',
        price: '¥9,800',
        paymentMethods: JSON.stringify(['online']),
        coverImageUrl: 'http://localhost:3000/mysterious-museum-at-night-with-ancient-artifacts-.jpg',
        heroImageUrl: 'http://localhost:3000/mysterious-museum-at-night-with-ancient-artifacts-.jpg',
        experienceType: 'period' as const,
        status: 'published' as const,
    },
];

async function seed() {
    console.log('🌱 Starting database seeding via tRPC API...\n');
    console.log(`📡 Connecting to: ${TRPC_URL}\n`);

    try {
        // ヘルスチェック
        console.log('🔍 Checking backend health...');
        const health = await client.health.ping.query();
        console.log(`✅ Backend is ${health.status}\n`);

        // 1. EndUser作成（モック認証用） - 固定メールアドレスで冪等性を確保
        console.log('👤 Checking/Creating mock user...');
        const FIXED_USER_EMAIL = 'test-user-001@example.com'; // 固定メールアドレス
        let userCreated = false;

        try {
            // 既存ユーザーをメールアドレスでチェック
            try {
                const existingUser = await client.endUser.get.query({ email: FIXED_USER_EMAIL });

                if (existingUser?.data) {
                    console.log(`✅ User already exists: ${FIXED_USER_EMAIL}`);
                    console.log(`   Skipping user creation...\n`);
                    userCreated = true;
                }
            } catch (getError: any) {
                // NOT_FOUNDエラーの場合は新規作成
                if (getError?.message?.includes('not found') || getError?.message?.includes('NOT_FOUND')) {
                    console.log(`   User not found, creating new user...`);

                    // ユーザーが存在しない場合のみ作成
                    await client.endUser.create.mutate({
                        auth0_data: {
                            email: FIXED_USER_EMAIL,
                            password: MOCK_USER_PASSWORD,
                            data_processing_consent: true,
                            name: 'Test User',
                        },
                        platform_settings: { userId: MOCK_USER_ID },
                    });
                    console.log(`✅ Created user: ${MOCK_USER_ID}`);
                    console.log(`   Email: ${FIXED_USER_EMAIL}\n`);
                    userCreated = true;
                } else {
                    // その他のエラーは re-throw
                    throw getError;
                }
            }
        } catch (error: any) {
            // AUTH0_EMAIL_ALREADY_EXISTSの場合はスキップ
            // エラーメッセージまたはエラータイプをチェック
            const errorMessage = error?.message || '';
            const errorData = JSON.stringify(error?.data || error || {});

            if (
                errorMessage.includes('already exists') ||
                errorMessage.includes('ALREADY_EXISTS') ||
                errorMessage.includes('AUTH0_EMAIL_ALREADY_EXISTS') ||
                errorData.includes('AUTH0_EMAIL_ALREADY_EXISTS') ||
                errorData.includes('already exists')
            ) {
                console.log(`✅ User already exists (caught error): ${FIXED_USER_EMAIL}`);
                console.log(`   Skipping user creation...\n`);
                userCreated = true;
            } else {
                console.error(`❌ Failed to create/check user:`, error.message || error);
                console.error(`   Error details:`, errorData);
                console.error('\n⚠️  User creation/check failed. Please verify:');
                console.error('   1. Auth0 configuration (TEMPORAL_AUTH0_* env vars)');
                console.error('   2. Temporal Worker is running');
                console.error('   3. createEndUserWorkflow is properly registered\n');
                process.exit(1); // ユーザー作成失敗で終了
            }
        }

        // 2. Organization & Brand 作成（同時作成される）
        console.log('🏢 Creating organizations and brands...');

        // 注意: Organization の ID は一意だが、名前は一意ではない
        // findByWorkosName で既存をチェックし、名前が一致する Organization があれば使用

        for (const org of MOCK_ORGANIZATIONS) {
            try {
                // まず既存の Organization を名前で検索
                const existingOrg = await client.organization.findByWorkosName.query(org.name);

                if (existingOrg) {
                    // 既に存在する場合、Brand ID を取得して使用
                    console.log(`  ⏭️  ${org.name} already exists`);
                    console.log(`     Organization ID: ${existingOrg.id}`);

                    // デフォルト Brand を取得
                    try {
                        const brands = await client.brand.list.query({ organizationId: existingOrg.id });
                        const defaultBrand = brands.find(b => b.isDefault);

                        if (defaultBrand) {
                            MOCK_BRANDS_MAP[org.id] = defaultBrand.id;
                            console.log(`     Default Brand ID: ${defaultBrand.id} (retrieved)`);
                        } else {
                            console.log(`     ⚠️  No default Brand found for this Organization`);
                        }
                    } catch (brandError) {
                        console.log(`     ⚠️  Failed to retrieve Brand: ${brandError instanceof Error ? brandError.message : String(brandError)}`);
                    }
                } else {
                    // 新規作成を試みる
                    const result = await client.organization.createWithWorkos.mutate({
                        name: org.name,
                        domains: [],
                    });
                    MOCK_BRANDS_MAP[org.id] = result.defaultBrandId;
                    console.log(`  ✅ Created: ${org.name}`);
                    console.log(`     Organization ID: ${result.id}`);
                    console.log(`     Default Brand ID: ${result.defaultBrandId}`);
                }
            } catch (error: any) {
                // WorkOS組織が既に存在する場合のフォールバック
                if (error?.message?.includes('already exists') || error?.message?.includes('ALREADY_EXISTS')) {
                    console.log(`  ⚠️  ${org.name} creation failed (already exists in WorkOS)`);
                    console.log(`     Could not retrieve Brand ID - Experience creation may be skipped`);
                } else {
                    console.error(`  ❌ Failed to create ${org.name}:`, error);
                }
            }
        }

        if (Object.keys(MOCK_BRANDS_MAP).length === 0) {
            console.log('\n⚠️  No new Organizations were created (all already exist)');
            console.log('   Experience creation will be skipped.');
            console.log('   To create Experiences, delete existing Organizations from WorkOS Console.\n');
        }
        console.log('');

        // 3. Experience 作成
        console.log('🎭 Creating experiences...');

        // 既存のExperienceをすべて取得（タイトル重複チェック用）
        let existingExperiences: any[] = [];
        try {
            const existingResult = await client.experience.list.query({ limit: 100 });
            existingExperiences = existingResult || [];
        } catch (error) {
            console.log('  ℹ️  Could not fetch existing experiences, will attempt to create all');
        }

        let successCount = 0;
        let skippedCount = 0;

        for (const exp of MOCK_EXPERIENCES) {
            const brandId = MOCK_BRANDS_MAP[exp.organizationId];
            if (!brandId) {
                console.log(`  ❌ No brand found for ${exp.organizationId}, skipping ${exp.title}`);
                continue;
            }

            // タイトル重複チェック
            const existingExp = existingExperiences.find(e => e.title === exp.title);
            if (existingExp) {
                console.log(`  ⏭️  ${exp.title} already exists (${existingExp.id}), skipping...`);
                EXPERIENCE_IDS_MAP[exp.title] = existingExp.id;
                skippedCount++;
                continue;
            }

            try {
                const result = await client.experience.create.mutate({
                    brandId,
                    title: exp.title,
                    description: exp.description,
                    location: exp.location,
                    duration: exp.duration,
                    capacity: exp.capacity,
                    maxParticipants: exp.maxParticipants,
                    price: exp.price,
                    paymentMethods: exp.paymentMethods,
                    ageRestriction: exp.ageRestriction,
                    highlights: exp.highlights,
                    coverImageUrl: exp.coverImageUrl,
                    heroImageUrl: exp.heroImageUrl,
                    experienceType: exp.experienceType,
                    status: exp.status,
                });
                console.log(`  ✅ Created: ${exp.title} (${result.id})`);
                EXPERIENCE_IDS_MAP[exp.title] = result.id;
                successCount++;
            } catch (error) {
                console.error(`  ❌ Failed to create ${exp.title}:`, error);
            }
        }
        console.log('');

        // 4. ExperienceAssets 作成
        console.log('📦 Creating experience assets...');

        // 既存の ExperienceAssets をすべて取得（重複チェック用）
        let existingAssets: any[] = [];
        try {
            const existingResult = await client.experienceAsset.list.query({ limit: 500 });
            existingAssets = existingResult || [];
        } catch (error) {
            console.log('  ℹ️  Could not fetch existing assets, will attempt to create all');
        }

        let assetSuccessCount = 0;
        let assetSkippedCount = 0;

        for (const expAssetGroup of MOCK_EXPERIENCE_ASSETS) {
            const experienceId = EXPERIENCE_IDS_MAP[expAssetGroup.experienceTitle];

            if (!experienceId) {
                console.log(`  ⏭️  Experience not found: ${expAssetGroup.experienceTitle}, skipping assets...`);
                continue;
            }

            for (const asset of expAssetGroup.assets) {
                // タイトル + Experience ID で重複チェック
                const existingAsset = existingAssets.find(
                    a => a.experienceId === experienceId && a.title === asset.title
                );

                if (existingAsset) {
                    console.log(`  ⏭️  Asset "${asset.title}" for "${expAssetGroup.experienceTitle}" already exists, skipping...`);
                    assetSkippedCount++;
                    continue;
                }

                try {
                    const assetData: any = {
                        experienceId,
                        title: asset.title,
                        description: asset.description,
                        assetType: asset.assetType,
                        assetUrl: asset.assetUrl,
                        category: asset.category,
                        contentTiming: asset.contentTiming,
                        accessLevel: asset.accessLevel,
                        displayOrder: asset.displayOrder,
                    };

                    // オプショナルフィールドを条件付きで追加
                    if ('thumbnailUrl' in asset && asset.thumbnailUrl) {
                        assetData.thumbnailUrl = asset.thumbnailUrl;
                    }
                    if ('duration' in asset && asset.duration) {
                        assetData.duration = asset.duration;
                    }

                    await client.experienceAsset.create.mutate(assetData);
                    console.log(`  ✅ Created asset: "${asset.title}" for "${expAssetGroup.experienceTitle}"`);
                    assetSuccessCount++;
                } catch (error: any) {
                    console.error(`  ❌ Failed to create asset "${asset.title}":`, error?.message || error);
                }
            }
        }
        console.log('');

        console.log('✨ Database seeding completed!\n');
        console.log('📊 Summary:');
        console.log(`   - Organizations: ${MOCK_ORGANIZATIONS.length}`);
        console.log(`   - Brands: ${Object.keys(MOCK_BRANDS_MAP).length}`);
        console.log(`   - Experiences: ${successCount} created, ${skippedCount} skipped`);
        console.log(`   - Experience Assets: ${assetSuccessCount} created, ${assetSkippedCount} skipped`);
        console.log(`   - Users: 1\n`);
        console.log(`🔑 Mock User ID: ${MOCK_USER_ID}`);
        console.log(`   Set this in frontend/.env.local as:\n`);
        console.log(`   NEXT_PUBLIC_MOCK_USER_ID="${MOCK_USER_ID}"`);
        console.log(`   NEXT_PUBLIC_TRPC_URL="${TRPC_URL}"\n`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        console.error('\n💡 Make sure:');
        console.error('   1. Backend server is running (npm run dev:server)');
        console.error('   2. Database is migrated (npm run db:migrate)');
        console.error('   3. TRPC_URL is correct\n');
        process.exit(1);
    }
}

// スクリプト実行
seed();
