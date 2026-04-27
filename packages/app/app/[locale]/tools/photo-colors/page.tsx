import { getTranslations } from 'next-intl/server';
import { PhotoColorsTool } from './photo-colors-tool';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return {
    title: t('photoColors.metaTitle'),
    description: t('photoColors.metaDescription'),
  };
}

export default function PhotoColorsPage() {
  return <PhotoColorsTool />;
}
