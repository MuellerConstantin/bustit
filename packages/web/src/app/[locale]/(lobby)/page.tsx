import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TableGrid } from '@/components/organisms/TableGrid';
import { MainTemplate } from '@/components/templates/MainTemplate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.home.seo');

  return { title: t('title') };
}

export default async function HomePage() {
  const t = await getTranslations('pages.home');

  return (
    <MainTemplate backgroundSrc="/images/home.webp">
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
          {t('title')}
        </h1>
        <TableGrid />
      </div>
    </MainTemplate>
  );
}
