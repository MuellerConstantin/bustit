'use client';

import { notFound, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useTable } from '@/hooks/useTable';
import { Armchair, LogOut } from 'lucide-react';
import { Bill } from '../atoms/Bill';
import { useRouter } from '@/i18n/navigation';
import { GameView } from './GameView';

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
  const router = useRouter();
  const t = useTranslations('components.tableView');
  const { id } = useParams<{ id: string }>();
  const { table, isLoading, isNotFound, error, reload } = useTable(id);

  if (isLoading) {
    return <TableViewSkeleton />;
  }

  if (isNotFound) {
    return notFound();
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="line-clamp-2 font-display text-4xl tracking-wide sm:text-5xl">
            {table.name}
          </h1>
          <Button variant="icon" onPress={() => router.push('/')}>
            <LogOut />
          </Button>
        </div>
        <hr />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div>
                <Armchair className="h-4 w-4" aria-hidden />
                <span className="sr-only">{t('seatsLabel')}</span>
              </div>
              <div>{t('seats', { seats: table.seats })}</div>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <Bill />
                <span className="sr-only">{t('betsLabel')}</span>
              </div>
              {/* The bill stands in for the currency's name, which only screen readers get */}
              <div>
                <span aria-hidden>
                  {t('betRange', { min: table.minBet, max: table.maxBet })}
                </span>
                <span className="sr-only">
                  {t('betRangeLabel', { min: table.minBet, max: table.maxBet })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <GameView
        tableId={table.id}
        minBet={table.minBet}
        maxBet={table.maxBet}
      />
    </div>
  );
}
