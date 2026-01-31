'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Topbar } from '@/components/layout/topbar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Calendar, Trash2, Edit2, MoreHorizontal, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS, es } from 'date-fns/locale';

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvasData: string | null;
  createdAt: string;
  updatedAt: string;
};

interface ProjectsListClientProps {
  initialProjects: Project[];
  locale: string;
}

export function ProjectsListClient({
  initialProjects,
  locale,
}: ProjectsListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('projects');
  const commonT = useTranslations('common');
  
  // 获取 date-fns 的 locale
  const getDateLocale = () => {
    switch (locale) {
      case 'zh-Hans':
        return zhCN;
      case 'es-419':
        return es;
      default:
        return enUS;
    }
  };

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [updating, setUpdating] = useState(false);

  // 快速创建项目（Untitled）
  const handleQuickCreateProject = async () => {
    try {
      setCreating(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Untitled',
          description: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      // 跳转到详情页
      router.push(`/${locale}/projects/${newProject.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setCreating(false);
    }
  };

  // 创建新项目
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      setProjects([newProject, ...projects]);
      setNewProjectName('');
      setNewProjectDescription('');
      setCreateDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  // 打开编辑对话框
  const handleOpenEditDialog = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || '');
    setEditDialogOpen(true);
  };

  // 关闭编辑对话框
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingProject(null);
    setEditProjectName('');
    setEditProjectDescription('');
  };

  // 更新项目
  const handleUpdateProject = async () => {
    if (!editingProject || !editProjectName.trim()) {
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      const response = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editProjectName,
          description: editProjectDescription || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      const updatedProject = await response.json();
      setProjects(
        projects.map((p) => (p.id === updatedProject.id ? updatedProject : p))
      );
      handleCloseEditDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setUpdating(false);
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm(t('deleteConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-4 max-w-6xl">
          {/* 页面头部 */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">{t('title')}</h1>
              <p className="text-muted-foreground mt-2">{t('description')}</p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createProject')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('createProject')}</DialogTitle>
                  <DialogDescription>{t('createDescription')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t('projectName')}
                    </label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder={t('projectNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t('projectDescription')}
                    </label>
                    <Textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder={t('projectDescriptionPlaceholder')}
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    {commonT('cancel')}
                  </Button>
                  <Button onClick={handleCreateProject} disabled={creating || !newProjectName.trim()}>
                    {creating ? commonT('loading') : commonT('save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* 编辑项目对话框 */}
          <Dialog open={editDialogOpen} onOpenChange={handleCloseEditDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('editProject')}</DialogTitle>
                <DialogDescription>{t('editDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('projectName')}
                  </label>
                  <Input
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    placeholder={t('projectNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('projectDescription')}
                  </label>
                  <Textarea
                    value={editProjectDescription}
                    onChange={(e) => setEditProjectDescription(e.target.value)}
                    placeholder={t('projectDescriptionPlaceholder')}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleCloseEditDialog}
                  disabled={updating}
                >
                  {commonT('cancel')}
                </Button>
                <Button
                  onClick={handleUpdateProject}
                  disabled={updating || !editProjectName.trim()}
                >
                  {updating ? commonT('loading') : commonT('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {/* 项目列表 */}
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-lg mb-4">
                  {t('noProjects')}
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createFirstProject')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 快速创建卡片 */}
              <Card
                className="hover:shadow-lg transition-shadow relative cursor-pointer border-dashed border-2"
                onClick={handleQuickCreateProject}
              >
                <CardContent className="flex flex-col items-center justify-center py-12 min-h-[200px]">
                  {creating ? (
                    <>
                      <div className="h-12 w-12 border-4 border-muted-foreground border-t-foreground rounded-full animate-spin mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {commonT('loading')}
                      </p>
                    </>
                  ) : (
                    <>
                      <Plus className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t('createProject')}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="flex flex-col group hover:shadow-lg transition-shadow relative cursor-pointer"
                  onClick={() => {
                    router.push(`/${locale}/projects/${project.id}`);
                  }}
                >
                  {/* 右上角下拉菜单 */}
                  <div
                    className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditDialog(project);
                          }}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          {commonT('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {commonT('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-1 pr-8">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                  </CardContent>
                  <CardFooter>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>
                        {t('modified')} {formatDistanceToNow(new Date(project.updatedAt), {
                          addSuffix: true,
                          locale: getDateLocale(),
                        })}
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

