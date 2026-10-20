'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Switch } from '@/components/atoms/Switch';
import { InviteListItem } from '@/components/molecules/boc/InviteListItem';
import { InviteListSkeleton } from '@/components/molecules/boc/InviteListSkeleton';
import { useInvites } from '@/hooks/useInvites';

export function InviteList() {
  const t = useTranslations('components.inviteList');
  const { data: invites, error, isLoading, mutate } = useInvites();
  const [onlyOpen, setOnlyOpen] = useState(true);

  const visibleInvites = onlyOpen
    ? invites?.filter((invite) => invite.status === 'open')
    : invites;

  return (
    <div className="flex flex-col gap-4">
      <Switch
        isSelected={onlyOpen}
        onChange={setOnlyOpen}
        className="self-start"
      >
        {t('onlyOpen')}
      </Switch>

      {isLoading && (
        <div aria-busy>
          <span className="sr-only">{t('loading')}</span>
          <InviteListSkeleton />
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">{t('error')}</p>
          <Button variant="secondary" onPress={() => void mutate()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {visibleInvites?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {onlyOpen ? t('emptyOpen') : t('empty')}
        </p>
      )}

      {visibleInvites && visibleInvites.length > 0 && (
        <ul
          aria-label={t('label')}
          className="divide-y divide-border rounded-xl border border-border"
        >
          {visibleInvites.map((invite) => (
            <InviteListItem key={invite.id} invite={invite} />
          ))}
        </ul>
      )}
    </div>
  );
}
