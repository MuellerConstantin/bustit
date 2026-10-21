import type { BocUser } from '@bustit/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';

interface UserListItemProps {
  user: BocUser;
  /** What can be done with the user, shown at the end of the row. */
  actions?: React.ReactNode;
}

export function UserListItem({ user, actions }: UserListItemProps) {
  const t = useTranslations('components.userListItem');
  const format = useFormatter();

  const formatDate = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <Avatar name={user.username} />
      {/*
       * The dates break between each other, never inside one: side by side
       * where the row is wide enough, one below the other where it isn't.
       */}
      <div className="@container flex min-w-0 grow flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{user.username}</span>
          <Badge variant={user.role === 'admin' ? 'primary' : 'neutral'}>
            {t(`role.${user.role}`)}
          </Badge>
          {user.disabledAt && (
            <Badge variant="destructive">{t('disabled')}</Badge>
          )}
        </span>
        <span className="flex flex-col text-xs text-muted-foreground @lg:flex-row @lg:gap-1.5">
          <span className="truncate">
            {t('createdAt', { date: formatDate(user.createdAt) })}
          </span>
          {user.disabledAt && (
            <>
              <span aria-hidden className="hidden @lg:inline">
                ·
              </span>
              <span className="truncate">
                {t('disabledAt', { date: formatDate(user.disabledAt) })}
              </span>
            </>
          )}
        </span>
      </div>
      <span className="shrink-0 text-sm tabular-nums">
        {t('balance', { balance: user.balance })}
      </span>
      {actions && <div className="shrink-0">{actions}</div>}
    </li>
  );
}
