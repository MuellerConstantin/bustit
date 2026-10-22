'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useTable } from '@/hooks/useTable';

function TableViewSkeleton() {
  const t = useTranslations('components.tableView');

  return (
    <div aria-busy>
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-10 w-64 sm:h-12" />
    </div>
  );
}

/** The table whose id is in the path. */
export function TableView() {
  /*
   * The id is only known at request time, so the part that reads it streams
   * in behind the boundary instead of blocking the prerendered page.
   */
  return (
    <Suspense fallback={<TableViewSkeleton />}>
      <TableOfPath />
    </Suspense>
  );
}

function TableOfPath() {
  const t = useTranslations('components.tableView');
  const { id } = useParams<{ id: string }>();
  const { table, isLoading, isNotFound, error, reload } = useTable(id);

  if (isLoading) {
    return <TableViewSkeleton />;
  }

  if (isNotFound) {
    return <p className="text-sm text-muted-foreground">{t('notFound')}</p>;
  }

  if (!table) {
    return error ? (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">{t('error')}</p>
        <Button variant="secondary" onPress={() => void reload()}>
          {t('retry')}
        </Button>
      </div>
    ) : null;
  }

  return (
    <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
      {table.name}
    </h1>
  );
}
