import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProjects } from '@/lib/db/projects';
import { ProjectsListClient } from './projects-list-client';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvasData: SerializedNode[] | null;
  createdAt: string;
  updatedAt: string;
  chatCount: number;
};

// 将数据库返回的 Project 类型转换为页面需要的类型
function convertProjects(dbProjects: any[]): Project[] {
  return dbProjects.map((project) => ({
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    canvasData: project.canvasData || null,
    createdAt: project.createdAt instanceof Date 
      ? project.createdAt.toISOString() 
      : project.createdAt,
    updatedAt: project.updatedAt instanceof Date 
      ? project.updatedAt.toISOString() 
      : project.updatedAt,
    chatCount: Number(project.chatCount) || 0,
  }));
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 获取用户信息
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 如果未登录，重定向到首页
  if (!user) {
    redirect(`/${locale}`);
  }

  // 获取项目列表
  let projects: Project[] = [];
  try {
    const dbProjects = await getUserProjects(user.id);
    projects = convertProjects(dbProjects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    // 即使出错也继续渲染，让客户端处理错误
  }

  return <ProjectsListClient initialProjects={projects} locale={locale} />;
}
