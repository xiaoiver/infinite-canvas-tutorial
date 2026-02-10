import { eq, inArray } from 'drizzle-orm';
import { db, type Tool, type NewTool } from './index';
import { tools, messages, chats, projects } from './schema';

/**
 * 获取消息的所有 tool calls
 */
export async function getMessageTools(messageId: string, userId: string): Promise<Tool[]> {
  // 首先验证消息属于该用户的项目
  const message = await db
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

  if (!message[0] || message[0].project.userId !== userId) {
    return [];
  }

  return await db
    .select()
    .from(tools)
    .where(eq(tools.messageId, messageId))
    .orderBy(tools.createdAt);
}

/**
 * 批量获取多个消息的 tool calls
 */
export async function getMessagesTools(
  messageIds: string[],
  userId: string
): Promise<Tool[]> {
  if (messageIds.length === 0) {
    return [];
  }

  // 验证所有消息都属于该用户的项目
  const validMessages = await db
    .select({
      message: messages,
      chat: chats,
      project: projects,
    })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(inArray(messages.id, messageIds));

  const validMessageIds = validMessages
    .filter((row) => row.project.userId === userId)
    .map((row) => row.message.id);

  if (validMessageIds.length === 0) {
    return [];
  }

  return await db
    .select()
    .from(tools)
    .where(inArray(tools.messageId, validMessageIds))
    .orderBy(tools.createdAt);
}

/**
 * 根据 ID 获取 tool call
 */
export async function getToolById(toolId: string, userId: string): Promise<Tool | null> {
  const result = await db
    .select({
      tool: tools,
      message: messages,
      chat: chats,
      project: projects,
    })
    .from(tools)
    .innerJoin(messages, eq(tools.messageId, messages.id))
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(tools.id, toolId))
    .limit(1);

  const row = result[0];

  // 确保用户只能访问自己项目下的 tool calls
  if (row && row.project.userId === userId) {
    return row.tool;
  }

  return null;
}

/**
 * 根据 toolCallId 获取 tool call
 */
export async function getToolByCallId(toolCallId: string, userId: string): Promise<Tool | null> {
  const result = await db
    .select({
      tool: tools,
      message: messages,
      chat: chats,
      project: projects,
    })
    .from(tools)
    .innerJoin(messages, eq(tools.messageId, messages.id))
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(tools.toolCallId, toolCallId))
    .limit(1);

  const row = result[0];

  // 确保用户只能访问自己项目下的 tool calls
  if (row && row.project.userId === userId) {
    return row.tool;
  }

  return null;
}

/**
 * 创建新 tool call
 */
export async function createTool(
  data: Omit<NewTool, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Tool | null> {
  // 首先验证消息属于该用户的项目
  const message = await db
    .select({
      message: messages,
      chat: chats,
      project: projects,
    })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .innerJoin(projects, eq(chats.projectId, projects.id))
    .where(eq(messages.id, data.messageId))
    .limit(1);

  if (!message[0] || message[0].project.userId !== userId) {
    return null;
  }

  const result = await db
    .insert(tools)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0] || null;
}

/**
 * 批量创建 tool calls
 */
export async function createTools(
  dataArray: Array<Omit<NewTool, 'id' | 'createdAt' | 'updatedAt'>>,
  userId: string
): Promise<Tool[]> {
  if (dataArray.length === 0) {
    return [];
  }

  // 验证所有 tool calls 都属于同一个消息，且该消息属于该用户
  const messageId = dataArray[0].messageId;
  const message = await db
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

  if (!message[0] || message[0].project.userId !== userId) {
    return [];
  }

  // 验证所有 tool calls 都属于同一个消息
  if (!dataArray.every((data) => data.messageId === messageId)) {
    return [];
  }

  const result = await db
    .insert(tools)
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
 * 更新 tool call
 */
export async function updateTool(
  toolId: string,
  userId: string,
  data: Partial<Omit<NewTool, 'id' | 'messageId' | 'toolCallId' | 'createdAt' | 'updatedAt'>>
): Promise<Tool | null> {
  // 首先验证 tool call 属于该用户的项目
  const existingTool = await getToolById(toolId, userId);
  if (!existingTool) {
    return null;
  }

  const result = await db
    .update(tools)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(tools.id, toolId))
    .returning();

  return result[0] || null;
}

/**
 * 根据 toolCallId 更新 tool call（用于流式更新）
 * 如果工具不存在，会尝试创建它（需要提供 messageId 和 toolName）
 */
export async function updateToolByCallId(
  toolCallId: string,
  userId: string,
  data: Partial<Omit<NewTool, 'id' | 'messageId' | 'toolCallId' | 'createdAt' | 'updatedAt'>>,
  options?: {
    messageId?: string;
    toolName?: string;
    toolType?: string;
    input?: any;
  }
): Promise<Tool | null> {
  // 首先验证 tool call 属于该用户的项目
  const existingTool = await getToolByCallId(toolCallId, userId);
  
  if (!existingTool) {
    // 如果工具不存在，尝试创建它（需要提供 messageId 和 toolName）
    if (options?.messageId && options?.toolName) {
      const toolType = options.toolType || `tool-${options.toolName}`;
      const newToolData: Omit<NewTool, 'id' | 'createdAt' | 'updatedAt'> = {
        messageId: options.messageId,
        toolCallId,
        toolType,
        toolName: toolType === 'dynamic-tool' ? options.toolName : undefined,
        state: data.state || 'output-available',
        input: options.input !== undefined ? options.input : null,
        output: data.output !== undefined ? data.output : null,
        errorText: data.errorText !== undefined ? data.errorText : null,
        title: data.title !== undefined ? data.title : null,
        providerExecuted: data.providerExecuted !== undefined ? data.providerExecuted : null,
        callProviderMetadata: data.callProviderMetadata !== undefined ? data.callProviderMetadata : null,
      };
      
      return await createTool(newToolData, userId);
    }
    
    // 如果工具不存在且没有提供创建所需的信息，返回 null
    return null;
  }

  const result = await db
    .update(tools)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(tools.toolCallId, toolCallId))
    .returning();

  return result[0] || null;
}

/**
 * 删除 tool call
 */
export async function deleteTool(toolId: string, userId: string): Promise<boolean> {
  // 首先验证 tool call 属于该用户的项目
  const existingTool = await getToolById(toolId, userId);
  if (!existingTool) {
    return false;
  }

  await db
    .delete(tools)
    .where(eq(tools.id, toolId));

  return true;
}

/**
 * 删除消息的所有 tool calls
 */
export async function deleteMessageTools(messageId: string, userId: string): Promise<boolean> {
  // 首先验证消息属于该用户的项目
  const message = await db
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

  if (!message[0] || message[0].project.userId !== userId) {
    return false;
  }

  await db
    .delete(tools)
    .where(eq(tools.messageId, messageId));

  return true;
}
