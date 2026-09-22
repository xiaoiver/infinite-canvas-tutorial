import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { Topbar } from '@/components/layout/topbar';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HomeClient from './home-client';

export default async function Home({
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

  // 如果已登录，重定向到 projects 列表页
  if (user) {
    redirect(`/${locale}/projects`);
  }

  return (
    <PromptInputProvider>
      <div className="flex flex-col h-screen">
        <Topbar />
        <HomeClient />
      </div>
    </PromptInputProvider>
  );
}


