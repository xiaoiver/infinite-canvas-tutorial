import { getTranslations } from 'next-intl/server';
import { Luts } from './luts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('luts.metaTitle'),
    description: t('luts.metaDescription'),
  };
}

export default function LutsPage() {
  return <Luts />;
}
