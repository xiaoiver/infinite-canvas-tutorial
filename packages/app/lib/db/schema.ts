import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 定义 projects 表
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // 关联到 auth.users(id)
  name: text('name').notNull(),
  description: text('description'),
  canvasData: jsonb('canvas_data'), // Canvas 场景图序列化信息（JSONB）
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 定义 chats 表
export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull(), // 关联到 projects(id)
  title: text('title'), // 聊天标题，可选
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 定义 messages 表
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').notNull(), // 关联到 chats(id)
  seq: integer('seq').notNull(), // 消息在会话中的顺序号（用于排序）
  role: text('role').notNull(), // 发送者角色：'system' | 'user' | 'assistant'
  text: text('text'), // 文本内容（如果有），存储用户或助手的文本消息
  metadata: jsonb('metadata'), // 附加元数据（可存任意结构，留空或存储 UIMessage.metadata）
  status: text('status'), // 消息状态（如 'sent','failed' 等，自定义）
  isFinal: boolean('is_final').default(false).notNull(), // 是否为对话中的最终消息标志
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 定义关系（用于 Drizzle 的查询功能）
export const projectsRelations = relations(projects, ({ many }) => ({
  chats: many(chats),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

// 注意：由于 auth.users 是 Supabase 的内置表，外键约束需要在 SQL 迁移中手动创建
// 外键关系：
// - projects.user_id -> auth.users.id
// - chats.project_id -> projects.id

