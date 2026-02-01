import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 从环境变量获取数据库连接字符串
// 对于 Supabase，使用连接池 URL 或直接连接 URL
// 格式：postgresql://postgres:[password]@[host]:[port]/postgres
const connectionString = process.env.DATABASE_URL || '';

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 创建 postgres 客户端
// 使用连接池以提高性能
const client = postgres(connectionString, {
  max: 10, // 最大连接数
});

// 创建 drizzle 实例
export const db = drizzle(client, { schema });

// 导出 schema 以便在其他地方使用
export { schema };

// 导出类型
export type Project = typeof schema.projects.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;
export type Chat = typeof schema.chats.$inferSelect;
export type NewChat = typeof schema.chats.$inferInsert;
export type Message = typeof schema.messages.$inferSelect;
export type NewMessage = typeof schema.messages.$inferInsert;

