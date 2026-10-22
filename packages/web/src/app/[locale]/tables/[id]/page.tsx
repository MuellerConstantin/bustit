import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TableView } from '@/components/organisms/TableView';
import { MainTemplate } from '@/components/templates/MainTemplate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.tables.seo');

  return { title: t('title') };
}

export default function TablePage() {
  return (
    <MainTemplate>
      <TableView />
    </MainTemplate>
  );
}
