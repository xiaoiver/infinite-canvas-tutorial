import { getTranslations } from 'next-intl/server';
import { GlitchTool } from './glitch-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('glitch.metaTitle'),
    description: t('glitch.metaDescription'),
  };
}

export default function GlitchPage() {
  return <GlitchTool />;
}
