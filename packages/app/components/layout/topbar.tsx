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
import { BookText, ExternalLinkIcon, Github, Menu } from 'lucide-react';
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
    {
      label: 'GitHub',
      href: 'https://github.com/xiaoiver/infinite-canvas-tutorial',
      icon: Github,
    },
    {
      label: 'Documentation',
      href: 'https://infinitecanvas.cc',
      icon: BookText,
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
                {menuItems.map((item, index) => {
                  const content = (
                    <>
                      <span>{item.label}</span>
                      {item.href && <ExternalLinkIcon className="size-4 shrink-0" />}
                    </>
                  );

                  if (item.href) {
                    return (
                      <DropdownMenuItem key={index} asChild>
                        <Link
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {content}
                        </Link>
                      </DropdownMenuItem>
                    );
                  }

                  return (
                    <DropdownMenuItem
                      key={index}
                      onClick={item.onClick}
                    >
                      {content}
                    </DropdownMenuItem>
                  );
                })}
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

          {/* 右侧：主题切换、语言切换和登录按钮 */}
          <div className="flex items-center gap-1.5">
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

