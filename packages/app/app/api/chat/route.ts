import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createMessage, getNextSeq } from '@/lib/db/messages';
import { convertUIMessageToDBMessage } from '@/lib/db/utils';

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
            'You are a helpful assistant that can answer questions and help with tasks',
    });

    // send sources and reasoning back to the client
    return result.toUIMessageStreamResponse({
        sendSources: true,
        sendReasoning: true,
        onFinish: async (event) => {
            // 流式响应完成后，保存助手回复到数据库
            if (chatId && userMessageSeq !== null) {
                try {
                    const assistantMessage = event.responseMessage;
                    if (assistantMessage && assistantMessage.role === 'assistant') {
                        const assistantSeq = userMessageSeq + 1;
                        const dbMessage = convertUIMessageToDBMessage(
                            assistantMessage,
                            chatId,
                            assistantSeq
                        );
                        await createMessage(dbMessage, user.id);
                    }
                } catch (error) {
                    console.error('Error saving assistant message:', error);
                }
            }
        },
    });
}