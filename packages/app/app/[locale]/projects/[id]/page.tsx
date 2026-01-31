import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProjectById } from '@/lib/db/projects';
import { ProjectDetailClient } from './project-detail-client';

type Project = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvasData: string | null;
  createdAt: string;
  updatedAt: string;
};

// 将数据库返回的 Project 类型转换为页面需要的类型
function convertProject(project: any): Project | null {
  if (!project) return null;
  
  return {
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
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  // 获取用户信息
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 如果未登录，重定向到首页
  if (!user) {
    redirect(`/${locale}`);
  }

  // 获取项目详情
  let project: Project | null = null;
  let error: string | null = null;

  try {
    const dbProject = await getProjectById(id, user.id);
    if (!dbProject) {
      error = 'Project not found';
    } else {
      project = convertProject(dbProject);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'An error occurred';
  }

  // 如果项目不存在，重定向到项目列表
  if (error && !project) {
    redirect(`/${locale}/projects`);
  }

  return <ProjectDetailClient initialProject={project} initialError={error} locale={locale} />;
}
