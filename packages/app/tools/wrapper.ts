import { UseChatHelpers, UIMessage } from "@ai-sdk/react";
import { ToolCallPart } from "ai";

export const wrapToolCall = async (callback: () => Promise<any>, chatId: string | undefined, toolCall: ToolCallPart, addToolOutput: UseChatHelpers<UIMessage>['addToolOutput']) => {
  try {
    const output = await callback();
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output,
      state: 'output-available',
    });
    
    // 立即同步工具状态到服务器
    if (chatId) {
      fetch('/api/tools/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolCallId: toolCall.toolCallId,
          state: 'output-available',
          output,
          chatId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        }),
      }).catch((error) => {
        console.error(`Error updating tool ${toolCall.toolCallId}:`, error);
      });
    }
  } catch (error) {
    const errorText = error instanceof Error ? error.message : `Failed to execute tool ${toolCall.toolName}`;
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText,
      state: 'output-error',
    });
    
    // 立即同步工具错误状态到服务器
    if (chatId) {
      fetch('/api/tools/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText,
          chatId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        }),
      }).catch((error) => {
        console.error(`Error updating tool ${toolCall.toolCallId}:`, error);
      });
    }
  }
}