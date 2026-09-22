import { createClient } from '@/lib/supabase/server';
import { updateToolByCallId } from '@/lib/db/tools';
import { getLatestAssistantMessage } from '@/lib/db/messages';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/tools/update
 * 根据 toolCallId 更新工具状态（用于客户端工具执行后的状态同步）
 * 如果工具不存在，会尝试创建它（需要提供 chatId 和 toolName）
 */
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { toolCallId, state, output, errorText, chatId, toolName, input } = body;

    if (!toolCallId) {
      return NextResponse.json(
        { error: 'toolCallId is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (state !== undefined) {
      updateData.state = state;
    }
    if (output !== undefined) {
      updateData.output = output;
    }
    if (errorText !== undefined) {
      updateData.errorText = errorText;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field (state, output, errorText) must be provided' },
        { status: 400 }
      );
    }

    // 尝试更新工具
    let updatedTool = await updateToolByCallId(toolCallId, user.id, updateData);

    // 如果工具不存在，尝试创建它（需要 chatId 和 toolName）
    if (!updatedTool && chatId && toolName) {
      // 获取最新的助手消息作为 messageId
      const latestAssistantMessage = await getLatestAssistantMessage(chatId, user.id);
      
      if (latestAssistantMessage) {
        const toolType = `tool-${toolName}`;
        updatedTool = await updateToolByCallId(
          toolCallId,
          user.id,
          updateData,
          {
            messageId: latestAssistantMessage.id,
            toolName,
            toolType,
            input,
          }
        );
      }
    }

    if (!updatedTool) {
      return NextResponse.json(
        { error: 'Tool not found or unauthorized. If creating a new tool, chatId and toolName are required.' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedTool);
  } catch (error) {
    console.error('Error updating tool:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
