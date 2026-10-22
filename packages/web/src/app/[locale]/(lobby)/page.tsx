import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TableGrid } from '@/components/organisms/TableGrid';
import { LobbyTemplate } from '@/components/templates/LobbyTemplate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.home.seo');

  return { title: t('title') };
}

export default async function HomePage() {
  const t = await getTranslations('pages.home');

  return (
    <LobbyTemplate>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-end">
          <h1 className="font-display text-4xl tracking-wide text-white sm:text-5xl">
            {t('title')}
          </h1>
        </section>
        <section>
          <TableGrid />
        </section>
      </div>
    </LobbyTemplate>
  );
}
