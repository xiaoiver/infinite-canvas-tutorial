import { getTranslations } from 'next-intl/server';
import { FujifilmLutsTool } from './fujifilm-luts-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('fujifilmLuts.metaTitle'),
    description: t('fujifilmLuts.metaDescription'),
  };
}

export default function FujifilmLutsPage() {
  return <FujifilmLutsTool />;
}
