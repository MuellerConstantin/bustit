import { getTranslations } from 'next-intl/server';
import { Link } from '@/components/atoms/Link';
import { MainTemplate } from '@/components/templates/MainTemplate';

export default async function Forbidden() {
  const t = await getTranslations('pages.forbidden');

  return (
    <MainTemplate>
      <div className="flex grow flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
          {t('title')}
        </h1>
        <p className="max-w-md text-muted-foreground">{t('description')}</p>
        <Link href="/">{t('toHome')}</Link>
      </div>
    </MainTemplate>
  );
}
