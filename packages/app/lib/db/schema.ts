import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, numeric, unique } from 'drizzle-orm/pg-core';
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

// 定义 tools 表（存储 message 中的 tool call）
export const tools = pgTable('tools', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').notNull(), // 关联到 messages(id)
  toolCallId: text('tool_call_id').notNull(), // Tool call 的唯一标识符
  toolType: text('tool_type').notNull(), // Tool 类型：'tool-${NAME}' 或 'dynamic-tool'
  toolName: text('tool_name'), // Tool 名称（对于 dynamic-tool）
  state: text('state').notNull(), // Tool 状态：'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied'
  input: jsonb('input'), // Tool 输入参数（JSON）
  output: jsonb('output'), // Tool 输出结果（JSON）
  errorText: text('error_text'), // 错误信息（如果有）
  title: text('title'), // Tool 标题
  providerExecuted: boolean('provider_executed'), // 是否由 provider 执行
  callProviderMetadata: jsonb('call_provider_metadata'), // Provider 元数据
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

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  tools: many(tools),
}));

export const toolsRelations = relations(tools, ({ one }) => ({
  message: one(messages, {
    fields: [tools.messageId],
    references: [messages.id],
  }),
}));

// 定义 user_provider_keys 表（存储各 provider 的 API Key）
export const userProviderKeys = pgTable('user_provider_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // 关联到 auth.users(id)
  provider: text('provider').notNull(), // e.g. 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter'
  apiKeyEncrypted: text('api_key_encrypted').notNull(), // 加密存储的 API Key
  label: text('label'), // 可选：用户自定义名称（"工作用 OpenAI"）
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserProviderLabel: unique().on(table.userId, table.provider, table.label),
}));

// 定义 user_capability_preferences 表（按能力维度配置模型）
export const userCapabilityPreferences = pgTable('user_capability_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // 关联到 auth.users(id)
  capability: text('capability').notNull(), // 'text' | 'chat' | 'image' | 'image-layered'
  provider: text('provider').notNull(), // 当前选中的 provider
  model: text('model').notNull(), // e.g. 'gpt-4.1-mini', 'claude-3-5-sonnet', 'gpt-image-1'
  providerKeyId: uuid('provider_key_id'), // 明确绑定到某个 key（可选）
  config: jsonb('config'), // 能力特定的配置（temperature, maxTokens, size, voice 等）
  isDefault: boolean('is_default').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserCapability: unique().on(table.userId, table.capability),
}));


// 定义 user_preferences 表（存储其他 UI/行为偏好）
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey(), // 关联到 auth.users(id)，每个用户只有一条记录
  uiTheme: text('ui_theme').default('system'), // UI 主题
  language: text('language').default('en'), // 语言偏好
  extra: jsonb('extra'), // 其他扩展偏好（JSONB）
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 定义关系
export const userProviderKeysRelations = relations(userProviderKeys, ({ many }) => ({
  capabilityPreferences: many(userCapabilityPreferences),
}));

export const userCapabilityPreferencesRelations = relations(userCapabilityPreferences, ({ one }) => ({
  providerKey: one(userProviderKeys, {
    fields: [userCapabilityPreferences.providerKeyId],
    references: [userProviderKeys.id],
  }),
}));


// 注意：由于 auth.users 是 Supabase 的内置表，外键约束需要在 SQL 迁移中手动创建
// 外键关系：
// - projects.user_id -> auth.users.id
// - chats.project_id -> projects.id
// - user_provider_keys.user_id -> auth.users.id
// - user_capability_preferences.user_id -> auth.users.id
// - user_capability_preferences.provider_key_id -> user_provider_keys.id
// - user_preferences.user_id -> auth.users.id

