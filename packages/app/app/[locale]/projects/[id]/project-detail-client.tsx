'use client';

import { useState } from 'react';
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
import { ChevronDown, Edit2, Trash2 } from 'lucide-react';
import Chat from '@/components/chat';
import Canvas from '@/components/canvas';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvasData: string | null;
  createdAt: string;
  updatedAt: string;
};

interface ProjectDetailClientProps {
  initialProject: Project | null;
  initialError: string | null;
  locale: string;
}

export function ProjectDetailClient({
  initialProject,
  initialError,
  locale,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const t = useTranslations('projects');
  const commonT = useTranslations('common');

  const [project, setProject] = useState<Project | null>(initialProject);
  const [error, setError] = useState<string | null>(initialError);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [renaming, setRenaming] = useState(false);

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
            <Canvas id={project.id} initialData={project.canvasData ? JSON.parse(project.canvasData) as SerializedNode[] : undefined} />
          </div>
          <div className="w-[400px] h-full">
            <Chat />
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

