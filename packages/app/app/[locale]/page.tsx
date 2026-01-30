'use client';

import { useState, useEffect } from 'react';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import Chat from '@/components/chat';
import { LoginForm } from '@/components/auth/login-form';
import { UserMenu } from '@/components/auth/user-menu';
import { useAuth } from '@/contexts/auth-context';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Github, Menu } from 'lucide-react';
import Link from 'next/link';

const Canvas = dynamic(() => import('../../components/canvas'), {
  ssr: false,
});

export default function Home() {
  const { user, loading } = useAuth();
  const t = useTranslations('common');
  const authT = useTranslations('auth');
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // 登录成功后自动关闭弹窗
  useEffect(() => {
    if (user && loginDialogOpen) {
      setLoginDialogOpen(false);
    }
  }, [user, loginDialogOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  return (
    <PromptInputProvider>
      <div className="flex flex-col h-screen">
        {/* 顶部工具条 - 固定在页面顶端 */}
        <div className="w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            {/* 左侧下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>
                  菜单项 1
                </DropdownMenuItem>
                <DropdownMenuItem>
                  菜单项 2
                </DropdownMenuItem>
                <DropdownMenuItem>
                  菜单项 3
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 右侧：Github 图标和登录按钮 */}
            <div className="flex items-center gap-2">
              <Link
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground h-9 w-9"
              >
                <Github className="h-5 w-5" />
              </Link>
              {user ? (
                <UserMenu />
              ) : (
                <Button onClick={() => setLoginDialogOpen(true)}>
                  {authT('login')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 主要内容区域 - 添加顶部 padding 避免被工具条遮挡 */}
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <div className="flex-1 h-full">
            <Canvas />
          </div>
          <div className="w-[400px] h-full">
            <Chat />
          </div>
        </div>
      </div>

      {/* 登录弹窗 */}
      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent className="max-w-md p-0">
          <div className="p-6">
            <LoginForm />
          </div>
        </DialogContent>
      </Dialog>
    </PromptInputProvider>
  );
}


