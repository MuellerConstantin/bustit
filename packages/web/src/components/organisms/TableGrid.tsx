'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/Button';
import { TableCard } from '@/components/molecules/TableCard';
import { TableGridSkeleton } from '@/components/molecules/TableGridSkeleton';
import { useOpenTables } from '@/hooks/useOpenTables';

/** The open tables of the lobby. */
export function TableGrid() {
  const t = useTranslations('components.tableGrid');
  const { tables, totalElements, isLoading, error, reload } = useOpenTables();

  if (isLoading) {
    return (
      <div aria-busy>
        <span className="sr-only">{t('loading')}</span>
        <TableGridSkeleton />
      </div>
    );
  }

  // A failed refresh keeps the tables loaded before; SWR retries it.
  if (!tables) {
    return error ? (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 backdrop-blur-xl"
      >
        <p className="text-sm text-destructive">{t('error')}</p>
        <Button variant="secondary" onPress={() => void reload()}>
          {t('retry')}
        </Button>
      </div>
    ) : null;
  }

  if (tables.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
        {t('empty')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
