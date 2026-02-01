import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProjectById } from '@/lib/db/projects';
import { getProjectChats } from '@/lib/db/chats';
import { getChatMessages } from '@/lib/db/messages';
import { convertMessagesToUIMessages } from '@/lib/db/utils';
import { ProjectDetailClient } from './project-detail-client';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { UIMessage } from '@ai-sdk/react';

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

// 将数据库返回的 Chat 类型转换为页面需要的类型
function convertChat(chat: any): Chat | null {
  if (!chat) return null;
  
  return {
    id: chat.id,
    projectId: chat.projectId,
    title: chat.title,
    createdAt: chat.createdAt instanceof Date 
      ? chat.createdAt.toISOString() 
      : chat.createdAt,
    updatedAt: chat.updatedAt instanceof Date 
      ? chat.updatedAt.toISOString() 
      : chat.updatedAt,
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
  let chats: Chat[] = [];
  let initialMessages: UIMessage[] = [];

  try {
    const dbProject = await getProjectById(id, user.id);
    if (!dbProject) {
      error = 'Project not found';
    } else {
      project = convertProject(dbProject);
      
      // 获取项目的所有 chats
      const dbChats = await getProjectChats(id, user.id);
      chats = dbChats.map(convertChat).filter((chat): chat is Chat => chat !== null);
      
      // 如果有 chats，加载第一个 chat 的 messages
      if (chats.length > 0) {
        const firstChat = chats[0];
        const dbMessages = await getChatMessages(firstChat.id, user.id);
        initialMessages = await convertMessagesToUIMessages(dbMessages, user.id);
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'An error occurred';
  }

  // 如果项目不存在，重定向到项目列表
  if (error && !project) {
    redirect(`/${locale}/projects`);
  }

  return (
    <ProjectDetailClient 
      initialProject={project} 
      initialError={error} 
      initialChats={chats}
      initialMessages={initialMessages}
      locale={locale} 
    />
  );
}
