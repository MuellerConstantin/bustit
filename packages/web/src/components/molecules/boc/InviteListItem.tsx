import type { Invite, InviteStatus } from '@bustit/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms/Badge';

const STATUS_VARIANTS = {
  open: 'primary',
  used: 'neutral',
  revoked: 'destructive',
  expired: 'neutral',
} as const satisfies Record<
  InviteStatus,
  'neutral' | 'primary' | 'destructive'
>;

interface InviteListItemProps {
  invite: Invite;
  /** What can be done with the invite, shown at the end of the row. */
  actions?: React.ReactNode;
}

export function InviteListItem({ invite, actions }: InviteListItemProps) {
  const t = useTranslations('components.inviteListItem');
  const format = useFormatter();

  const formatDate = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  /*
   * Each status has the date that matters for it. The schema allows them to be
   * null, but the status is derived from exactly these columns.
   */
  const statusDate = {
    open: invite.expiresAt,
    used: invite.usedAt,
    revoked: invite.revokedAt,
    expired: invite.expiresAt,
  }[invite.status];

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="w-24 shrink-0">
        <Badge variant={STATUS_VARIANTS[invite.status]}>
          {t(`status.${invite.status}`)}
        </Badge>
      </div>
      {/*
       * The dates break between each other, never inside one: side by side
       * where the row is wide enough, one below the other where it isn't.
       */}
      <div className="@container flex min-w-0 grow flex-col">
        <span className="truncate text-sm font-medium">{invite.title}</span>
        <span className="flex flex-col text-xs text-muted-foreground @lg:flex-row @lg:gap-1.5">
          {statusDate && (
            <span className="truncate">
              {t(`statusDate.${invite.status}`, {
                date: formatDate(statusDate),
                username: invite.usedBy?.username ?? '',
              })}
            </span>
          )}
          <span aria-hidden className="hidden @lg:inline">
            ·
          </span>
          <span className="truncate">
            {t('createdAt', { date: formatDate(invite.createdAt) })}
          </span>
        </span>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </li>
  );
}
