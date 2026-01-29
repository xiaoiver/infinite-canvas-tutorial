'use client';

import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import Chat from '@/components/chat';
import { LoginForm } from '@/components/auth/login-form';
import { UserMenu } from '@/components/auth/user-menu';
import { useAuth } from '@/contexts/auth-context';
import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('../components/canvas'), {
  ssr: false,
});

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <PromptInputProvider>
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="absolute top-4 right-4 z-50">
          <UserMenu />
        </div>
        <div className="flex-1 h-screen">
          <Canvas />
        </div>
        <div className="w-[400px] h-screen">
          <Chat />
        </div>
      </div>
    </PromptInputProvider>
  );
}