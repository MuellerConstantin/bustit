'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { SearchField } from '@/components/atoms/SearchField';
import { UserListItem } from '@/components/molecules/boc/UserListItem';
import { UserListSkeleton } from '@/components/molecules/boc/UserListSkeleton';
import { DeleteUser } from '@/components/organisms/boc/DeleteUser';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUsers } from '@/hooks/useUsers';

interface UserListProps {
  /** The logged-in admin, who can't delete themselves. */
  currentUserId: string;
}

export function UserList({ currentUserId }: UserListProps) {
  const t = useTranslations('components.userList');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const {
    users,
    totalElements,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    error,
    reload,
  } = useUsers({ search: debouncedSearch || undefined });

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        aria-label={t('search')}
        placeholder={t('searchPlaceholder')}
        clearLabel={t('clearSearch')}
        value={search}
        onChange={setSearch}
        className="w-full sm:w-80"
      />

      {/* A new search keeps showing the users found before until it loads. */}
      {isLoading && !users && (
        <div aria-busy>
          <span className="sr-only">{t('loading')}</span>
          <UserListSkeleton />
        </div>
      )}

      {/* A failed refresh keeps the users loaded before; SWR retries it. */}
      {Boolean(error) && !users && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">{t('error')}</p>
          <Button variant="secondary" onPress={() => void reload()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {/* Without a search the list has at least the admin who views it. */}
      {/* Waits for the current search, so it never names one that is still loading. */}
      {!isLoading && users?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t('noMatches', { search: debouncedSearch })}
        </p>
      )}

      {users && users.length > 0 && (
        <>
          <ul
            aria-label={t('label')}
            className="divide-y divide-border rounded-xl border border-border"
          >
            {users.map((user) => (
              <UserListItem
                key={user.id}
                user={user}
                actions={
                  user.id !== currentUserId && <DeleteUser user={user} />
                }
              />
            ))}
          </ul>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {t('shown', {
                shown: users.length,
                total: totalElements ?? users.length,
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
