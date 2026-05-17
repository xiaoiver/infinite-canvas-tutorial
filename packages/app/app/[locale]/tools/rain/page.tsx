import { getTranslations } from 'next-intl/server';
import { RainTool } from './rain-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('rain.metaTitle'),
    description: t('rain.metaDescription'),
  };
}

export default function RainPage() {
  return <RainTool />;
}
