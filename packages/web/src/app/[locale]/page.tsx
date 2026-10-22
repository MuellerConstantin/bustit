import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MainTemplate } from '@/components/templates/MainTemplate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.home.seo');

  return { title: t('title') };
}

export default function HomePage() {
  return <MainTemplate backgroundSrc="/images/home.webp" />;
}
