import type { BocUser } from '@bustit/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Bill } from '@/components/atoms/Bill';

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
    <li className="@container/row px-4 py-3">
      {/*
       * The balance gets a column of its own where the row is wide enough and
       * goes below the dates where it isn't, so the name keeps its room.
       */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 [grid-template-areas:'avatar_info_actions'_'avatar_balance_actions'] @md/row:grid-cols-[auto_minmax(0,1fr)_auto_auto] @md/row:[grid-template-areas:'avatar_info_balance_actions']">
        <Avatar name={user.username} className="[grid-area:avatar]" />
        {/*
         * The dates break between each other, never inside one: side by side
         * where the row is wide enough, one below the other where it isn't.
         */}
        <div className="@container flex min-w-0 flex-col [grid-area:info]">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">
              {user.username}
            </span>
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
        <span className="flex items-center gap-1.5 text-sm tabular-nums [grid-area:balance]">
          <Bill />
          {/* The bill stands in for the currency's name, which only screen readers get */}
          <span aria-hidden>{format.number(user.balance)}</span>
          <span className="sr-only">
            {t('balance', { balance: user.balance })}
          </span>
        </span>
        {/* Kept as wide as the actions button in every row, so the balances line up. */}
        <div className="w-8 [grid-area:actions]">{actions}</div>
      </div>
    </li>
  );
}
