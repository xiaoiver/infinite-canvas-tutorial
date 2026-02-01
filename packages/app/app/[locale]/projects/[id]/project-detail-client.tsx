'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Topbar } from '@/components/layout/topbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Edit2, Trash2, MessageSquare, Plus } from 'lucide-react';
import Chat from '@/components/chat';
import Canvas, { CanvasAPI } from '@/components/canvas';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { UIMessage } from '@ai-sdk/react';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/ai-elements/loader';
import { ToolUIPart } from 'ai';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvasData: SerializedNode[] | null;
  createdAt: string;
  updatedAt: string;
};

type Chat = {
  id: string;
  projectId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

interface ProjectDetailClientProps {
  initialProject: Project | null;
  initialError: string | null;
  initialChats: Chat[];
  initialMessages: UIMessage[];
  initialSelectedChatId: string | null;
  locale: string;
}

export function ProjectDetailClient({
  initialProject,
  initialError,
  initialChats,
  initialMessages,
  initialSelectedChatId,
  locale,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('projects');
  const commonT = useTranslations('common');

  const [project, setProject] = useState<Project | null>(initialProject);
  const [error, setError] = useState<string | null>(initialError);
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialSelectedChatId
  );
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<CanvasAPI>(null);

  // 当 URL 中的 chatId 变化时，同步到 selectedChatId（用于浏览器前进/后退或直接输入 URL）
  useEffect(() => {
    const urlChatId = searchParams.get('chatId');
    // 只有当 URL 中的 chatId 存在、有效、且与当前选中的不同时才更新
    if (urlChatId && chats.some(chat => chat.id === urlChatId) && urlChatId !== selectedChatId) {
      setSelectedChatId(urlChatId);
    }
  }, [searchParams, chats]); // 不依赖 selectedChatId，避免循环

  // 当 selectedChatId 变化时，同步到 URL 并加载消息
  useEffect(() => {
    if (!selectedChatId || !project) return;

    const urlChatId = searchParams.get('chatId');
    
    // 如果 URL 与 selectedChatId 不一致，更新 URL
    if (urlChatId !== selectedChatId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('chatId', selectedChatId);
      const newUrl = `/${locale}/projects/${project.id}?${params.toString()}`;
      router.replace(newUrl, { scroll: false });
      // URL 更新后，searchParams 会变化，但不会触发第一个 useEffect（因为条件不满足）
      // 所以我们需要在这里也加载消息
    }

    // 加载对应的 messages
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chats/${selectedChatId}/messages`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChatId, project?.id, locale, router]); // 不依赖 searchParams，避免循环

  // 打开重命名对话框
  const handleOpenRenameDialog = () => {
    if (project) {
      setRenameProjectName(project.name);
      setRenameDialogOpen(true);
    }
  };

  // 重命名项目
  const handleRenameProject = async () => {
    if (!project || !renameProjectName.trim()) {
      return;
    }

    try {
      setRenaming(true);
      setError(null);
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: renameProjectName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename project');
      }

      const updatedProject = await response.json();
      setProject(updatedProject);
      setRenameDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project');
    } finally {
      setRenaming(false);
    }
  };

  // 删除项目
  const handleDeleteProject = async () => {
    if (!project) return;

    if (!confirm(t('deleteConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // 删除成功后跳转到项目列表
      router.push(`/${locale}/projects`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  // 渲染项目名称下拉菜单
  const renderProjectNameMenu = () => {
    if (!project) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto py-1 px-2 font-semibold text-base">
            <span className="max-w-[200px] truncate">{project.name}</span>
            <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={handleOpenRenameDialog}>
            <Edit2 className="mr-2 h-4 w-4" />
            {t('rename')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDeleteProject}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {commonT('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (error && !project) {
    return (
      <div className="flex flex-col h-screen">
        <Topbar />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <p className="text-lg text-destructive mb-4">{error}</p>
            <button
              onClick={() => {
                router.push(`/${locale}/projects`);
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              返回项目列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar centerContent={renderProjectNameMenu()} />
      <div className="flex-1 flex min-h-0">
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {project && (
          <PromptInputProvider>
<ResizablePanelGroup direction="horizontal" id={`project-detail-${project.id}`}>
          <ResizablePanel minSize={400}>
          {/* <div className="flex-1 h-full"> */}
            <Canvas ref={canvasRef} id={project.id} initialData={project.canvasData || undefined} />
            {/* </div> */}
          </ResizablePanel>
          <ResizableHandle
            className="translate-x-px border-none [&>div]:shrink-0"
            withHandle
          />
          <ResizablePanel minSize={400}>
            {/* Chat 列表侧边栏 */}
            <div className="border-b p-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Chats</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={async () => {
                    // 创建新 chat
                    try {
                      const response = await fetch(`/api/projects/${project.id}/chats`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: null }),
                      });
                      if (response.ok) {
                        const newChat = await response.json();
                        setChats([...chats, newChat]);
                        // setSelectedChatId 会触发 useEffect，自动更新 URL
                        setSelectedChatId(newChat.id);
                      }
                    } catch (err) {
                      console.error('Failed to create chat:', err);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[68px]">
                <div className="space-y-1">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={cn(
                        "group flex items-center gap-1 rounded text-sm hover:bg-accent transition-colors",
                        selectedChatId === chat.id && "bg-accent"
                      )}
                    >
                      {editingChatId === chat.id ? (
                        <Input
                          ref={editingInputRef}
                          value={editingChatTitle}
                          onChange={(e) => setEditingChatTitle(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              try {
                                const response = await fetch(`/api/chats/${chat.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ title: editingChatTitle.trim() || null }),
                                });
                                if (response.ok) {
                                  const updatedChat = await response.json();
                                  setChats(chats.map(c => c.id === chat.id ? updatedChat : c));
                                  setEditingChatId(null);
                                  setEditingChatTitle('');
                                } else {
                                  console.error('Failed to rename chat');
                                }
                              } catch (err) {
                                console.error('Failed to rename chat:', err);
                              }
                            } else if (e.key === 'Escape') {
                              setEditingChatId(null);
                              setEditingChatTitle('');
                            }
                          }}
                          onBlur={async () => {
                            try {
                              const response = await fetch(`/api/chats/${chat.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ title: editingChatTitle.trim() || null }),
                              });
                              if (response.ok) {
                                const updatedChat = await response.json();
                                setChats(chats.map(c => c.id === chat.id ? updatedChat : c));
                              }
                            } catch (err) {
                              console.error('Failed to rename chat:', err);
                            }
                            setEditingChatId(null);
                            setEditingChatTitle('');
                          }}
                          className="flex-1 h-6 text-sm px-2 my-1 border-none mx-1 rounded-xs"
                          autoFocus
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              // setSelectedChatId 会触发 useEffect，自动更新 URL
                              setSelectedChatId(chat.id);
                            }}
                            className="flex-1 text-left px-2 py-1.5 flex items-center gap-2"
                          >
                            <MessageSquare className="h-4 w-4 opacity-50" />
                            <span className="truncate">
                              {chat.title || 'Untitled Chat'}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChatId(chat.id);
                              setEditingChatTitle(chat.title || '');
                              // 使用 setTimeout 确保 DOM 更新后再聚焦
                              setTimeout(() => {
                                editingInputRef.current?.focus();
                                editingInputRef.current?.select();
                              }, 0);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('确定要删除这个聊天记录吗？')) {
                                return;
                              }
                              try {
                                const response = await fetch(`/api/chats/${chat.id}`, {
                                  method: 'DELETE',
                                });
                                if (response.ok) {
                                  // 从列表中移除
                                  const newChats = chats.filter(c => c.id !== chat.id);
                                  setChats(newChats);
                                  // 如果删除的是当前选中的 chat，清除选中状态
                                  if (selectedChatId === chat.id) {
                                    if (newChats.length > 0) {
                                      // 如果有其他 chat，选中第一个
                                      setSelectedChatId(newChats[0].id);
                                    } else {
                                      // 如果没有其他 chat，清除选中状态并更新 URL
                                      setSelectedChatId(null);
                                      const params = new URLSearchParams(searchParams.toString());
                                      params.delete('chatId');
                                      const newUrl = `/${locale}/projects/${project.id}?${params.toString()}`;
                                      router.replace(newUrl, { scroll: false });
                                    }
                                  }
                                } else {
                                  console.error('Failed to delete chat');
                                }
                              } catch (err) {
                                console.error('Failed to delete chat:', err);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader />
              </div>
            ) : selectedChatId ? (
              <Chat 
                initialMessages={messages} 
                chatId={selectedChatId!}
                onFinish={async ({ message }) => {
                  const generateImagePart = message.parts.find((part) => part.type === 'tool-generateImage') as ToolUIPart;
                  if (generateImagePart) {
                    const images = (generateImagePart.output as { images: string[] })?.images || [];
                    // Insert into canvas
                    if (images.length > 0 && canvasRef.current) {
                      await canvasRef.current.insertImages(images);
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No chat selected</p>
              </div>
            )}
        </ResizablePanel>
        </ResizablePanelGroup>

          {/* <div className="flex-1 h-full">
            <Canvas ref={canvasRef} id={project.id} initialData={project.canvasData || undefined} />
          </div>
          <div className="w-[400px] h-full flex flex-col border-l">
            
          </div> */}
          </PromptInputProvider>
        )}
      </div>

      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rename')}</DialogTitle>
            <DialogDescription>{t('renameDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('projectName')}
              </label>
              <Input
                value={renameProjectName}
                onChange={(e) => setRenameProjectName(e.target.value)}
                placeholder={t('projectNamePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameProjectName.trim()) {
                    handleRenameProject();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={renaming}
            >
              {commonT('cancel')}
            </Button>
            <Button
              onClick={handleRenameProject}
              disabled={renaming || !renameProjectName.trim()}
            >
              {renaming ? commonT('loading') : commonT('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

