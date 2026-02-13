"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
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
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
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
import { ToolUIPart, DynamicToolUIPart, ChatOnToolCallCallback, lastAssistantMessageIsCompleteWithToolCalls, FileUIPart, DataUIPart, ImagePart, InferUITool, ToolCallPart } from "ai";
import { Copy, RefreshCcw, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useChat, UIMessage } from '@ai-sdk/react';
import { Loader } from "./ai-elements/loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { getChatErrorCode, type ChatErrorCode } from "@/lib/errors";
import { useParams } from "next/navigation";
import PromptInputAttachmentsDisplay from "./prompt-input-display";
import { useTranslations } from 'next-intl';
import { canvasApiAtom, selectedNodesAtom } from "@/atoms/canvas-selection";
import { sendMessageAtom } from "@/atoms/chat";
import { useAtomValue, useSetAtom } from "jotai";
import { MaskPart, ShapePart } from '@/lib/file';
import { wrapToolCall } from '@/tools/wrapper';
import { GenerateImageOutput, GenerateImageUITool } from '@/components/tools/generate-image-output';
import { insertImage } from '@/tools/insert-image-impl';
import { DecomposeImageOutput, DecomposeImageUITool } from "@/components/tools/decompose-image-output";
import { VectorizeImageOutput, VectorizeImageUITool } from "@/components/tools/vectorize-image-output";
import { toast } from "sonner";

const Chat = ({ 
  className, 
  initialMessages,
  chatId,
  onFinish,
  onToolCall,
}: { 
  className?: string;
  initialMessages?: UIMessage[];
  chatId?: string;
  onFinish?: (options: { message: UIMessage }) => void;
  onToolCall?: ChatOnToolCallCallback;
}) => {
  const [input, setInput] = useState('');
  const params = useParams();
  const locale = params?.locale as string || 'en';
  const t = useTranslations('auth');
  const tChats = useTranslations('chats');
  const canvasApi = useAtomValue(canvasApiAtom);
  const setSendMessage = useSetAtom(sendMessageAtom);

  const { messages, sendMessage, status, error, regenerate, addToolOutput } = useChat({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic || !canvasApi) {
        return;
      }

      // client-side tools @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#client-side-page
      // e.g. insert image into canvas
      if (toolCall.toolName === 'insertImage') {
        await wrapToolCall(async () => {
          const { nodeId, suffix } = await insertImage(canvasApi, toolCall.input as { image: string, width: number, height: number });

          if (suffix === 'svg') {
            toast.success(tChats('insertSVGImageSuccess'));
          } else {
            toast.success(tChats('insertImageSuccess'));
          }
          return {
            nodeId,
          };
        }, chatId, toolCall as ToolCallPart, addToolOutput);
      }
    },
    onFinish: async (options) => {
      if (onFinish) {
        onFinish(options);
      }
    },
  });

  // 将 sendMessage 设置到 atom 中，以便其他组件可以使用
  useEffect(() => {
    setSendMessage(() => sendMessage);
    return () => {
      setSendMessage(null);
    };
  }, [sendMessage, setSendMessage]);

  const errorCode = getChatErrorCode(error);

  const handleFileChanged = async (files: (FileUIPart | MaskPart | ShapePart | File)[]) => {
    if (canvasApi) {
      const center = canvasApi.viewport2Canvas({
        x: canvasApi.element.clientWidth / 2,
        y: canvasApi.element.clientHeight / 2,
      });

      // Insert image to canvas
      await Promise.all(files.map(async file => {
        await canvasApi.createImageFromFile(file as File, { position: center });
      }));
      canvasApi.record();
    }
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    
    try {
      sendMessage(
        { 
          text: message.text || 'Sent with attachments',
          files: message.files as unknown as FileList,
        },
        {
          body: {
            // model: model,
            // webSearch: webSearch,
            chatId,
          },
        },
      );
      setInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const getErrorTitle = (errorCode: ChatErrorCode | null) => {
    switch (errorCode) {
      case 'AUTHENTICATION_ERROR':
        return 'API Key 认证失败';
      case 'MODEL_NOT_FOUND':
        return '未找到模型';
      case 'UNAUTHORIZED':
        return '未授权';
      case 'INTERNAL_ERROR':
      default:
        return '发生错误';
    }
  };
  
  const getErrorAction = (errorCode: ChatErrorCode | null) => {
    switch (errorCode) {
      case 'AUTHENTICATION_ERROR':
      case 'MODEL_NOT_FOUND':
        return (
          <Link 
            href={`/${locale}/settings`}
            className="text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            {t('settings')}
          </Link>
        );
      case 'UNAUTHORIZED':
        return (
          <Link 
            href={`/${locale}/login`}
            className="text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            {t('login')}
          </Link>
        );
      default:
        return null;
    }
  };

  const renderErrorAlert = () => {
    if (!error) return null;
  
    return (
      <div className="mb-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{getErrorTitle(errorCode)}</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="mt-3">
              {getErrorAction(errorCode) || tChats('unknownError')}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  };
  
  return (
    <div className={cn("relative flex-1 min-h-0 p-4", className)}>
      <div className="flex flex-col h-full">
        <Conversation className="h-full flex-1 min-h-0">
          <ConversationContent>
            {messages.map((message) => {
              // 将 parts 分为文本部分和 tool 部分
              const textParts = message.parts.filter((part) => part.type === 'text' || part.type === 'reasoning');
              const toolParts = message.parts.filter((part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool');
              const sourceParts = message.parts.filter((part) => part.type === 'source-url');
              
              return (
                <div key={message.id}>
                  {message.role === 'assistant' && sourceParts.length > 0 && (
                    <Sources>
                      <SourcesTrigger count={sourceParts.length} />
                      {sourceParts.map((part, i) => (
                        <SourcesContent key={`${message.id}-source-${i}`}>
                          <Source
                            key={`${message.id}-source-${i}`}
                            href={part.url}
                            title={part.url}
                          />
                        </SourcesContent>
                      ))}
                    </Sources>
                  )}
                  {/* 先渲染 tool 部分 */}
                  {toolParts.map((part, i) => {
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
                            key={`${message.id}-tool-${i}`}
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
                          key={`${message.id}-tool-${i}`}
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
                      return (
                        <Tool
                          key={`${message.id}-tool-${i}`}
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
                            {staticTool.type === 'tool-generateImage' ? <GenerateImageOutput output={staticTool.output as GenerateImageUITool['output']} /> 
                            : staticTool.type === 'tool-decomposeImage' ? <DecomposeImageOutput output={staticTool.output as DecomposeImageUITool['output']} /> 
                            : staticTool.type === 'tool-vectorizeImage' ? <VectorizeImageOutput output={staticTool.output as VectorizeImageUITool['output']} /> : null}
                          </ToolContent>
                        </Tool>
                      );
                    }
                  })}
                  {/* 然后渲染文本部分 */}
                  {textParts.map((part, i) => {
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
                                size="icon-sm"
                              >
                                <RefreshCcw />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                                size="icon-sm"
                              >
                                <Copy />
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
                          isStreaming={status === 'streaming' && i === textParts.length - 1 && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                  })}
                </div>
              );
            })}
            {status === 'submitted' && <Loader />}
            {renderErrorAlert()}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <PromptInput 
          accept="image/*"
          maxFileSize={10 * 1024 * 1024} // 10MB
          maxFiles={10}
          onFileChanged={handleFileChanged}
          onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
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
                  <PromptInputActionAddAttachments label={tChats('uploadImages')} />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input && !status} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default Chat;

