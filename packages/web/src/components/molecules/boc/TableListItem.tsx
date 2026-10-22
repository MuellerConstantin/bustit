import type { BocTable } from '@bustit/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms/Badge';
import { Bill } from '@/components/atoms/Bill';

interface TableListItemProps {
  table: BocTable;
  /** What can be done with the table, shown at the end of the row. */
  actions?: React.ReactNode;
}

export function TableListItem({ table, actions }: TableListItemProps) {
  const t = useTranslations('components.tableListItem');
  const format = useFormatter();

  const formatDate = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="w-24 shrink-0">
        <Badge variant={table.status === 'open' ? 'primary' : 'neutral'}>
          {t(`status.${table.status}`)}
        </Badge>
      </div>
      {/*
       * The details break between each other, never inside one: side by side
       * where the row is wide enough, one below the other where it isn't.
       */}
      <div className="@container flex min-w-0 grow flex-col">
        <span className="truncate text-sm font-medium">{table.name}</span>
        <span className="flex flex-col text-xs text-muted-foreground @lg:flex-row @lg:gap-1.5">
          <span className="flex items-center gap-1.5 truncate">
            {t('seats', { seats: table.seats })}
            <span aria-hidden>·</span>
            <Bill />
            {/* The bill stands in for the currency's name, which only screen readers get */}
            <span aria-hidden className="tabular-nums">
              {t('betRange', { min: table.minBet, max: table.maxBet })}
            </span>
            <span className="sr-only">
              {t('betRangeLabel', { min: table.minBet, max: table.maxBet })}
            </span>
          </span>
          <span aria-hidden className="hidden @lg:inline">
            ·
          </span>
          <span className="truncate">
            {table.closedAt
              ? t('closedAt', { date: formatDate(table.closedAt) })
              : t('createdAt', { date: formatDate(table.createdAt) })}
          </span>
        </span>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </li>
  );
}
