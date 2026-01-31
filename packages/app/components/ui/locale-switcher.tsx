'use client';

import { useTranslations } from 'next-intl';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Check, Globe } from 'lucide-react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useParams } from 'next/navigation';

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;
  const t = useTranslations('language');

  const switchLocale = (newLocale: string) => {
    // 使用 next-intl 的类型安全导航
    // pathname 已经是不包含 locale 前缀的路径
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
          <Globe className="h-4 w-4" />
          <span className="sr-only">切换语言</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => switchLocale('en')}>
          <Check
            className={`mr-2 h-4 w-4 ${
              currentLocale === 'en' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {t('english')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchLocale('zh-Hans')}>
          <Check
            className={`mr-2 h-4 w-4 ${
              currentLocale === 'zh-Hans' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {t('chinese')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchLocale('es-419')}>
          <Check
            className={`mr-2 h-4 w-4 ${
              currentLocale === 'es-419' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {t('spanish')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

