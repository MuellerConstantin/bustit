'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Switch } from '@/components/atoms/Switch';
import { InviteListItem } from '@/components/molecules/boc/InviteListItem';
import { InviteListSkeleton } from '@/components/molecules/boc/InviteListSkeleton';
import { RevokeInvite } from '@/components/organisms/boc/RevokeInvite';
import { useInvites } from '@/hooks/useInvites';

export function InviteList() {
  const t = useTranslations('components.inviteList');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const {
    invites,
    totalElements,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    error,
    reload,
  } = useInvites({ status: onlyOpen ? 'open' : undefined });

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

      {/* A failed refresh keeps the invites loaded before; SWR retries it. */}
      {Boolean(error) && !invites && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">{t('error')}</p>
          <Button variant="secondary" onPress={() => void reload()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {invites?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {onlyOpen ? t('emptyOpen') : t('empty')}
        </p>
      )}

      {invites && invites.length > 0 && (
        <>
          <ul
            aria-label={t('label')}
            className="divide-y divide-border rounded-xl border border-border"
          >
            {invites.map((invite) => (
              <InviteListItem
                key={invite.id}
                invite={invite}
                actions={
                  invite.status === 'open' && <RevokeInvite invite={invite} />
                }
              />
            ))}
          </ul>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {t('shown', {
                shown: invites.length,
                total: totalElements ?? invites.length,
              })}
            </p>
            {hasMore && (
              <Button
                variant="secondary"
                onPress={() => void loadMore()}
                isPending={isLoadingMore}
              >
                {t('loadMore')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
