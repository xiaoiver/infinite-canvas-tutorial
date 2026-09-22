import { createClient } from '@/lib/supabase/server';
import { deleteChat, updateChat } from '@/lib/db/chats';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/chats/[chatId]
 * 更新指定的聊天记录（如标题）
 */
export async function PATCH(
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
        const body = await request.json();
        const { title } = body;

        const updatedChat = await updateChat(
            chatId,
            user.id,
            { title: title !== undefined ? (title || null) : undefined }
        );

        if (!updatedChat) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(updatedChat);
    } catch (error) {
        console.error('Error updating chat:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/chats/[chatId]
 * 删除指定的聊天记录（会自动删除关联的 messages 和 tools）
 */
export async function DELETE(
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
        const success = await deleteChat(chatId, user.id);

        if (!success) {
            return NextResponse.json(
                { error: 'Chat not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

