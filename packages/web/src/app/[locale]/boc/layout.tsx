import { forbidden } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@/lib/server/auth';

export default function BocLayout({ children }: LayoutProps<'/[locale]/boc'>) {
  return (
    <Suspense>
      <AdminOnly>{children}</AdminOnly>
    </Suspense>
  );
}

/**
 * The operations console is for admins only. The role comes from the session,
 * so it is the one from login time; the game server checks it again on every
 * call.
 */
async function AdminOnly({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user.role !== 'admin') {
    forbidden();
  }

  return children;
}
