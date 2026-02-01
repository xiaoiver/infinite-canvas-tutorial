import { createClient } from '@/lib/supabase/server';
import { getChatMessages } from '@/lib/db/messages';
import { convertMessagesToUIMessages } from '@/lib/db/utils';
import { NextResponse } from 'next/server';

/**
 * GET /api/chats/[chatId]/messages
 * 获取指定聊天的所有消息（包括 tool calls）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;
    const dbMessages = await getChatMessages(chatId, user.id);
    const uiMessages = await convertMessagesToUIMessages(dbMessages, user.id);

    return NextResponse.json(uiMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

