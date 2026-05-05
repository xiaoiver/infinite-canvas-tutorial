import { getTranslations } from 'next-intl/server';
import { LiquidMetalTool } from './liquid-metal-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('liquidMetal.metaTitle'),
    description: t('liquidMetal.metaDescription'),
  };
}

export default function LiquidMetalPage() {
  return <LiquidMetalTool />;
}
