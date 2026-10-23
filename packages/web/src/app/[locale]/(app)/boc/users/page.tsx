import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { UserListSkeleton } from '@/components/molecules/boc/UserListSkeleton';
import { UserList } from '@/components/organisms/boc/UserList';
import { auth } from '@/lib/server/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.boc.users.seo');

  return { title: t('title') };
}

export default async function BocUsersPage() {
  const t = await getTranslations('pages.boc.users');

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">{t('title')}</h2>
      {/* The session is read per request, so the heading can be prerendered. */}
      <Suspense fallback={<UserListSkeleton />}>
        <CurrentUserList />
      </Suspense>
    </div>
  );
}

async function CurrentUserList() {
  const session = await auth();

  // The layout lets only admins through, so there is always a session.
  return <UserList currentUserId={session!.user.id} />;
}
