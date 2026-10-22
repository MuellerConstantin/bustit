'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { SearchField } from '@/components/atoms/SearchField';
import { TableCard } from '@/components/molecules/TableCard';
import { TableGridSkeleton } from '@/components/molecules/TableGridSkeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useOpenTables } from '@/hooks/useOpenTables';

/** The open tables of the lobby, searchable by name. */
export function TableGrid() {
  const t = useTranslations('components.tableGrid');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const { tables, totalElements, isLoading, error, reload } = useOpenTables({
    search: debouncedSearch || undefined,
  });

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

      {/* A new search keeps showing the tables found before until it loads. */}
      {isLoading && !tables && (
        <div aria-busy>
          <span className="sr-only">{t('loading')}</span>
          <TableGridSkeleton />
        </div>
      )}

      {/* A failed refresh keeps the tables loaded before; SWR retries it. */}
      {Boolean(error) && !tables && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-2xl border border-card-border bg-card p-5 backdrop-blur-xl"
        >
          <p className="text-sm text-destructive">{t('error')}</p>
          <Button variant="secondary" onPress={() => void reload()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {/* Waits for the current search, so it never names one that is still loading. */}
      {!isLoading && tables?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-card-border bg-card px-4 py-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
          {debouncedSearch
            ? t('noMatches', { search: debouncedSearch })
            : t('empty')}
        </p>
      )}

      {tables && tables.length > 0 && (
        <>
          <ul
            aria-label={t('label')}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {tables.map((table) => (
              <li key={table.id}>
                <TableCard table={table} />
              </li>
            ))}
          </ul>
          {totalElements !== undefined && totalElements > tables.length && (
            <p className="text-center text-xs text-muted-foreground">
              {t('more', { shown: tables.length, total: totalElements })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
