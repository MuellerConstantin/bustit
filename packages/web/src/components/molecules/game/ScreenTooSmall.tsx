import { MonitorSmartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/components/atoms/Link';

/** Shown in place of the game on a screen too narrow for the table. */
export function ScreenTooSmall() {
  const t = useTranslations('components.screenTooSmall');

  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-card-border bg-card p-6 backdrop-blur-xl">
      <MonitorSmartphone className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="font-display text-3xl tracking-wide">{t('title')}</h2>
      <p className="text-sm text-muted-foreground">{t('text')}</p>
      <Link href="/">{t('lobby')}</Link>
    </div>
  );
}
