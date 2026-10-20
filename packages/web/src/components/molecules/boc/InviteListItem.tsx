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
}

export function InviteListItem({ invite }: InviteListItemProps) {
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
      <div className="flex min-w-0 flex-col">
        {statusDate && (
          <span className="text-sm">
            {t(`statusDate.${invite.status}`, { date: formatDate(statusDate) })}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {t('createdAt', { date: formatDate(invite.createdAt) })}
        </span>
      </div>
    </li>
  );
}
