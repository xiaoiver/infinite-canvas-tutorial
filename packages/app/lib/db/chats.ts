import { eq, desc } from 'drizzle-orm';
import { db, type Chat, type NewChat } from './index';
import { chats, projects } from './schema';

/**
 * 获取项目的所有聊天记录
 */
export async function getProjectChats(projectId: string, userId: string): Promise<Chat[]> {
  // 首先验证项目属于该用户
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project[0] || project[0].userId !== userId) {
    return [];
  }

  return await db
    .select()
    .from(chats)
    .where(eq(chats.projectId, projectId))
    .orderBy(desc(chats.createdAt));
}

/**
 * 根据 ID 获取聊天记录
 */
export async function getChatById(chatId: string, userId: string): Promise<Chat | null> {
  const result = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, chatId))
    .limit(1);

  const row = result[0];

  // 确保用户只能访问自己项目下的聊天记录
  if (row && row.project.userId === userId) {
    return row.chat;
  }

  return null;
}

/**
 * 创建新聊天记录
 */
export async function createChat(
  data: Omit<NewChat, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Chat | null> {
  // 首先验证项目属于该用户
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, data.projectId))
    .limit(1);

  if (!project[0] || project[0].userId !== userId) {
    return null;
  }

  const result = await db
    .insert(chats)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0] || null;
}

/**
 * 更新聊天记录
 */
export async function updateChat(
  chatId: string,
  userId: string,
  data: Partial<Omit<NewChat, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
): Promise<Chat | null> {
  // 首先验证聊天记录属于该用户的项目
  const existingChat = await getChatById(chatId, userId);
  if (!existingChat) {
    return null;
  }

  const result = await db
    .update(chats)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, chatId))
    .returning();

  return result[0] || null;
}

/**
 * 删除聊天记录
 */
export async function deleteChat(chatId: string, userId: string): Promise<boolean> {
  // 首先验证聊天记录属于该用户的项目
  const existingChat = await getChatById(chatId, userId);
  if (!existingChat) {
    return false;
  }

  await db
    .delete(chats)
    .where(eq(chats.id, chatId));

  return true;
}

/**
 * 删除项目的所有聊天记录
 */
export async function deleteProjectChats(projectId: string, userId: string): Promise<boolean> {
  // 首先验证项目属于该用户
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project[0] || project[0].userId !== userId) {
    return false;
  }

  await db
    .delete(chats)
    .where(eq(chats.projectId, projectId));

  return true;
}

