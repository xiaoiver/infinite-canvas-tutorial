import { streamText, UIMessage, convertToModelMessages, type InferUITools, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createMessage, getNextSeq, getMessageByChatIdAndSeq, deleteMessage } from '@/lib/db/messages';
import { createTools } from '@/lib/db/tools';
import { convertUIMessageToDBMessage, convertToolPartToDBTool } from '@/lib/db/utils';
import type { ToolUIPart, DynamicToolUIPart, LanguageModel } from 'ai';
import { createLanguageModel, getModelForCapability } from '@/lib/models/get-model';
import { generateImageTool } from '@/tools/generate-image';
import { insertImageTool } from '@/tools/insert-image';
import { drawElementTool } from '@/tools/draw-element';
import { decomposeImageTool } from '@/tools/decompose-image';
import { vectorizeImageTool } from '@/tools/vectorize-image';
import { NextResponse } from 'next/server';
import { ChatErrorCode, isAuthenticationError } from '@/lib/errors';

const tools = {
  generateImage: generateImageTool,
  insertImage: insertImageTool,
  decomposeImage: decomposeImageTool,
  vectorizeImage: vectorizeImageTool,
  // drawElement: drawElementTool,
};
export type ChatTools = InferUITools<typeof tools>;

type CustomUIMessage = UIMessage<
  never,
  {
    url: { url: string; title: string; content: string };
    mask: string;
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
      if (part.type === 'data-mask') {
        return {
          type: 'file',
          mediaType: 'image/png',
          data: part.data,
          filename: 'mask',
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
        'The tool output component will automatically display the generated images, so there is no need to mention them in your text response.' +
        'When an image is generated, decomposed, or vectorized, you can insert it into the canvas by using the insertImage tool.',
      stopWhen: stepCountIs(5),
      tools,
      onAbort: async ({ steps }) => {
        // 当流被中止时（例如用户断开连接或点击停止按钮），执行清理操作
        if (chatId) {
          try {
            console.log(`Stream aborted for chat ${chatId} after ${steps.length} steps`);
            
            // 如果用户消息已保存但流被中止，可以选择：
            // 1. 保留用户消息（用户已经发送了，可能想重新发送）
            // 2. 删除用户消息（因为对话未完成）
            // 这里我们选择保留用户消息，因为用户可能想重新发送或继续对话
            
            // 如果需要删除未完成的用户消息，可以取消下面的注释：
            // if (userMessageSeq !== null) {
            //   const userMessage = await getMessageByChatIdAndSeq(chatId, userMessageSeq, user.id);
            //   if (userMessage && userMessage.role === 'user') {
            //     await deleteMessage(userMessage.id, user.id);
            //     console.log(`Deleted incomplete user message with seq ${userMessageSeq}`);
            //   }
            // }
            
            // 如果有部分完成的步骤，可以在这里处理
            // 例如：保存部分完成的助手消息、清理临时数据等
            if (steps.length > 0) {
              console.log(`Stream had ${steps.length} completed steps before abort`);
            }
          } catch (error) {
            console.error('Error handling stream abort:', error);
          }
        }
      },
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
      // 即使工具报错，也应该保存助手消息和工具调用状态（包括错误状态）
      if (chatId) {
        try {          
          // 优先使用 event.responseMessage，因为它包含最完整的响应信息
          // 如果 responseMessage 不存在，则从 event.messages 中获取最后一条助手消息
          let assistantMessage = event.responseMessage;
          
          if (!assistantMessage || assistantMessage.role !== 'assistant') {
            const allAssistantMessages = (event.messages || []).filter(
              (msg) => msg.role === 'assistant'
            );
            
            if (allAssistantMessages.length > 0) {
              assistantMessage = allAssistantMessages[allAssistantMessages.length - 1];
            }
          }

          if (assistantMessage && assistantMessage.role === 'assistant') {
            // 如果 userMessageSeq 为 null，说明用户消息保存失败，需要重新获取下一个 seq
            let assistantSeq: number;
            if (userMessageSeq !== null) {
              assistantSeq = userMessageSeq + 1;
            } else {
              // 用户消息保存失败，重新获取下一个 seq
              // 这可能会跳过用户消息的 seq，但至少能保存助手消息
              assistantSeq = await getNextSeq(chatId, user.id);
              if (assistantSeq === 0) {
                return;
              }
            }
            
            // 检查是否已经存在相同 seq 的 assistant message（regenerate 情况）
            // 如果存在，先删除旧的 message（关联的 tool calls 会通过外键 CASCADE 自动删除）
            const existingMessage = await getMessageByChatIdAndSeq(chatId, assistantSeq, user.id);
            if (existingMessage && existingMessage.role === 'assistant') {
              await deleteMessage(existingMessage.id, user.id);
            }
            
            const dbMessage = convertUIMessageToDBMessage(
              assistantMessage,
              chatId,
              assistantSeq
            );
            
            const savedMessage = await createMessage(dbMessage, user.id);

            // 保存 tool calls 到数据库（包括错误状态）
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

                const savedTools = await createTools(dbTools, user.id);
                
                if (savedTools.length !== dbTools.length) {
                  console.error('Saved tools count does not match expected count');
                }
              }
            }
          }
        } catch (error) {
          console.error('Error saving assistant message:', error);
        }
      }
    },
  });
}