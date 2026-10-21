'use client';

import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/Button';
import { MenuTrigger } from '@/components/atoms/Menu';
import { Popover } from '@/components/atoms/Popover';
import { I18nLocaleMenu } from './I18nLocaleMenu';

export function I18nLocaleToggle() {
  const t = useTranslations('components.i18nLocaleMenu');

  return (
    <MenuTrigger>
      <Button variant="icon" aria-label={t('label')}>
        <Languages className="h-6 w-6" />
      </Button>
      <Popover placement="bottom end" className="min-w-40">
        <I18nLocaleMenu />
      </Popover>
    </MenuTrigger>
  );
}
