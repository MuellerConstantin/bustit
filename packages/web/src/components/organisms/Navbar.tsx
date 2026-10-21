import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Link } from '@/components/atoms/Link';
import { UserMenu } from '@/components/organisms/UserMenu';
import { auth } from '@/lib/server/auth';
import { I18nLocaleToggle } from '@/components/molecules/I18nLocaleToggle';

export async function Navbar() {
  const t = await getTranslations('components.navbar');

  return (
    <header className="border-b border-border bg-card backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label={t('home')} className="no-underline">
          <Image
            src="/images/logo.svg"
            alt="Logo"
            width={40}
            height={40}
            priority
            className="size-10"
          />
        </Link>
        <div className="flex items-center gap-2">
          <I18nLocaleToggle />
          {/* The session is read per request, so the rest of the navbar can be prerendered. */}
          <Suspense fallback={<Avatar className="m-0.5" />}>
            <CurrentUserMenu />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}

async function CurrentUserMenu() {
  const session = await auth();

  if (!session) {
    return null;
  }

  return <UserMenu username={session.user.username} role={session.user.role} />;
}
