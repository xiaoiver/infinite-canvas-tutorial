import { createClient } from '@/lib/supabase/server';
import { createChat } from '@/lib/db/chats';
import { NextResponse } from 'next/server';

/**
 * POST /api/projects/[id]/chats
 * 为项目创建新聊天
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: projectId } = await params;
    const body = await request.json();
    const { title } = body;

    const chat = await createChat(
      {
        projectId,
        title: title || null,
      },
      user.id
    );

    if (!chat) {
      return NextResponse.json(
        { error: 'Failed to create chat or project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

