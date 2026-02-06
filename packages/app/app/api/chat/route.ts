import { streamText, UIMessage, convertToModelMessages, type InferUITools, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createMessage, getNextSeq } from '@/lib/db/messages';
import { createTools } from '@/lib/db/tools';
import { convertUIMessageToDBMessage, convertToolPartToDBTool } from '@/lib/db/utils';
import type { ToolUIPart, DynamicToolUIPart, LanguageModel } from 'ai';
import { createLanguageModel, getModelForCapability } from '@/lib/models/get-model';
import { generateImageTool } from '@/tools/generate-image';
import { insertImageTool } from '@/tools/insert-image';
import { drawElementTool } from '@/tools/draw-element';
import { splitLayersTool } from '@/tools/split-layers';
import { NextResponse } from 'next/server';
import { ChatErrorCode, isAuthenticationError } from '@/lib/errors';

const tools = {
  generateImage: generateImageTool,
  insertImage: insertImageTool,
  drawElement: drawElementTool,
  splitLayers: splitLayersTool,
};
export type ChatTools = InferUITools<typeof tools>;

type CustomUIMessage = UIMessage<
  never,
  {
    url: { url: string; title: string; content: string };
    mask: { mask: string };
  }
>;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// 错误响应接口
export interface ChatErrorResponse {
  error: string;
  errorCode: ChatErrorCode;
  details?: string;
}

/**
 * 创建错误响应
 */
function createErrorResponse(
  errorCode: ChatErrorCode,
  message: string,
  details?: string,
  status: number = 500
): NextResponse<ChatErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      errorCode,
      ...(details && { details }),
    },
    { status }
  );
}

export async function POST(req: Request) {
  const {
    messages,
    // model,
    // webSearch,
    chatId,
  }: {
    messages: UIMessage[];
    // model: string;
    // webSearch: boolean;
    chatId?: string;
  } = await req.json();

  // 获取用户信息（用于验证权限）
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorResponse(
      'UNAUTHORIZED',
      '用户未授权，请先登录',
      authError?.message,
      401
    );
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

  // 如果用户没有指定 model，尝试从 capability preference 获取
  const modelInfo = await getModelForCapability(user.id, 'chat');
  if (!modelInfo) {
    return createErrorResponse(
      'MODEL_NOT_FOUND',
      '未找到可用的模型，请在设置中配置模型',
      'No model configured for chat capability'
    );
  }

  let languageModel: LanguageModel | undefined;
  try {
    languageModel = createLanguageModel(modelInfo);
  } catch (error) {
    console.error('Error creating language model:', error);

    // 判断是否是认证错误
    if (isAuthenticationError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResponse(
        'AUTHENTICATION_ERROR',
        'API Key 认证失败，请检查设置中的 API Key 是否正确',
        errorMessage
      );
    }

    // 其他错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      '创建语言模型时发生错误',
      errorMessage
    );
  }

  if (!languageModel) {
    return createErrorResponse(
      'INTERNAL_ERROR',
      '无法创建语言模型实例',
      'Language model creation returned undefined'
    );
  }

  const modelMessages = await convertToModelMessages<CustomUIMessage>(messages as CustomUIMessage[], {
    tools,
    // @see https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages#custom-data-part-conversion
    convertDataPart: (part) => {
      console.log('part', part);
      if (part.type === 'data-url') {
        return {
          type: 'text',
          text: `[Reference: ${part.data.title}](${part.data.url})\n\n${part.data.content}`,
        };
      }
      if (part.type === 'data-mask') {
        return {
          type: 'text',
          text: `[Mask](${part.data})`,
        };
      }
    },
  });

  // console.log('modelMessages', JSON.stringify(modelMessages[modelMessages.length - 1]));

  let result;
  try {
    result = streamText({
      model: languageModel,
      messages: modelMessages,
      system:
        // TODO: System prompt is configurable
        'You are a helpful assistant that can answer questions and help with tasks. ' +
        'When using tools that generate images, do NOT include image URLs in your response message. ' +
        'The tool output component will automatically display the generated images, so there is no need to mention them in your text response.',
      stopWhen: stepCountIs(5),
      tools,
    });
  } catch (error) {
    console.error('Error in streamText:', error);

    // 判断是否是认证错误（可能在 streamText 调用时抛出）
    if (isAuthenticationError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResponse(
        'AUTHENTICATION_ERROR',
        'API Key 认证失败，请检查设置中的 API Key 是否正确',
        errorMessage
      );
    }

    // 其他错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      '启动流式响应时发生错误',
      errorMessage
    );
  }

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