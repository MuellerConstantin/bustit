import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InviteList } from '@/components/organisms/boc/InviteList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.boc.invites.seo');

  return { title: t('title') };
}

export default async function BocInvitesPage() {
  const t = await getTranslations('pages.boc.invites');

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">{t('title')}</h2>
      <InviteList />
    </div>
  );
}
