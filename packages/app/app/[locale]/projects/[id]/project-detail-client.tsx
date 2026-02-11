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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import type * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { ChevronDown, Edit2, Trash2, MessageSquare, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import Chat from '@/components/chat';
import Canvas from '@/components/canvas';
import { ExportFormat, readSystemClipboard, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { UIMessage } from '@ai-sdk/react';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/ai-elements/loader';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { canvasApiAtom, selectedNodesAtom } from '@/atoms/canvas-selection';
import { chatIdAtom } from '@/atoms/chat';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { executeCopy, executePaste, executeCut } from '@infinite-canvas-tutorial/webcomponents/spectrum';
import { CheckboardStyle } from '@infinite-canvas-tutorial/ecs';

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
  const tChats = useTranslations('chats');
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
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteChatDialogOpen, setDeleteChatDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [addingChat, setAddingChat] = useState(false);
  const editingInputRef = useRef<HTMLInputElement>(null);
  const chatListScrollRef = useRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>>(null);
  const [canvasApi, setCanvasApi] = useAtom(canvasApiAtom);
  const [selectedNodes, setSelectedNodes] = useAtom(selectedNodesAtom);
  const setChatId = useSetAtom(chatIdAtom);
  const [isClipboardEmpty, setIsClipboardEmpty] = useState(true);

  const isSelectedEmpty = canvasApi?.getAppState().layersSelected.length === 0;

  // 将 selectedChatId 同步到 atom，以便其他组件可以使用
  useEffect(() => {
    setChatId(selectedChatId);
  }, [selectedChatId, setChatId]);

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

  // 当 chats 列表变化时，滚动到底部
  useEffect(() => {
    if (chatListScrollRef.current && chats.length > 0) {
      // 使用 requestAnimationFrame 和 setTimeout 确保 DOM 更新完成后再滚动
      requestAnimationFrame(() => {
        setTimeout(() => {
          // 查找 ScrollArea 的 viewport 元素
          const viewport = chatListScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }, 0);
      });
    }
  }, [chats.length]);

  useEffect(() => {
    return () => {
      setCanvasApi(null);
      setSelectedNodes([]);
    };
  }, []);

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
      toast.success(t('renameSuccess') || '项目重命名成功');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename project';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setRenaming(false);
    }
  };

  // 打开删除项目对话框
  const handleOpenDeleteProjectDialog = () => {
    setDeleteProjectDialogOpen(true);
  };

  // 删除项目
  const handleDeleteProject = async () => {
    if (!project) return;

    try {
      setDeletingProject(true);
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      toast.success(t('deleteSuccess') || '项目删除成功');
      // 删除成功后跳转到项目列表
      router.push(`/${locale}/projects`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      toast.error(errorMessage);
      setDeleteProjectDialogOpen(false);
    } finally {
      setDeletingProject(false);
    }
  };

  // 删除聊天记录
  const handleDeleteChat = async () => {
    if (!chatToDelete || !project) return;

    try {
      setDeletingChat(true);
      const response = await fetch(`/api/chats/${chatToDelete}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // 从列表中移除
        const newChats = chats.filter(c => c.id !== chatToDelete);
        setChats(newChats);
        // 如果删除的是当前选中的 chat，清除选中状态
        if (selectedChatId === chatToDelete) {
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
        toast.success(tChats('deleteSuccess') || '聊天记录删除成功');
        setDeleteChatDialogOpen(false);
        setChatToDelete(null);
      } else {
        throw new Error('Failed to delete chat');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete chat';
      console.error('Failed to delete chat:', err);
      toast.error(errorMessage);
    } finally {
      setDeletingChat(false);
    }
  };

  const handleUndo = () => {
    if (!canvasApi) return;
    canvasApi.undo();
  };

  const handleRedo = () => {
    if (!canvasApi) return;
    canvasApi.redo();
  };

  const handleCut = () => {
    if (!canvasApi) return;
    executeCut(canvasApi, canvasApi.getAppState());
  };

  const handleCopy = () => {
    if (!canvasApi) return;
    executeCopy(canvasApi, canvasApi.getAppState());
  };

  const handlePaste = () => {
    if (!canvasApi) return;
    executePaste(canvasApi, canvasApi.getAppState());
  };

  const handleExport = (format: ExportFormat) => {
    if (!canvasApi) return;
    const nodes = canvasApi
      .getAppState()
      .layersSelected.map((id) => canvasApi.getNodeById(id));
    canvasApi.export(format, true, nodes);
  };

  const handleEditOpenChange = () => {
    readSystemClipboard().then((clipboard) => {
      setIsClipboardEmpty(Object.keys(clipboard).length === 0);
    });
  };

  const handleToggleGridCheckboardStyle = () => {
    if (!canvasApi) return;
    canvasApi.setAppState({
      checkboardStyle: canvasApi.getAppState().checkboardStyle === CheckboardStyle.GRID ? CheckboardStyle.NONE : CheckboardStyle.GRID,
    });
  };

  const handleToggleSnapToPixelGridEnabled = () => {
    if (!canvasApi) return;
    canvasApi.setAppState({
      snapToPixelGridEnabled: !canvasApi.getAppState().snapToPixelGridEnabled,
    });
  };

  const handleToggleSnapToObjectsEnabled = () => {
    if (!canvasApi) return;
    canvasApi.setAppState({
      snapToObjectsEnabled: !canvasApi.getAppState().snapToObjectsEnabled,
    });
  };

  const handleAddChat = async (projectId: string) => {
    try {
      setAddingChat(true);
      const response = await fetch(`/api/projects/${projectId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: null }),
      });
      if (response.ok) {
        const newChat = await response.json();
        setChats([...chats, newChat]);
        setSelectedChatId(newChat.id);
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
    } finally {
      setAddingChat(false);
    }
  };

  const renderDropdownMenu = () => {
    return (<>
    <DropdownMenuSeparator />
      <DropdownMenuSub onOpenChange={handleEditOpenChange}>
        <DropdownMenuSubTrigger>
          {t('edit')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-40">
          <DropdownMenuItem className="flex items-center justify-between" disabled={canvasApi?.isUndoStackEmpty()} onClick={handleUndo}>
            {t('undo')}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>Z</Kbd>
            </KbdGroup>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center justify-between" disabled={canvasApi?.isRedoStackEmpty()} onClick={handleRedo}>
            {t('redo')}
            <KbdGroup>
              <Kbd>⇧</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>Z</Kbd>
            </KbdGroup>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex items-center justify-between" disabled={isSelectedEmpty} onClick={handleCut}>
            {t('cut')}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>X</Kbd>
            </KbdGroup>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center justify-between" disabled={isSelectedEmpty} onClick={handleCopy}>
            {t('copy')}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center justify-between" disabled={isClipboardEmpty} onClick={handlePaste}>
            {t('paste')}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>V</Kbd>
            </KbdGroup>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {t('preferences')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => handleToggleGridCheckboardStyle()}>
            <Check
              className={`mr-2 h-4 w-4 ${
                canvasApi?.getAppState().checkboardStyle === CheckboardStyle.GRID ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {t('grid')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleToggleSnapToPixelGridEnabled()}>
            <Check
              className={`mr-2 h-4 w-4 ${
                canvasApi?.getAppState().snapToPixelGridEnabled ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {t('snapToPixelGrid')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleToggleSnapToObjectsEnabled()}>
            <Check
              className={`mr-2 h-4 w-4 ${
                canvasApi?.getAppState().snapToObjectsEnabled ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {t('snapToObjects')}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {t('exportAs')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => handleExport(ExportFormat.SVG)}>
            {t('exportAsSVG')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport(ExportFormat.PNG)}>
            {t('exportAsPNG')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport(ExportFormat.JPEG)}>
            {t('exportAsJPEG')}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>);
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
            {t('rename')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleOpenDeleteProjectDialog}
            className="text-destructive focus:text-destructive"
          >
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
      <Topbar 
        leftMenuContent={renderDropdownMenu()}
        centerContent={renderProjectNameMenu()} />
      <div className="flex-1 flex min-h-0">
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {project && (
          <PromptInputProvider>
          <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={800}>
            <Canvas id={project.id} initialData={project.canvasData || undefined} />
          </ResizablePanel>
          <ResizableHandle
            className="translate-x-px border-none [&>div]:shrink-0"
            withHandle
          />
          <ResizablePanel defaultSize={400} className="h-full flex flex-col">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={100} className="flex flex-col">
            {/* Chat 列表侧边栏 */}
              <div className="flex items-center justify-between p-2 py-1 border-b">
                <h3 className="text-sm font-semibold">{tChats('title')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleAddChat(project?.id || '')}
                  disabled={addingChat}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0 p-2" ref={chatListScrollRef}>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatToDelete(chat.id);
                              setDeleteChatDialogOpen(true);
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
            </ResizablePanel>
          <ResizableHandle
            className="translate-y-py border-none [&>div]:shrink-0"
            withHandle
          />
          <ResizablePanel defaultSize={600} className="h-full flex flex-col">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader />
              </div>
            ) : selectedChatId ? (
              <Chat 
                initialMessages={messages} 
                chatId={selectedChatId!}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">{tChats('noChatSelected')}</p>
              </div>
            )}
            </ResizablePanel>
          </ResizablePanelGroup>
          </ResizablePanel>
          </ResizablePanelGroup>
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

      {/* 删除项目对话框 */}
      <Dialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteProject')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteProjectDialogOpen(false)}
              disabled={deletingProject}
            >
              {commonT('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? commonT('loading') : commonT('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除聊天记录对话框 */}
      <Dialog open={deleteChatDialogOpen} onOpenChange={setDeleteChatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tChats('deleteChat') }</DialogTitle>
            <DialogDescription>
              {tChats('deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteChatDialogOpen(false);
                setChatToDelete(null);
              }}
              disabled={deletingChat}
            >
              {commonT('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChat}
              disabled={deletingChat}
            >
              {deletingChat ? commonT('loading') : commonT('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

