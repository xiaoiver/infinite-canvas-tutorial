"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { ImageGallery } from "@/components/ai-elements/image-gallery";
import { cn } from "@/lib/utils";
import type { ToolUIPart, DynamicToolUIPart } from "ai";
import { Copy, GlobeIcon, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useChat, UIMessage } from '@ai-sdk/react';
import { Loader } from "./ai-elements/loader";

const models = [
  {
    name: 'GPT 4o',
    value: 'openai/gpt-4o',
  },
  {
    name: 'Deepseek R1',
    value: 'deepseek/deepseek-r1',
  },
];

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
};

const Chat = ({ 
  className, 
  initialMessages,
  chatId,
  onFinish,
  onData,
}: { 
  className?: string;
  initialMessages?: UIMessage[];
  chatId?: string;
  onFinish?: (options: { message: UIMessage }) => void;
  onData?: (options: { data: any }) => void;
}) => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const { messages, sendMessage, status, regenerate } = useChat({
    messages: initialMessages,
    onData: (data) => {
      if (onData) {
        onData(data);
      }
    },
    onFinish: async (message) => {
      if (onFinish) {
        onFinish(message);
      }
    },
  });
  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    sendMessage(
      { 
        text: message.text || 'Sent with attachments',
        files: message.files 
      },
      {
        body: {
          model: model,
          webSearch: webSearch,
          chatId: chatId, // 传递 chatId 到 API
        },
      },
    );
    setInput('');
  };
  return (
    <div className={cn("relative flex-1 min-h-0 p-4", className)}>
      <div className="flex flex-col h-full">
        <Conversation className="h-full flex-1 min-h-0">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'assistant' && message.parts.filter((part) => part.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter(
                          (part) => part.type === 'source-url',
                        ).length
                      }
                    />
                    {message.parts.filter((part) => part.type === 'source-url').map((part, i) => (
                      <SourcesContent key={`${message.id}-${i}`}>
                        <Source
                          key={`${message.id}-${i}`}
                          href={part.url}
                          title={part.url}
                        />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                          {message.role === 'assistant' && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => regenerate()}
                                label="Retry"
                                size="icon"
                              >
                                <RefreshCcw className="size-2" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                                size="icon"
                              >
                                <Copy className="size-1" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case 'reasoning':
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      // 处理 tool parts (tool-* 或 dynamic-tool)
                      if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                        const toolPart = part as ToolPart;
                        const isCompleted = toolPart.state === 'output-available';
                        const isError = toolPart.state === 'output-error';
                        const isDenied = toolPart.state === 'output-denied';
                        // 如果 tool 已完成、出错或被拒绝，默认展开
                        const defaultOpen = isCompleted || isError || isDenied;
                        
                        // 根据 tool 类型渲染不同的 ToolHeader
                        if (toolPart.type === 'dynamic-tool') {
                          const dynamicTool = toolPart as DynamicToolUIPart;
                          
                          // 检查是否是 generateImage tool
                          if (dynamicTool.toolName === 'generateImage') {
                            const images = (dynamicTool.output as { images: string[] })?.images || [];
                            return (
                              <Tool
                                key={`${message.id}-${i}`}
                                defaultOpen={defaultOpen}
                              >
                                <ToolHeader
                                  type="dynamic-tool"
                                  state={dynamicTool.state}
                                  toolName={dynamicTool.toolName}
                                  title={dynamicTool.title}
                                />
                                <ToolContent>
                                  {dynamicTool.input !== undefined && (
                                    <ToolInput input={dynamicTool.input} />
                                  )}
                                  <div className="p-4 flex gap-2">
                                    <ImageGallery
                                      images={images}
                                      alt={dynamicTool.title || 'Generated Image'}
                                    />
                                  </div>
                                </ToolContent>
                              </Tool>
                            );
                          }
                          
                          return (
                            <Tool
                              key={`${message.id}-${i}`}
                              defaultOpen={defaultOpen}
                            >
                              <ToolHeader
                                type="dynamic-tool"
                                state={dynamicTool.state}
                                toolName={dynamicTool.toolName}
                                title={dynamicTool.title}
                              />
                              <ToolContent>
                                {dynamicTool.input !== undefined && (
                                  <ToolInput input={dynamicTool.input} />
                                )}
                                <ToolOutput
                                  output={dynamicTool.output}
                                  errorText={dynamicTool.errorText}
                                />
                              </ToolContent>
                            </Tool>
                          );
                        } else {
                          // 静态 tool (tool-${NAME})
                          const staticTool = toolPart as ToolUIPart;

                          if (staticTool.type.startsWith('tool-generateImage')) {
                            const images = (staticTool.output as { images: string[] })?.images || [];
                            return (
                              <Tool
                                key={`${message.id}-${i}`}
                                defaultOpen={defaultOpen}
                              >
                                <ToolHeader
                                  type={staticTool.type}
                                  state={staticTool.state}
                                  title={staticTool.title}
                                />
                                <ToolContent>
                                  {staticTool.input !== undefined && (
                                    <ToolInput input={staticTool.input} />
                                  )}
                                  <div className="p-2 pt-0 flex flex-col gap-2">
                                    <ImageGallery
                                      images={images}
                                      alt={staticTool.title || 'Generated Image'}
                                    />
                                  </div>
                                </ToolContent>
                              </Tool>
                            );
                          }

                          return (
                            <Tool
                              key={`${message.id}-${i}`}
                              defaultOpen={defaultOpen}
                            >
                              <ToolHeader
                                type={staticTool.type}
                                state={staticTool.state}
                                title={staticTool.title}
                              />
                              <ToolContent>
                                {staticTool.input !== undefined && (
                                  <ToolInput input={staticTool.input} />
                                )}
                                <ToolOutput
                                  output={staticTool.output}
                                  errorText={staticTool.errorText}
                                />
                              </ToolContent>
                            </Tool>
                          );
                        }
                      }
                      return null;
                  }
                })}
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
          <PromptInputHeader>
            <PromptInputAttachmentsDisplay />
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                variant={webSearch ? 'default' : 'ghost'}
                onClick={() => setWebSearch(!webSearch)}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((model) => (
                    <PromptInputSelectItem key={model.value} value={model.value}>
                      {model.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input && !status} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default Chat;