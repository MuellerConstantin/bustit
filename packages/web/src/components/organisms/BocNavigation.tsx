'use client';

import { DoorOpen, type LucideIcon, Ticket, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/components/atoms/Link';
import { usePathname } from '@/i18n/navigation';

type Entry = 'users' | 'invites' | 'rooms';

const SECTIONS: readonly {
  id: 'accounts' | 'gameplay';
  entries: readonly { id: Entry; href: string; icon: LucideIcon }[];
}[] = [
  {
    id: 'accounts',
    entries: [
      { id: 'users', href: '/boc/users', icon: Users },
      { id: 'invites', href: '/boc/invites', icon: Ticket },
    ],
  },
  {
    id: 'gameplay',
    entries: [{ id: 'rooms', href: '/boc/rooms', icon: DoorOpen }],
  },
];

export function BocNavigation() {
  const t = useTranslations('components.bocNavigation');
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t(`sections.${section.id}`)}
          </h2>
          {section.entries.map(({ id, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              variant="nav"
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`)
                  ? 'page'
                  : undefined
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(`entries.${id}`)}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
