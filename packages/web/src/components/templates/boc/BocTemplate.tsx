import { getTranslations } from 'next-intl/server';
import { BocNavigation } from '@/components/organisms/boc/BocNavigation';
import { MainTemplate } from '@/components/templates/MainTemplate';

interface BocTemplateProps {
  children: React.ReactNode;
}

/** Frame for the operations console: a heading, the sidebar and the page. */
export async function BocTemplate({ children }: BocTemplateProps) {
  const t = await getTranslations('components.bocTemplate');

  return (
    <MainTemplate>
      <h1 className="font-display text-4xl tracking-wide sm:text-5xl">
        {t('title')}
      </h1>
      <hr className="mt-4 mb-6 border-border" />
      <div className="flex grow flex-col gap-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-56">
          <BocNavigation />
        </aside>
        <div className="flex min-w-0 grow flex-col">{children}</div>
      </div>
    </MainTemplate>
  );
}
