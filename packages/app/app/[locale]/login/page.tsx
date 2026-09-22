import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/topbar';
import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage({
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
    <div className="flex flex-col h-screen">
      <Topbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

