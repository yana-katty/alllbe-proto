import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Organizations table - 展示を主催する組織
export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 50 }),
    website: varchar('website', { length: 255 }),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Zod schemas for validation
export const insertOrganizationSchema = createInsertSchema(organizations, {
    name: z.string().min(1, 'Organization name is required').max(255),
    email: z.string().email('Invalid email format'),
    phone: z.string().optional(),
    website: z.string().url('Invalid URL format').optional(),
    description: z.string().optional(),
    address: z.string().optional(),
});

export const selectOrganizationSchema = createSelectSchema(organizations);

export const updateOrganizationSchema = insertOrganizationSchema.partial().omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

// Type definitions
export type Organization = z.infer<typeof selectOrganizationSchema>;
export type NewOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
