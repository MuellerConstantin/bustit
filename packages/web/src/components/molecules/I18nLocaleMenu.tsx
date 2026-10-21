'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { type Locale, useLocale, useTranslations } from 'next-intl';
import { Menu, MenuItem } from '@/components/atoms/Menu';

export function I18nLocaleMenu() {
  const t = useTranslations('components.i18nLocaleMenu');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onLocaleChange = useCallback(
    (newLocale: Locale | undefined) => {
      router.replace(pathname, { locale: newLocale });
    },
    [pathname, router],
  );

  return (
    <Menu
      aria-label={t('label')}
      selectionMode="single"
      selectedKeys={[`locale-${locale}`]}
      onSelectionChange={(key) =>
        onLocaleChange(
          [...(key as Set<string>)][0]?.split('-')[1] as Locale | undefined,
        )
      }
    >
      <MenuItem id={`locale-en`}>{t('english')}</MenuItem>
      <MenuItem id={`locale-de`}>{t('german')}</MenuItem>
    </Menu>
  );
}
