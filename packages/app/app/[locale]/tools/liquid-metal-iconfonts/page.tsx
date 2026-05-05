import { getTranslations } from 'next-intl/server';
import { LiquidMetalIconfontsTool } from './liquid-metal-iconfonts-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('liquidMetalIconfonts.metaTitle'),
    description: t('liquidMetalIconfonts.metaDescription'),
  };
}

export default function LiquidMetalIconfontsPage() {
  return <LiquidMetalIconfontsTool />;
}
