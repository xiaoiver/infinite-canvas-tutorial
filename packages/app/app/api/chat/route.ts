import { streamText, UIMessage, convertToModelMessages, type InferUITools, stepCountIs, } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createMessage, getNextSeq } from '@/lib/db/messages';
import { createTools } from '@/lib/db/tools';
import { convertUIMessageToDBMessage, convertToolPartToDBTool } from '@/lib/db/utils';
import type { ToolUIPart, DynamicToolUIPart } from 'ai';

import { generateImageTool } from '@/tools/generate-image';

const tools = {
  generateImage: generateImageTool,
};
export type ChatTools = InferUITools<typeof tools>;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
    chatId,
  }: {
    messages: UIMessage[];
    model: string;
    webSearch: boolean;
    chatId?: string;
  } = await req.json();

  // 获取用户信息（用于验证权限）
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 如果有 chatId，保存用户消息到数据库
  let userMessageSeq: number | null = null;
  if (chatId) {
    try {
      // 获取最后一个消息（用户刚发送的消息）
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        const nextSeq = await getNextSeq(chatId, user.id);
        if (nextSeq > 0) {
          const dbMessage = convertUIMessageToDBMessage(
            lastMessage,
            chatId,
            nextSeq
          );
          const savedMessage = await createMessage(dbMessage, user.id);
          if (savedMessage) {
            userMessageSeq = savedMessage.seq;
          }
        }
      }
    } catch (error) {
      console.error('Error saving user message:', error);
      // 继续执行，不阻止流式响应
    }
  }

  const result = streamText({
    model: webSearch ? 'perplexity/sonar' : model,
    messages: await convertToModelMessages(messages),
    system:
      'You are a helpful assistant that can answer questions and help with tasks. ' +
      'When using tools that generate images, do NOT include image URLs in your response message. ' +
      'The tool output component will automatically display the generated images, so there is no need to mention them in your text response.',
    stopWhen: stepCountIs(5),
    tools,
  });

  // send sources and reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
    onFinish: async (event) => {
      // 流式响应完成后，保存助手回复到数据库
      if (chatId && userMessageSeq !== null) {
        try {
          // 优先从 event.messages 中获取最后一条助手消息（包含完整的 tool parts）
          // 如果找不到，则使用 event.responseMessage
          const allAssistantMessages = event.messages.filter(
            (msg) => msg.role === 'assistant'
          );
          const assistantMessage = allAssistantMessages.length > 0
            ? allAssistantMessages[allAssistantMessages.length - 1]
            : event.responseMessage;

          if (assistantMessage && assistantMessage.role === 'assistant') {
            const assistantSeq = userMessageSeq + 1;
            const dbMessage = convertUIMessageToDBMessage(
              assistantMessage,
              chatId,
              assistantSeq
            );
            const savedMessage = await createMessage(dbMessage, user.id);

            // 保存 tool calls 到数据库
            if (savedMessage) {
              const toolParts = (assistantMessage.parts || []).filter(
                (part): part is ToolUIPart | DynamicToolUIPart =>
                  (typeof part.type === 'string' && part.type.startsWith('tool-')) ||
                  part.type === 'dynamic-tool'
              );

              if (toolParts.length > 0) {
                const dbTools = toolParts.map((toolPart) => {
                  return convertToolPartToDBTool(toolPart, savedMessage.id);
                });

                await createTools(dbTools, user.id);
              }
            }
          }
        } catch (error) {
          console.error('Error saving assistant message:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        }
      } else {
        console.log('Skipping save: chatId =', chatId, 'userMessageSeq =', userMessageSeq);
      }
    },
  });
}