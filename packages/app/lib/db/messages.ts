import { eq, desc, asc, and } from 'drizzle-orm';
import { db, type Message, type NewMessage } from './index';
import { messages, chats, projects } from './schema';

/**
 * 获取聊天的所有消息，按顺序号排序
 */
export async function getChatMessages(chatId: string, userId: string): Promise<Message[]> {
  // 首先验证聊天记录属于该用户的项目
  const chat = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat[0] || chat[0].project.userId !== userId) {
    return [];
  }

  return await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.seq));
}

/**
 * 根据 ID 获取消息
 */
export async function getMessageById(messageId: string, userId: string): Promise<Message | null> {
  const result = await db
    .select({
      message: messages,
      chat: chats,
      project: projects,
    })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(messages.id, messageId))
    .limit(1);

  const row = result[0];

  // 确保用户只能访问自己项目下的消息
  if (row && row.project.userId === userId) {
    return row.message;
  }

  return null;
}

/**
 * 根据 chatId 和 seq 获取消息（用于检测 regenerate 操作）
 */
export async function getMessageByChatIdAndSeq(
  chatId: string,
  seq: number,
  userId: string
): Promise<Message | null> {
  const result = await db
    .select({
      message: messages,
      chat: chats,
      project: projects,
    })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(messages.seq, seq)
      )
    )
    .limit(1);

  const row = result[0];

  // 确保用户只能访问自己项目下的消息
  if (row && row.project.userId === userId) {
    return row.message;
  }

  return null;
}

/**
 * 创建新消息
 */
export async function createMessage(
  data: Omit<NewMessage, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Message | null> {
  // 首先验证聊天记录属于该用户的项目
  const chat = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, data.chatId))
    .limit(1);

  if (!chat[0] || chat[0].project.userId !== userId) {
    return null;
  }

  const result = await db
    .insert(messages)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0] || null;
}

/**
 * 批量创建消息
 */
export async function createMessages(
  dataArray: Array<Omit<NewMessage, 'id' | 'createdAt' | 'updatedAt'>>,
  userId: string
): Promise<Message[]> {
  if (dataArray.length === 0) {
    return [];
  }

  // 验证所有消息都属于同一个聊天，且该聊天属于该用户
  const chatId = dataArray[0].chatId;
  const chat = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat[0] || chat[0].project.userId !== userId) {
    return [];
  }

  // 验证所有消息都属于同一个聊天
  if (!dataArray.every((data) => data.chatId === chatId)) {
    return [];
  }

  const result = await db
    .insert(messages)
    .values(
      dataArray.map((data) => ({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
    .returning();

  return result;
}

/**
 * 更新消息
 */
export async function updateMessage(
  messageId: string,
  userId: string,
  data: Partial<Omit<NewMessage, 'id' | 'chatId' | 'createdAt' | 'updatedAt'>>
): Promise<Message | null> {
  // 首先验证消息属于该用户的项目
  const existingMessage = await getMessageById(messageId, userId);
  if (!existingMessage) {
    return null;
  }

  const result = await db
    .update(messages)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, messageId))
    .returning();

  return result[0] || null;
}

/**
 * 删除消息
 */
export async function deleteMessage(messageId: string, userId: string): Promise<boolean> {
  // 首先验证消息属于该用户的项目
  const existingMessage = await getMessageById(messageId, userId);
  if (!existingMessage) {
    return false;
  }

  await db
    .delete(messages)
    .where(eq(messages.id, messageId));

  return true;
}

/**
 * 删除聊天的所有消息
 */
export async function deleteChatMessages(chatId: string, userId: string): Promise<boolean> {
  // 首先验证聊天记录属于该用户的项目
  const chat = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat[0] || chat[0].project.userId !== userId) {
    return false;
  }

  await db
    .delete(messages)
    .where(eq(messages.chatId, chatId));

  return true;
}

/**
 * 获取聊天的最新助手消息（用于客户端工具创建时找到对应的 messageId）
 */
export async function getLatestAssistantMessage(chatId: string, userId: string): Promise<Message | null> {
  // 验证聊天记录属于该用户的项目
  const chat = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat[0] || chat[0].project.userId !== userId) {
    return null;
  }

  const result = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(messages.role, 'assistant')
      )
    )
    .orderBy(desc(messages.seq))
    .limit(1);

  return result[0] || null;
}

/**
 * 获取聊天的下一个顺序号
 */
export async function getNextSeq(chatId: string, userId: string): Promise<number> {
  // 验证聊天记录属于该用户的项目
  const chat = await db
    .select({
      chat: chats,
      project: projects,
    })
    .from(chats)
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(chats.id, chatId))
    .limit(1);

  if (!chat[0] || chat[0].project.userId !== userId) {
    return 0;
  }

  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.seq))
    .limit(1);

  if (result.length === 0) {
    return 1;
  }

  return (result[0].seq || 0) + 1;
}

