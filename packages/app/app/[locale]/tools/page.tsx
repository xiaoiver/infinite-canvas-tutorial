import { getTranslations } from 'next-intl/server';
import ToolsPageClient from './tools-page-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function ToolsPage() {
  return <ToolsPageClient />;
}
