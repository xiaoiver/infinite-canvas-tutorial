import { UIMessage } from '@ai-sdk/react';
import { Message, type NewMessage } from './index';

/**
 * 将数据库中的 messages 转换为 UIMessage 格式
 * 每个 message 记录对应一个 UIMessage，parts 从 text 和 metadata 中提取
 */
export function convertMessagesToUIMessages(dbMessages: Message[]): UIMessage[] {
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
 */
export function convertUIMessageToDBMessage(
  uiMessage: UIMessage,
  chatId: string,
  seq: number
): Omit<NewMessage, 'id' | 'createdAt' | 'updatedAt'> {
  // 提取 text part
  const textPart = uiMessage.parts.find((part) => part.type === 'text');
  const text = textPart?.type === 'text' ? textPart.text : null;

  // 提取其他 parts 到 metadata
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

