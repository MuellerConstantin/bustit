import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.boc.users.seo');

  return { title: t('title') };
}

export default async function BocUsersPage() {
  const t = await getTranslations('pages.boc.users');

  return <h2 className="text-2xl font-semibold">{t('title')}</h2>;
}
