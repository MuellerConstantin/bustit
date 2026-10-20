import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MainTemplate } from '@/components/templates/MainTemplate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.boc.seo');

  return { title: t('title') };
}

export default async function BocPage() {
  return <MainTemplate></MainTemplate>;
}
