---
applyTo: "backend/src/shared/db/**"
---

# データベース設計ガイドライン

このガイドラインは `backend/src/shared/db/**` 配下のファイル（スキーマ定義、マイグレーション、モデル操作関数）に適用されます。

## SQL Antipatterns, Volume 1 準拠の設計原則

このプロジェクトでは「SQL Antipatterns, Volume 1」の知見を活用し、データベース設計時にはアンチパターンを避けて最適なスキーマ設計を行います。

## 1. スキーマ設計の原則

### 避けるべきアンチパターン

**ID Required (主キー必須の誤解)**
- すべてのテーブルに無意味な人工キーを強制しない
- 自然キーが適切な場合は自然キーを使用する

**Entity-Attribute-Value (EAV)**
- 動的な属性管理のために正規化を破綻させない
- 頻繁に使用される属性は専用列として定義する

**Polymorphic Associations (多態的関連)**
- 外部キー制約を破綻させるポリモーフィズム設計を避ける
- 継承関係は適切なテーブル設計で表現する

**Multicolumn Attributes (複数列の属性)**
- CSVのような値を単一列に格納しない
- 配列型やJSON型の使用は慎重に検討する

### 推奨するスキーマ設計パターン

```typescript
// ✅ 推奨: 明示的な列設計
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 50 }),
  website: text('website'),
  address: text('address'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ❌ アンチパターン: EAV設計
// organizationAttributesテーブルでname, value列による動的属性は避ける
```

## 2. リレーション設計の原則

### 避けるべきアンチパターン

**Naive Trees (素朴な木構造)**
- parent_idのみによる隣接リストモデルの無制限使用を避ける
- 深い階層や頻繁な階層操作が必要な場合は代替パターンを検討する

**Keyless Entry (キーなしエントリ)**
- 外部キー制約を設定しない参照関係を避ける
- 参照整合性は必ずDB層で保証する

### 推奨するリレーション設計

```typescript
// ✅ 明示的な外部キー制約
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade'
  }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull(),
  startDateTime: timestamp('start_date_time').notNull(),
  endDateTime: timestamp('end_date_time').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ✅ 階層データの適切な表現パターン
export const eventCategories = pgTable('event_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  path: text('path').notNull(), // "/tech/ai/machine-learning" のようなパス表現
  level: integer('level').notNull().default(0),
  parentId: uuid('parent_id').references(() => eventCategories.id),
  leftValue: integer('left_value'), // Nested Sets用（必要に応じて）
  rightValue: integer('right_value'), // Nested Sets用（必要に応じて）
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## 3. データ型とNULL設計

### 避けるべきアンチパターン

**Fear of the Unknown (未知への恐怖)**
- NULLを避けるために不自然なデフォルト値を使用しない
- `'unknown'`, `'N/A'`, `0`のような意味のない値での埋め合わせを避ける

### 推奨するNULL許可設計

```typescript
// ✅ 適切なNULL許可設計
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  firstName: varchar('first_name', { length: 100 }), // 任意項目はNULL許可
  lastName: varchar('last_name', { length: 100 }),   // 任意項目はNULL許可
  email: varchar('email', { length: 255 }).notNull(), // 必須項目はNOT NULL
  birthDate: date('birth_date'), // 不明な場合は'1900-01-01'ではなくNULL
  profileImageUrl: text('profile_image_url'), // 画像がない場合はNULL
  biography: text('biography'), // 空文字列ではなくNULL
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

## 4. インデックス戦略

### 避けるべきアンチパターン

**Index Shotgun (インデックス散弾銃)**
- 無秩序なインデックス作成を避ける
- 使用されないインデックスの蓄積を防ぐ

**Implicit Columns (暗黙の列)**
- クエリパフォーマンスを考慮しないカラム設計を避ける

### 推奨するインデックス設計

```typescript
// ✅ 戦略的なインデックス設計
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  startDateTime: timestamp('start_date_time').notNull(),
  endDateTime: timestamp('end_date_time').notNull(),
  category: varchar('category', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // 組織ごとのイベント検索用（頻繁に使用される）
  orgIdIdx: index('events_organization_id_idx').on(table.organizationId),
  
  // 時系列での検索用（日付範囲検索）
  startTimeIdx: index('events_start_time_idx').on(table.startDateTime),
  
  // ステータス + 開始時間の複合検索用（管理画面での絞り込み）
  statusStartTimeIdx: index('events_status_start_time_idx').on(table.status, table.startDateTime),
  
  // カテゴリ別検索用
  categoryIdx: index('events_category_idx').on(table.category),
  
  // 全文検索用（PostgreSQLの場合）
  titleSearchIdx: index('events_title_search_idx').using('gin', sql`to_tsvector('english', ${table.title})`),
}));
```

## 5. トランザクション設計

### 避けるべきアンチパターン

**Reading Dirty Data (ダーティリード)**
- 不適切な分離レベルによるデータ不整合を避ける

**Phantom Files (ファントムファイル)**
- トランザクション境界を考慮しないファイル操作を避ける

### 推奨するトランザクション設計

```typescript
// ✅ 適切なトランザクション境界
export const createEventWithBookings = (db: Database) => 
  async (eventData: EventCreateInput, initialBookings: BookingCreateInput[]) => {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        // 1. イベント作成
        const eventResult = await tx.insert(events).values({
          organizationId: eventData.organizationId,
          title: eventData.title,
          description: eventData.description,
          capacity: eventData.capacity,
          startDateTime: eventData.startDateTime,
          endDateTime: eventData.endDateTime,
        }).returning();
        
        const event = eventResult[0];
        
        // 2. 初期予約の作成（必要な場合）
        if (initialBookings.length > 0) {
          const bookingData = initialBookings.map(booking => ({
            ...booking,
            eventId: event.id,
          }));
          await tx.insert(bookings).values(bookingData);
        }
        
        // 3. イベント統計の初期化
        await tx.insert(eventStats).values({
          eventId: event.id,
          totalCapacity: eventData.capacity,
          currentBookings: initialBookings.length,
          availableSlots: eventData.capacity - initialBookings.length,
        });
        
        return event;
      }),
      (error) => ({ 
        code: 'TRANSACTION_ERROR', 
        message: 'Failed to create event with bookings', 
        details: error 
      })
    );
  };

// ✅ 読み取り専用トランザクションの活用
export const getEventWithBookings = (db: Database) => (eventId: string) => {
  return ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      const event = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (event.length === 0) return null;
      
      const bookings = await tx.select().from(bookings).where(eq(bookings.eventId, eventId));
      
      return {
        ...event[0],
        bookings,
      };
    }, { accessMode: 'read only' }), // PostgreSQLの読み取り専用トランザクション
    (error) => ({ 
      code: 'DATABASE_ERROR', 
      message: 'Failed to fetch event with bookings', 
      details: error 
    })
  );
};
```

## 6. マイグレーション設計

### マイグレーションのベストプラクティス

```typescript
// ✅ 安全なマイグレーション設計
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  // 1. 新しいテーブルの作成
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      path TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL DEFAULT 0,
      parent_id UUID REFERENCES event_categories(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  
  // 2. インデックスの作成
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS event_categories_path_idx 
    ON event_categories(path)
  `);
  
  // 3. 既存テーブルへの列追加（NULL許可で開始）
  await db.execute(sql`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES event_categories(id)
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  // ロールバック処理
  await db.execute(sql`DROP INDEX IF EXISTS event_categories_path_idx`);
  await db.execute(sql`ALTER TABLE events DROP COLUMN IF EXISTS category_id`);
  await db.execute(sql`DROP TABLE IF EXISTS event_categories`);
}
```

## 7. DB操作関数の設計

### Result型を活用したエラーハンドリング

```typescript
// ✅ 型安全なDB操作関数
export const findEventWithOrganization = (db: Database) => (eventId: string) => {
  return ResultAsync.fromPromise(
    db
      .select({
        event: events,
        organization: organizations,
      })
      .from(events)
      .innerJoin(organizations, eq(events.organizationId, organizations.id))
      .where(eq(events.id, eventId))
      .limit(1)
      .then(results => {
        if (results.length === 0) return null;
        
        const result = results[0];
        return {
          id: result.event.id,
          title: result.event.title,
          description: result.event.description,
          capacity: result.event.capacity,
          startDateTime: result.event.startDateTime,
          endDateTime: result.event.endDateTime,
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            email: result.organization.email,
          },
          createdAt: result.event.createdAt,
          updatedAt: result.event.updatedAt,
        };
      }),
    (error) => ({ 
      code: 'DATABASE_ERROR', 
      message: 'Failed to fetch event with organization', 
      details: error 
    })
  );
};
```

## 8. DB設計レビューのチェックリスト

### スキーマ設計時に確認すべき項目

- [ ] **主キー設計**: 各テーブルに適切な主キーが設定されているか
- [ ] **外部キー制約**: 参照関係に外部キー制約が正しく設定されているか
- [ ] **NULL許可/NOT NULL**: 業務要件に合致したNULL制約が設定されているか
- [ ] **インデックス戦略**: 想定クエリをカバーするインデックスが適切に設定されているか
- [ ] **正規化レベル**: 第3正規形を基準とし、必要に応じた非正規化が検討されているか
- [ ] **階層データ表現**: 階層データの表現方法が要件に適しているか
- [ ] **データ型選択**: 適切なデータ型とサイズが選択されているか
- [ ] **制約設定**: CHECK制約、UNIQUE制約が適切に設定されているか
- [ ] **命名規約**: 一貫した命名規約が適用されているか

### パフォーマンス設計時に確認すべき項目

- [ ] **クエリパターン**: 想定されるクエリパターンが効率的に実行できるか
- [ ] **インデックス効果**: 作成したインデックスが実際に使用されるか
- [ ] **結合最適化**: JOINが効率的に実行できるテーブル設計になっているか
- [ ] **分割戦略**: 大量データのパーティショニング戦略が検討されているか

### セキュリティ設計時に確認すべき項目

- [ ] **参照整合性**: 外部キー制約による参照整合性が保証されているか
- [ ] **アクセス制御**: 適切なDB権限設定が計画されているか
- [ ] **機密データ**: 個人情報やパスワードの適切な取り扱いが設計されているか

## 9. ユーザーとの設計議論フロー

DB設計時は以下のフローでユーザーと議論を行います：

### 1. 要件の明確化
- **エンティティの責務**: 各テーブルが担う役割と境界の確認
- **データ制約**: 必須項目、一意性制約、値の範囲制約の確認
- **パフォーマンス要件**: 想定データ量、アクセスパターン、応答時間要件の確認
- **運用要件**: バックアップ、災害復旧、データ保持期間の確認

### 2. アンチパターンの検出
- **提案設計の分析**: SQL Antipatternsの観点から問題のある設計パターンを特定
- **リスクの説明**: 各アンチパターンが引き起こす潜在的な問題の説明
- **影響範囲の評価**: パフォーマンス、保守性、拡張性への影響の評価

### 3. 代替案の提示
- **推奨パターン**: アンチパターンを避ける具体的な設計代替案の提示
- **実装例**: Drizzle ORMでの具体的な実装コードの提示
- **マイグレーション戦略**: 既存データがある場合の移行戦略の提案

### 4. トレードオフの説明
- **メリット・デメリット**: 各設計選択肢の長所と短所の明示
- **将来の拡張性**: 要件変更時の対応容易性の評価
- **コスト分析**: 開発・運用コストの観点からの比較

### 5. 実装への落とし込み
- **スキーマ定義**: Drizzle ORMでの型安全なスキーマ定義
- **マイグレーション**: 安全なマイグレーション手順の提案
- **テスト戦略**: DB操作のテスト方法の提案
- **ドキュメント**: 設計判断の記録と将来の開発者への説明

この流れにより、SQL Antipatternsを避けた堅牢で保守性の高いデータベース設計を実現します。