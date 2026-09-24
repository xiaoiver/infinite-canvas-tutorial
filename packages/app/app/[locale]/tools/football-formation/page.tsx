import { getTranslations } from 'next-intl/server';
import { FootballFormationTool } from './football-formation-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('footballFormation.metaTitle'),
    description: t('footballFormation.metaDescription'),
  };
}

export default function FootballFormationPage() {
  return <FootballFormationTool />;
}
