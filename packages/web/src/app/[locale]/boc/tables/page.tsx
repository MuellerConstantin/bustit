import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CreateTable } from '@/components/organisms/boc/CreateTable';
import { TableList } from '@/components/organisms/boc/TableList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.boc.tables.seo');

  return { title: t('title') };
}

export default async function BocTablesPage() {
  const t = await getTranslations('pages.boc.tables');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold">{t('title')}</h2>
        <CreateTable />
      </div>
      <TableList />
    </div>
  );
}
