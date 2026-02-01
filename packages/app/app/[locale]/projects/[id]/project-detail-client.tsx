'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import Canvas from '@/components/canvas';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { UIMessage } from '@ai-sdk/react';
import { cn } from '@/lib/utils';

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
  locale: string;
}

export function ProjectDetailClient({
  initialProject,
  initialError,
  initialChats,
  initialMessages,
  locale,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const t = useTranslations('projects');
  const commonT = useTranslations('common');

  const [project, setProject] = useState<Project | null>(initialProject);
  const [error, setError] = useState<string | null>(initialError);
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialChats.length > 0 ? initialChats[0].id : null
  );
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // 当选择不同的 chat 时，加载对应的 messages
  useEffect(() => {
    if (!selectedChatId || !project) return;

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
  }, [selectedChatId, project?.id]);

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
          <div className="flex-1 h-full">
            <Canvas id={project.id} initialData={project.canvasData || undefined} />
          </div>
          <div className="w-[400px] h-full flex flex-col border-l">
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
              <ScrollArea className="h-[120px]">
                <div className="space-y-1">
                  {chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChatId(chat.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors",
                        selectedChatId === chat.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 opacity-50" />
                        <span className="truncate">
                          {chat.title || 'Untitled Chat'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {/* Chat 组件 */}
            <div className="flex-1 min-h-0">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Loading messages...</p>
                </div>
              ) : selectedChatId ? (
                <Chat 
                  initialMessages={messages} 
                  chatId={selectedChatId}
                  onMessagesChange={async () => {
                    // 当消息更新时，重新加载 messages
                    if (selectedChatId) {
                      try {
                        const response = await fetch(`/api/chats/${selectedChatId}/messages`);
                        if (response.ok) {
                          const data = await response.json();
                          setMessages(data);
                        }
                      } catch (err) {
                        console.error('Failed to reload messages:', err);
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">No chat selected</p>
                </div>
              )}
            </div>
          </div>
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

