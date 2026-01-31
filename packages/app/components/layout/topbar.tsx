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
import { Github, Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface TopbarProps {
  /** 左侧菜单项，可选 */
  leftMenuItems?: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
  }>;
  /** 中间内容，可选 */
  centerContent?: React.ReactNode;
}

export function Topbar({ leftMenuItems, centerContent }: TopbarProps) {
  const { user, loading } = useAuth();
  const authT = useTranslations('auth');
  const router = useRouter();
  const pathname = usePathname();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // 登录成功后自动关闭弹窗
  useEffect(() => {
    if (user && loginDialogOpen) {
      setLoginDialogOpen(false);
    }
  }, [user, loginDialogOpen]);

  // 默认菜单项
  const defaultMenuItems = [
    {
      label: '首页',
      onClick: () => {
        const locale = pathname?.split('/')[1] || 'zh-Hans';
        router.push(`/${locale}`);
      },
    },
    {
      label: '我的项目',
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
        <div className="flex h-10 items-center justify-between px-4 relative">
          {/* 左侧下拉菜单 */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {menuItems.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={item.href ? undefined : item.onClick}
                    asChild={item.href ? true : false}
                  >
                    {item.href ? (
                      <Link href={item.href}>{item.label}</Link>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 中间内容 */}
          {centerContent && (
            <div className="absolute left-1/2 transform -translate-x-1/2">
              {centerContent}
            </div>
          )}

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

