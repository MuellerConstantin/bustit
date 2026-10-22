import type { Table } from '@bustit/shared';
import { Armchair } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Bill } from '@/components/atoms/Bill';
import { Link } from '@/components/atoms/Link';

interface TableCardProps {
  table: Table;
}

/** An open table in the lobby, on frosted glass over the scene behind it. */
export function TableCard({ table }: TableCardProps) {
  const t = useTranslations('components.tableCard');

  return (
    <article className="relative flex h-full flex-col gap-4 rounded-2xl border border-card-border bg-card p-5 shadow-2xl backdrop-blur-xl hover:border-primary">
      <h3 className="line-clamp-2 font-display text-2xl tracking-wide text-card-foreground">
        {/*
         * The link's pseudo-element covers the whole card, so the card is
         * clickable while only the name is read out as the link.
         */}
        <Link
          href={`/tables/${table.id}`}
          className="text-card-foreground no-underline after:absolute after:inset-0 after:rounded-2xl"
        >
          {table.name}
        </Link>
      </h3>
      <dl className="mt-auto flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <dt>
            <Armchair className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t('seatsLabel')}</span>
          </dt>
          <dd>{t('seats', { seats: table.seats })}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>
            <Bill />
            <span className="sr-only">{t('betsLabel')}</span>
          </dt>
          {/* The bill stands in for the currency's name, which only screen readers get */}
          <dd className="tabular-nums">
            <span aria-hidden>
              {t('betRange', { min: table.minBet, max: table.maxBet })}
            </span>
            <span className="sr-only">
              {t('betRangeLabel', { min: table.minBet, max: table.maxBet })}
            </span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
