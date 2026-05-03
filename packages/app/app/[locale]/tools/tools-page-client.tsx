'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Topbar } from '@/components/layout/topbar';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type ToolEntry, toolEntries } from './_lib/tool-entries';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

function ToolCard({ entry }: { entry: ToolEntry }) {
  const t = useTranslations('tools');
  const title = t(`items.${entry.id}.title`);
  const href = entry.path ? `/tools${entry.path}` : undefined;
  const isReady = entry.status === 'ready' && href;
  const hasShot = Boolean(entry.screenshot);
  const cardInner = (
    <Card
      className={cn(
        'h-full overflow-hidden transition-colors',
        hasShot && 'gap-0 py-0 pb-6',
        isReady && 'hover:border-primary/50 hover:bg-muted/30',
        !isReady && 'opacity-90',
      )}
    >
      {entry.screenshot ? (
        <div className="relative aspect-video w-full bg-muted">
          <Image
            src={entry.screenshot}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 42rem"
          />
        </div>
      ) : null}
      <CardHeader className={cn('space-y-2', hasShot && 'pt-6')}>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{title}</CardTitle>
          {entry.status === 'comingSoon' && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {t('comingSoon')}
            </Badge>
          )}
        </div>
      </CardHeader>
    </Card>
  );

  if (isReady && href) {
    return <Link href={href}>{cardInner}</Link>;
  }

  return <div className="block h-full cursor-default">{cardInner}</div>;
}

export default function ToolsPageClient() {
  const t = useTranslations('tools');

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-5" aria-hidden />
            <span className="text-sm font-medium tracking-wide uppercase">{t('kicker')}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        </header>
        <ul className="grid gap-4 sm:grid-cols-1">
          {toolEntries.map((entry) => (
            <li key={entry.id}>
              <ToolCard entry={entry} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
