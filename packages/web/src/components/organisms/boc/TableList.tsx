'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { SearchField } from '@/components/atoms/SearchField';
import { Switch } from '@/components/atoms/Switch';
import { TableListItem } from '@/components/molecules/boc/TableListItem';
import { TableListSkeleton } from '@/components/molecules/boc/TableListSkeleton';
import { CloseTable } from '@/components/organisms/boc/CloseTable';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTables } from '@/hooks/useTables';

export function TableList() {
  const t = useTranslations('components.tableList');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const {
    tables,
    totalElements,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    error,
    reload,
  } = useTables({
    status: onlyOpen ? 'open' : undefined,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SearchField
          aria-label={t('search')}
          placeholder={t('searchPlaceholder')}
          clearLabel={t('clearSearch')}
          value={search}
          onChange={setSearch}
          className="w-full sm:w-80"
        />
        <Switch isSelected={onlyOpen} onChange={setOnlyOpen}>
          {t('onlyOpen')}
        </Switch>
      </div>

      {isLoading && (
        <div aria-busy>
          <span className="sr-only">{t('loading')}</span>
          <TableListSkeleton />
        </div>
      )}

      {/* A failed refresh keeps the tables loaded before; SWR retries it. */}
      {Boolean(error) && !tables && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">{t('error')}</p>
          <Button variant="secondary" onPress={() => void reload()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {tables?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {debouncedSearch
            ? t('noMatches', { search: debouncedSearch })
            : onlyOpen
              ? t('emptyOpen')
              : t('empty')}
        </p>
      )}

      {tables && tables.length > 0 && (
        <>
          <ul
            aria-label={t('label')}
            className="divide-y divide-border rounded-xl border border-border"
          >
            {tables.map((table) => (
              <TableListItem
                key={table.id}
                table={table}
                actions={
                  table.status === 'open' && <CloseTable table={table} />
                }
              />
            ))}
          </ul>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {t('shown', {
                shown: tables.length,
                total: totalElements ?? tables.length,
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
