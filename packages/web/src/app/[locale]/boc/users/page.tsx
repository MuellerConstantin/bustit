import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UserList } from '@/components/organisms/boc/UserList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.boc.users.seo');

  return { title: t('title') };
}

export default async function BocUsersPage() {
  const t = await getTranslations('pages.boc.users');

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">{t('title')}</h2>
      <UserList />
    </div>
  );
}
