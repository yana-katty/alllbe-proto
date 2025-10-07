import { pgTable, uuid, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================
// Organizations table - 展示を主催する組織
// ============================================
// WorkOS がマスターデータ: Organization の個人情報・企業情報は WorkOS で管理
// DB には WorkOS Organization ID を主キーとして使用（参照テーブル）
// GDPR対応: 個人情報削除時は WorkOS での削除のみで完了
export const organizations = pgTable('organizations', {
    // WorkOS Organization ID を直接主キーとして使用
    id: varchar('id', { length: 255 }).primaryKey(), // WorkOS Organization ID

    // プラットフォーム固有の状態管理のみ
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Zod schemas for validation
export const insertOrganizationSchema = createInsertSchema(organizations, {
    id: z.string().min(1, 'WorkOS Organization ID is required'),
});

export const selectOrganizationSchema = createSelectSchema(organizations);

export const updateOrganizationSchema = insertOrganizationSchema.partial().omit({
    id: true, // WorkOS IDは変更不可（主キー）
    createdAt: true,
    updatedAt: true,
});

// Type definitions
export type Organization = z.infer<typeof selectOrganizationSchema>;
export type NewOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;

// ============================================
// Users table - エンドユーザー (Auth0認証)
// ============================================
// Auth0 がマスターデータ: エンドユーザーの個人情報は Auth0 で管理
// DB には Auth0 User ID を主キーとして使用（参照テーブル）
// GDPR対応: 個人情報削除時は Auth0 での削除のみで完了
export const users = pgTable('users', {
    // Auth0 User ID を直接主キーとして使用
    id: varchar('id', { length: 255 }).primaryKey(), // Auth0 User ID (auth0|xxx, google-oauth2|xxx 等)

    // プラットフォーム固有の状態管理のみ
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users, {
    id: z.string().min(1, 'Auth0 User ID is required'),
});

export const selectUserSchema = createSelectSchema(users);

export const updateUserSchema = insertUserSchema.partial().omit({
    id: true, // Auth0 IDは変更不可（主キー）
    createdAt: true,
    updatedAt: true,
});

export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

// ============================================
// Brands table - Organization配下のブランド管理
// ============================================
// Organization 配下に複数のブランドを持つ設計
// Standard プラン: 1つのデフォルトBrandのみ（isDefault: true）
// Enterprise プラン: 最大100個のBrandを作成可能
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

    // Standardプランのデフォルトフラグ
    // Standard: isDefault=true のBrandが1つだけ存在
    // Enterprise: 複数のBrandを作成可能
    isDefault: boolean('is_default').notNull().default(false),

    // 状態管理
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    // Organization別のBrand検索用（頻繁に使用）
    organizationIdIdx: index('brands_organization_id_idx').on(table.organizationId),
    // Standardプランでのデフォルトチェック用
    orgDefaultIdx: index('brands_org_default_idx').on(table.organizationId, table.isDefault),
}));

export const insertBrandSchema = createInsertSchema(brands, {
    organizationId: z.string().min(1, 'Organization ID is required'),
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().optional(),
    logoUrl: z.string().url('Invalid URL format').optional(),
    websiteUrl: z.string().url('Invalid URL format').optional(),
    isDefault: z.boolean().default(false),
});

export const selectBrandSchema = createSelectSchema(brands);

export const updateBrandSchema = insertBrandSchema.partial().omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
});

export type Brand = z.infer<typeof selectBrandSchema>;
export type NewBrand = z.infer<typeof insertBrandSchema>;
export type UpdateBrand = z.infer<typeof updateBrandSchema>;

// ============================================
// Experiences table - Location Based Entertainment コンテンツ
// ============================================
export const experiences = pgTable('experiences', {
    id: uuid('id').primaryKey().defaultRandom(),

    // ✅ 新設計: brand_id を参照（Experience → Brand → Organization）
    brandId: uuid('brand_id')
        .notNull()
        .references(() => brands.id, { onDelete: 'cascade' }),

    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    location: text('location'), // 場所情報（住所など）

    // 体験時間・定員
    duration: varchar('duration', { length: 50 }), // 体験時間（例: "45分"）
    capacity: varchar('capacity', { length: 100 }), // 定員（例: "1-4名"）
    minParticipants: varchar('min_participants', { length: 50 }), // 最小参加人数
    maxParticipants: varchar('max_participants', { length: 50 }), // 最大参加人数

    // 料金情報
    price: varchar('price', { length: 100 }), // 料金情報（例: "¥6,800"）
    paymentMethods: text('payment_methods'), // 支払い方法（JSON配列: '["onsite", "online"]'）

    // 年齢制限・注意事項
    ageRestriction: varchar('age_restriction', { length: 100 }), // 年齢制限（例: "18歳以上推奨"）
    notes: text('notes'), // 注意事項（JSON配列で箇条書き）

    // 体験のハイライト
    highlights: text('highlights'), // ハイライト（JSON配列で箇条書き）

    // Experience タイプ（日時指定型、期間指定型など）
    experienceType: varchar('experience_type', { length: 50 }).notNull(), // 'scheduled', 'period', 'flexible'

    // 日時指定型の場合
    scheduledStartAt: timestamp('scheduled_start_at'),
    scheduledEndAt: timestamp('scheduled_end_at'),

    // 期間指定型の場合
    periodStartDate: timestamp('period_start_date'),
    periodEndDate: timestamp('period_end_date'),

    // ステータス管理
    status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft', 'published', 'ended', 'archived'

    // メタデータ
    coverImageUrl: text('cover_image_url'),
    heroImageUrl: text('hero_image_url'), // ヒーロー画像（詳細ページ用）
    tags: text('tags'), // JSON配列として保存（例: '["art", "interactive"]'）

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    // Brand別のExperience検索用（頻繁に使用）
    brandIdIdx: index('experiences_brand_id_idx').on(table.brandId),
    // ステータス別検索用
    statusIdx: index('experiences_status_idx').on(table.status),
    // Experience タイプ別検索用
    experienceTypeIdx: index('experiences_experience_type_idx').on(table.experienceType),
    // Brand＋ステータス検索用（管理画面で頻繁に使用）
    brandStatusIdx: index('experiences_brand_status_idx').on(table.brandId, table.status),
}));

export const insertExperienceSchema = createInsertSchema(experiences, {
    brandId: z.string().uuid('Invalid brand ID'),
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    location: z.string().optional(),
    duration: z.string().optional(),
    capacity: z.string().optional(),
    minParticipants: z.string().optional(),
    maxParticipants: z.string().optional(),
    price: z.string().optional(),
    paymentMethods: z.string().optional(), // JSON文字列
    ageRestriction: z.string().optional(),
    notes: z.string().optional(), // JSON文字列（箇条書き）
    highlights: z.string().optional(), // JSON文字列（箇条書き）
    experienceType: z.enum(['scheduled', 'period', 'flexible']),
    scheduledStartAt: z.date().optional(),
    scheduledEndAt: z.date().optional(),
    periodStartDate: z.date().optional(),
    periodEndDate: z.date().optional(),
    status: z.enum(['draft', 'published', 'ended', 'archived']).default('draft'),
    coverImageUrl: z.string().url('Invalid URL format').optional(),
    heroImageUrl: z.string().url('Invalid URL format').optional(),
    tags: z.string().optional(),
});

export const selectExperienceSchema = createSelectSchema(experiences);

export const updateExperienceSchema = insertExperienceSchema.partial().omit({
    id: true,
    brandId: true,
    createdAt: true,
    updatedAt: true,
});

export type Experience = z.infer<typeof selectExperienceSchema>;
export type NewExperience = z.infer<typeof insertExperienceSchema>;
export type UpdateExperience = z.infer<typeof updateExperienceSchema>;

// ============================================
// Bookings table - Experience 予約
// ============================================
export const bookings = pgTable('bookings', {
    id: uuid('id').primaryKey().defaultRandom(),
    experienceId: uuid('experience_id').notNull().references(() => experiences.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }), // Auth0 User ID

    // 予約情報
    numberOfParticipants: varchar('number_of_participants', { length: 50 }).notNull(), // 参加人数
    bookingDate: timestamp('booking_date').notNull().defaultNow(), // 予約日時

    // 日時指定型の場合の予約時刻
    scheduledVisitTime: timestamp('scheduled_visit_time'),

    // 予約ステータス
    status: varchar('status', { length: 50 }).notNull().default('confirmed'), // 'confirmed', 'cancelled', 'attended', 'no_show'

    // QRコード入場管理
    qrCode: varchar('qr_code', { length: 255 }).unique(), // 入場用QRコード
    attendedAt: timestamp('attended_at'), // 実際の入場日時

    // キャンセル情報
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    // QRコード検索用（高頻度使用）
    qrCodeIdx: index('bookings_qr_code_idx').on(table.qrCode),
    // ユーザー別予約検索用
    userIdIdx: index('bookings_user_id_idx').on(table.userId),
    // Experience別予約検索用
    experienceIdIdx: index('bookings_experience_id_idx').on(table.experienceId),
    // ステータス別検索用（管理画面）
    statusIdx: index('bookings_status_idx').on(table.status),
    // 訪問時刻での範囲検索用
    scheduledVisitTimeIdx: index('bookings_scheduled_visit_time_idx').on(table.scheduledVisitTime),
    // ユーザー＋ステータス検索用（マイページ）
    userStatusIdx: index('bookings_user_status_idx').on(table.userId, table.status),
    // Experience＋日時検索用（管理画面）
    experienceScheduledIdx: index('bookings_experience_scheduled_idx').on(table.experienceId, table.scheduledVisitTime),
}));

export const insertBookingSchema = createInsertSchema(bookings, {
    experienceId: z.string().uuid('Invalid experience ID'),
    userId: z.string().min(1, 'User ID is required'), // Auth0 User ID
    numberOfParticipants: z.string().min(1, 'Number of participants is required'),
    scheduledVisitTime: z.date().optional(),
    status: z.enum(['confirmed', 'cancelled', 'attended', 'no_show']).default('confirmed'),
    qrCode: z.string().optional(),
    attendedAt: z.date().optional(),
    cancelledAt: z.date().optional(),
    cancellationReason: z.string().optional(),
});

export const selectBookingSchema = createSelectSchema(bookings);

export const updateBookingSchema = insertBookingSchema.partial().omit({
    id: true,
    experienceId: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});

export type Booking = z.infer<typeof selectBookingSchema>;
export type NewBooking = z.infer<typeof insertBookingSchema>;
export type UpdateBooking = z.infer<typeof updateBookingSchema>;

// ============================================
// Payments table - 決済情報（Booking と分離）
// ============================================
export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),

    // 決済方法
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'onsite', 'credit_card'

    // 決済ステータス
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'completed', 'refunded', 'partially_refunded', 'failed'

    // 金額情報
    amount: varchar('amount', { length: 100 }).notNull(), // 決済金額（表示用、例: "¥6,800"）
    currency: varchar('currency', { length: 10 }).notNull().default('JPY'), // 通貨コード

    // Phase 2: 外部決済プロバイダー連携
    paymentIntentId: varchar('payment_intent_id', { length: 255 }), // Stripe Payment Intent ID
    refundId: varchar('refund_id', { length: 255 }), // Stripe Refund ID
    transactionId: varchar('transaction_id', { length: 255 }), // 汎用トランザクションID

    // タイムスタンプ
    paidAt: timestamp('paid_at'), // 決済完了日時
    refundedAt: timestamp('refunded_at'), // 返金完了日時

    // メタデータ
    metadata: text('metadata'), // JSON形式の追加情報（領収書番号、メモなど）

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    // Booking別決済検索用
    bookingIdIdx: index('payments_booking_id_idx').on(table.bookingId),
    // ステータス別検索用
    statusIdx: index('payments_status_idx').on(table.status),
    // 決済方法別検索用
    paymentMethodIdx: index('payments_payment_method_idx').on(table.paymentMethod),
    // 外部決済ID検索用
    paymentIntentIdIdx: index('payments_payment_intent_id_idx').on(table.paymentIntentId),
}));

export const insertPaymentSchema = createInsertSchema(payments, {
    bookingId: z.string().uuid('Invalid booking ID'),
    paymentMethod: z.enum(['onsite', 'credit_card']),
    status: z.enum(['pending', 'completed', 'refunded', 'partially_refunded', 'failed']).default('pending'),
    amount: z.string().min(1, 'Amount is required'),
    currency: z.string().default('JPY'),
    paymentIntentId: z.string().optional(),
    refundId: z.string().optional(),
    transactionId: z.string().optional(),
    paidAt: z.date().optional(),
    refundedAt: z.date().optional(),
    metadata: z.string().optional(),
});

export const selectPaymentSchema = createSelectSchema(payments);

export const updatePaymentSchema = insertPaymentSchema.partial().omit({
    id: true,
    bookingId: true,
    createdAt: true,
    updatedAt: true,
});

export type Payment = z.infer<typeof selectPaymentSchema>;
export type NewPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePayment = z.infer<typeof updatePaymentSchema>;

// ============================================
// ExperienceAssets table - 関連コンテンツ (Before/After)
// ============================================
export const experienceAssets = pgTable('experience_assets', {
    id: uuid('id').primaryKey().defaultRandom(),
    experienceId: uuid('experience_id').notNull().references(() => experiences.id, { onDelete: 'cascade' }),

    // コンテンツ基本情報
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    assetType: varchar('asset_type', { length: 50 }).notNull(), // 'video', 'article', 'image', 'download', 'audio'
    assetUrl: text('asset_url').notNull(), // コンテンツのURL
    thumbnailUrl: text('thumbnail_url'), // サムネイル画像

    // Before/After 分類
    contentTiming: varchar('content_timing', { length: 50 }).notNull(), // 'before', 'after', 'anytime'

    // コンテンツカテゴリ（画面の STORY, MAKING, GUIDE, COLUMN, INTERVIEW など）
    category: varchar('category', { length: 50 }), // 'story', 'making', 'guide', 'column', 'interview', 'other'
    categoryLabel: varchar('category_label', { length: 100 }), // カテゴリの表示名（例: "館の歴史"）

    // Phase 1: シンプルな enum によるアクセス権限
    accessLevel: varchar('access_level', { length: 50 }).notNull().default('public'), // 'public', 'ticket_holder', 'attended'

    // 表示順序
    displayOrder: varchar('display_order', { length: 50 }).notNull().default('0'),

    // メタデータ
    fileSize: varchar('file_size', { length: 100 }), // ファイルサイズ（表示用）
    duration: varchar('duration', { length: 100 }), // 動画・音声の長さ

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    // Experience別コンテンツ取得用（高頻度使用）
    experienceIdIdx: index('experience_assets_experience_id_idx').on(table.experienceId),
    // Before/After コンテンツ取得用
    contentTimingIdx: index('experience_assets_content_timing_idx').on(table.contentTiming),
    // アクセスレベル別取得用
    accessLevelIdx: index('experience_assets_access_level_idx').on(table.accessLevel),
    // Experience＋タイミング＋アクセスレベル検索用（最も頻繁に使用）
    experienceTimingAccessIdx: index('experience_assets_exp_timing_access_idx')
        .on(table.experienceId, table.contentTiming, table.accessLevel),
    // カテゴリ別検索用
    categoryIdx: index('experience_assets_category_idx').on(table.category),
}));

export const insertExperienceAssetSchema = createInsertSchema(experienceAssets, {
    experienceId: z.string().uuid('Invalid experience ID'),
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    assetType: z.enum(['video', 'article', 'image', 'download', 'audio']),
    assetUrl: z.string().url('Invalid URL format'),
    thumbnailUrl: z.string().url('Invalid URL format').optional(),
    contentTiming: z.enum(['before', 'after', 'anytime']),
    category: z.enum(['story', 'making', 'guide', 'column', 'interview', 'other']).optional(),
    categoryLabel: z.string().optional(),
    accessLevel: z.enum(['public', 'ticket_holder', 'attended']).default('public'),
    displayOrder: z.string().default('0'),
    fileSize: z.string().optional(),
    duration: z.string().optional(),
});

export const selectExperienceAssetSchema = createSelectSchema(experienceAssets);

export const updateExperienceAssetSchema = insertExperienceAssetSchema.partial().omit({
    id: true,
    experienceId: true,
    createdAt: true,
    updatedAt: true,
});

export type ExperienceAsset = z.infer<typeof selectExperienceAssetSchema>;
export type NewExperienceAsset = z.infer<typeof insertExperienceAssetSchema>;
export type UpdateExperienceAsset = z.infer<typeof updateExperienceAssetSchema>;
