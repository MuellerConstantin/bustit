'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/Button';
import { UserListItem } from '@/components/molecules/boc/UserListItem';
import { UserListSkeleton } from '@/components/molecules/boc/UserListSkeleton';
import { DeleteUser } from '@/components/organisms/boc/DeleteUser';
import { useUsers } from '@/hooks/useUsers';

interface UserListProps {
  /** The logged-in admin, who can't delete themselves. */
  currentUserId: string;
}

export function UserList({ currentUserId }: UserListProps) {
  const t = useTranslations('components.userList');
  const {
    users,
    totalElements,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    error,
    reload,
  } = useUsers();

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
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
