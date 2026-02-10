'use client';

import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { UserMenu } from '@/components/auth/user-menu';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/contexts/auth-context';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookText, Github, Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ImageToolbar } from '@/components/image-toolbar';
import { ColorToolbar } from '../color-toolbar';

interface TopbarProps {
  /** 左侧菜单项，可选 */
  leftMenuItems?: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
  }>;
  leftMenuContent?: React.ReactNode;
  /** 中间内容，可选 */
  centerContent?: React.ReactNode;
}

export function Topbar({ leftMenuItems, leftMenuContent, centerContent }: TopbarProps) {
  const { user, loading } = useAuth();
  const authT = useTranslations('auth');
  const router = useRouter();
  const pathname = usePathname();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const t = useTranslations('toolbar');

  // 登录成功后自动关闭弹窗
  useEffect(() => {
    if (user && loginDialogOpen) {
      setLoginDialogOpen(false);
    }
  }, [user, loginDialogOpen]);

  // 默认菜单项
  const defaultMenuItems = [
    {
      label: t('home'),
      onClick: () => {
        const locale = pathname?.split('/')[1] || 'zh-Hans';
        router.push(`/${locale}`);
      },
    },
    {
      label: t('myProjects'),
      onClick: () => {
        const locale = pathname?.split('/')[1] || 'zh-Hans';
        router.push(`/${locale}/projects`);
      },
    },
  ];

  const menuItems = leftMenuItems || defaultMenuItems;

  return (
    <>
      <div className="w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-10 items-center justify-between px-2 pl-3 relative">
          {/* 左侧下拉菜单 */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {menuItems.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={item.onClick}
                  >
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
                {leftMenuContent}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 中间内容区域 */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            <ImageToolbar />
            <ColorToolbar />
            {centerContent && (
              <div>
                {centerContent}
              </div>
            )}
          </div>

          {/* 右侧：Github 图标和登录按钮 */}
          <div className="flex items-center gap-1.5">
            <Link
              href="https://github.com/xiaoiver/infinite-canvas-tutorial"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground h-8 w-8"
            >
              <Github className="h-4 w-4" />
            </Link>
            <Link
              href="https://infinitecanvas.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground h-8 w-8"
            >
              <BookText className="h-4 w-4" />
            </Link>
            <ThemeToggle />
            <LocaleSwitcher />
            {user ? (
              <UserMenu />
            ) : (
              <Button onClick={() => setLoginDialogOpen(true)} size="sm">
                {authT('login')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 登录弹窗 */}
      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogTitle className="sr-only">Login</DialogTitle>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <LoginForm />
        </DialogContent>
      </Dialog>
    </>
  );
}

