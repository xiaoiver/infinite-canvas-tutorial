import { UIMessage } from '@ai-sdk/react';
import type { ToolUIPart, DynamicToolUIPart } from 'ai';
import { Message, type NewMessage, type Tool, type NewTool } from './index';
import { getMessagesTools } from './tools';

/**
 * 将数据库中的 messages 转换为 UIMessage 格式
 * 每个 message 记录对应一个 UIMessage，parts 从 text、metadata 和 tools 表中提取
 */
export async function convertMessagesToUIMessages(
  dbMessages: Message[],
  userId: string
): Promise<UIMessage[]> {
  const sortedMessages = dbMessages.sort((a, b) => a.seq - b.seq);

  // 批量加载所有消息的 tool calls
  const messageIds = sortedMessages.map(m => m.id);
  const allTools = messageIds.length > 0
    ? await getMessagesTools(messageIds, userId)
    : [];

  // 按 messageId 分组 tool calls
  const toolsByMessageId = new Map<string, Tool[]>();
  for (const tool of allTools) {
    if (!toolsByMessageId.has(tool.messageId)) {
      toolsByMessageId.set(tool.messageId, []);
    }
    toolsByMessageId.get(tool.messageId)!.push(tool);
  }

  return sortedMessages.map((dbMessage) => {
    const parts: UIMessage['parts'] = [];

    // 添加 text part（如果有）
    if (dbMessage.text) {
      parts.push({
        type: 'text',
        text: dbMessage.text,
        state: dbMessage.isFinal ? 'done' : undefined,
      });
    }

    // 从 metadata 中提取其他 parts
    if (dbMessage.metadata && typeof dbMessage.metadata === 'object') {
      const metadata = dbMessage.metadata as any;

      // 提取 reasoning part
      if ('reasoning' in metadata && typeof metadata.reasoning === 'string') {
        parts.push({
          type: 'reasoning',
          text: metadata.reasoning,
        });
      }

      // 提取 source-url parts
      if ('sources' in metadata && Array.isArray(metadata.sources)) {
        for (const source of metadata.sources) {
          if (source && typeof source === 'object' && 'url' in source) {
            parts.push({
              type: 'source-url',
              url: source.url as string,
              sourceId: source.sourceId as string,
            });
          }
        }
      }
    }

    // 从 tools 表中加载 tool parts
    const messageTools = toolsByMessageId.get(dbMessage.id) || [];
    for (const tool of messageTools) {
      if (tool.toolType === 'dynamic-tool') {
        const toolPart = {
          type: 'dynamic-tool' as const,
          toolName: tool.toolName || '',
          toolCallId: tool.toolCallId,
          title: tool.title || undefined,
          providerExecuted: tool.providerExecuted || undefined,
          state: tool.state,
          input: tool.input,
          output: tool.output,
          errorText: tool.errorText || undefined,
          callProviderMetadata: tool.callProviderMetadata,
        } as DynamicToolUIPart;
        parts.push(toolPart);
      } else {
        // 静态 tool (tool-${NAME})
        const toolPart = {
          type: tool.toolType,
          toolCallId: tool.toolCallId,
          title: tool.title || undefined,
          providerExecuted: tool.providerExecuted || undefined,
          state: tool.state,
          input: tool.input,
          output: tool.output,
          errorText: tool.errorText || undefined,
          callProviderMetadata: tool.callProviderMetadata,
        } as ToolUIPart;
        parts.push(toolPart);
      }
    }

    return {
      id: dbMessage.id,
      role: dbMessage.role as 'system' | 'user' | 'assistant',
      metadata: dbMessage.metadata as any,
      parts,
    };
  });
}

/**
 * 同步版本：将数据库中的 messages 转换为 UIMessage 格式（不加载 tools）
 * 用于不需要 tool parts 的场景
 */
export function convertMessagesToUIMessagesSync(dbMessages: Message[]): UIMessage[] {
  return dbMessages
    .sort((a, b) => a.seq - b.seq) // 按 seq 排序
    .map((dbMessage) => {
      const parts: UIMessage['parts'] = [];

      // 添加 text part（如果有）
      if (dbMessage.text) {
        parts.push({
          type: 'text',
          text: dbMessage.text,
          state: dbMessage.isFinal ? 'done' : undefined,
        });
      }

      // 从 metadata 中提取其他 parts
      if (dbMessage.metadata && typeof dbMessage.metadata === 'object') {
        const metadata = dbMessage.metadata as any;

        // 提取 reasoning part
        if ('reasoning' in metadata && typeof metadata.reasoning === 'string') {
          parts.push({
            type: 'reasoning',
            text: metadata.reasoning,
          });
        }

        // 提取 source-url parts
        if ('sources' in metadata && Array.isArray(metadata.sources)) {
          for (const source of metadata.sources) {
            if (source && typeof source === 'object' && 'url' in source) {
              parts.push({
                type: 'source-url',
                url: source.url as string,
                sourceId: source.sourceId as string,
              });
            }
          }
        }
      }

      return {
        id: dbMessage.id,
        role: dbMessage.role as 'system' | 'user' | 'assistant',
        metadata: dbMessage.metadata as any,
        parts,
      };
    });
}

/**
 * 将 UIMessage 转换为数据库 Message 格式
 * 提取 text part 作为 text 字段，其他 parts 存储在 metadata 中
 * 注意：tool parts 不会存储在 metadata 中，而是单独存储到 tools 表
 */
export function convertUIMessageToDBMessage(
  uiMessage: UIMessage,
  chatId: string,
  seq: number
): Omit<NewMessage, 'id' | 'createdAt' | 'updatedAt'> {
  // 提取 text part
  const textPart = uiMessage.parts.find((part) => part.type === 'text');
  const text = textPart?.type === 'text' ? textPart.text : null;

  // 提取其他 parts 到 metadata（不包括 tool parts）
  const metadata: any = { ...(uiMessage.metadata || {}) };

  // 提取 reasoning part
  const reasoningPart = uiMessage.parts.find((part) => part.type === 'reasoning');
  if (reasoningPart?.type === 'reasoning') {
    metadata.reasoning = reasoningPart.text;
  }

  // 提取 source-url parts
  const sourceParts = uiMessage.parts.filter((part) => part.type === 'source-url');
  if (sourceParts.length > 0) {
    metadata.sources = sourceParts.map((part) => {
      if (part.type === 'source-url') {
        return { url: part.url };
      }
      return null;
    }).filter(Boolean);
  }

  // 判断是否为最终消息（所有 text parts 都是 done 状态）
  const isFinal = textPart?.state === 'done' ||
    uiMessage.parts.every((part) => part.type !== 'text' || part.state === 'done');

  return {
    chatId,
    seq,
    role: uiMessage.role,
    text,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    status: 'sent',
    isFinal,
  };
}

/**
 * 将 ToolUIPart 或 DynamicToolUIPart 转换为数据库 Tool 格式
 */
export function convertToolPartToDBTool(
  toolPart: ToolUIPart | DynamicToolUIPart,
  messageId: string
): Omit<NewTool, 'id' | 'createdAt' | 'updatedAt'> {
  const isDynamic = toolPart.type === 'dynamic-tool';

  return {
    messageId,
    toolCallId: toolPart.toolCallId,
    toolType: toolPart.type,
    toolName: isDynamic ? toolPart.toolName : undefined,
    state: toolPart.state,
    input: toolPart.input !== undefined ? (toolPart.input as any) : null,
    output: 'output' in toolPart && toolPart.output !== undefined ? (toolPart.output as any) : null,
    errorText: 'errorText' in toolPart ? toolPart.errorText : null,
    title: 'title' in toolPart ? toolPart.title : null,
    providerExecuted: 'providerExecuted' in toolPart ? toolPart.providerExecuted : null,
    callProviderMetadata: 'callProviderMetadata' in toolPart ? (toolPart.callProviderMetadata as any) : null,
  };
}

