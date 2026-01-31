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
} from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
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
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import { CheckIcon, GlobeIcon, MicIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface MessageType {
  key: string;
  from: "user" | "assistant";
  sources?: { href: string; title: string }[];
  versions: {
    id: string;
    content: string;
  }[];
  reasoning?: {
    content: string;
    duration: number;
  };
  tools?: {
    name: string;
    description: string;
    status: ToolUIPart["state"];
    parameters: Record<string, unknown>;
    result: string | undefined;
    error: string | undefined;
  }[];
}


const models = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude 4 Opus",
    chef: "Anthropic",
    chefSlug: "anthropic",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    chef: "Anthropic",
    chefSlug: "anthropic",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    chef: "Google",
    chefSlug: "google",
    providers: ["google"],
  },
];

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
  "Best practices for React development",
  "Tell me about TypeScript benefits",
  "How to optimize database queries?",
  "What is the difference between SQL and NoSQL?",
  "Explain cloud computing basics",
];

const mockResponses = [
  "That's a great question! Let me help you understand this concept better. The key thing to remember is that proper implementation requires careful consideration of the underlying principles and best practices in the field.",
  "I'd be happy to explain this topic in detail. From my understanding, there are several important factors to consider when approaching this problem. Let me break it down step by step for you.",
  "This is an interesting topic that comes up frequently. The solution typically involves understanding the core concepts and applying them in the right context. Here's what I recommend...",
  "Great choice of topic! This is something that many developers encounter. The approach I'd suggest is to start with the fundamentals and then build up to more complex scenarios.",
  "That's definitely worth exploring. From what I can see, the best way to handle this is to consider both the theoretical aspects and practical implementation details.",
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

const Chat = ({ className, initialMessages }: { className?: string, initialMessages?: MessageType[] }) => {
  const [model, setModel] = useState<string>(models[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [text, setText] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [useMicrophone, setUseMicrophone] = useState<boolean>(false);
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<MessageType[]>(initialMessages || []);
  const [_streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );

  const selectedModelData = models.find((m) => m.id === model);

  const streamResponse = useCallback(
    async (messageId: string, content: string) => {
      setStatus("streaming");
      setStreamingMessageId(messageId);

      const words = content.split(" ");
      let currentContent = "";

      for (let i = 0; i < words.length; i++) {
        currentContent += (i > 0 ? " " : "") + words[i];

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.versions.some((v) => v.id === messageId)) {
              return {
                ...msg,
                versions: msg.versions.map((v) =>
                  v.id === messageId ? { ...v, content: currentContent } : v
                ),
              };
            }
            return msg;
          })
        );

        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100 + 50)
        );
      }

      setStatus("ready");
      setStreamingMessageId(null);
    },
    []
  );

  const addUserMessage = useCallback(
    (content: string) => {
      const userMessage: MessageType = {
        key: `user-${Date.now()}`,
        from: "user",
        versions: [
          {
            id: `user-${Date.now()}`,
            content,
          },
        ],
      };

      setMessages((prev) => [...prev, userMessage]);

      setTimeout(() => {
        const assistantMessageId = `assistant-${Date.now()}`;
        const randomResponse =
          mockResponses[Math.floor(Math.random() * mockResponses.length)];

        const assistantMessage: MessageType = {
          key: `assistant-${Date.now()}`,
          from: "assistant",
          versions: [
            {
              id: assistantMessageId,
              content: "",
            },
          ],
        };

        setMessages((prev) => [...prev, assistantMessage]);
        streamResponse(assistantMessageId, randomResponse);
      }, 500);
    },
    [streamResponse]
  );

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    setStatus("submitted");

    if (message.files?.length) {
      toast.success("Files attached", {
        description: `${message.files.length} file(s) attached to message`,
      });
    }

    addUserMessage(message.text || "Sent with attachments");
    setText("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setStatus("submitted");
    addUserMessage(suggestion);
  };

  return (
    <div className={cn("relative flex size-full flex-col divide-y overflow-hidden", className)}>
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.map(({ versions, ...message }) => (
            <MessageBranch defaultBranch={0} key={message.key}>
              <MessageBranchContent>
                {versions.map((version) => (
                  <Message
                    from={message.from}
                    key={`${message.key}-${version.id}`}
                  >
                    <div>
                      {message.sources?.length && (
                        <Sources>
                          <SourcesTrigger count={message.sources.length} />
                          <SourcesContent>
                            {message.sources.map((source) => (
                              <Source
                                href={source.href}
                                key={source.href}
                                title={source.title}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                      {message.reasoning && (
                        <Reasoning duration={message.reasoning.duration}>
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {message.reasoning.content}
                          </ReasoningContent>
                        </Reasoning>
                      )}
                      <MessageContent>
                        <MessageResponse>{version.content}</MessageResponse>
                      </MessageContent>
                    </div>
                  </Message>
                ))}
              </MessageBranchContent>
              {versions.length > 1 && (
                <MessageBranchSelector from={message.from}>
                  <MessageBranchPrevious />
                  <MessageBranchPage />
                  <MessageBranchNext />
                </MessageBranchSelector>
              )}
            </MessageBranch>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="grid shrink-0 gap-4 pt-4">
        <Suggestions className="px-4">
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
        <div className="w-full px-4 pb-4">
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputHeader>
              <PromptInputAttachmentsDisplay />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                onChange={(event) => setText(event.target.value)}
                value={text}
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
                  onClick={() => setUseMicrophone(!useMicrophone)}
                  variant={useMicrophone ? "default" : "ghost"}
                >
                  <MicIcon size={16} />
                  <span className="sr-only">Microphone</span>
                </PromptInputButton>
                <PromptInputButton
                  onClick={() => setUseWebSearch(!useWebSearch)}
                  variant={useWebSearch ? "default" : "ghost"}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <ModelSelector
                  onOpenChange={setModelSelectorOpen}
                  open={modelSelectorOpen}
                >
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton>
                      {selectedModelData?.chefSlug && (
                        <ModelSelectorLogo
                          provider={selectedModelData.chefSlug}
                        />
                      )}
                      {selectedModelData?.name && (
                        <ModelSelectorName>
                          {selectedModelData.name}
                        </ModelSelectorName>
                      )}
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {["OpenAI", "Anthropic", "Google"].map((chef) => (
                        <ModelSelectorGroup heading={chef} key={chef}>
                          {models
                            .filter((m) => m.chef === chef)
                            .map((m) => (
                              <ModelSelectorItem
                                key={m.id}
                                onSelect={() => {
                                  setModel(m.id);
                                  setModelSelectorOpen(false);
                                }}
                                value={m.id}
                              >
                                <ModelSelectorLogo provider={m.chefSlug} />
                                <ModelSelectorName>{m.name}</ModelSelectorName>
                                <ModelSelectorLogoGroup>
                                  {m.providers.map((provider) => (
                                    <ModelSelectorLogo
                                      key={provider}
                                      provider={provider}
                                    />
                                  ))}
                                </ModelSelectorLogoGroup>
                                {model === m.id ? (
                                  <CheckIcon className="ml-auto size-4" />
                                ) : (
                                  <div className="ml-auto size-4" />
                                )}
                              </ModelSelectorItem>
                            ))}
                        </ModelSelectorGroup>
                      ))}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!(text.trim() || status) || status === "streaming"}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default Chat;