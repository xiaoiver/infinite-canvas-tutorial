import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// 定义 projects 表
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // 关联到 auth.users(id)
  name: text('name').notNull(),
  description: text('description'),
  canvasData: text('canvas_data'), // Canvas 场景图序列化信息（JSON string）
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 注意：由于 auth.users 是 Supabase 的内置表，外键约束需要在 SQL 迁移中手动创建
// 外键关系：projects.user_id -> auth.users.id

