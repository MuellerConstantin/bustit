'use client';

import type { BocTable } from '@bustit/shared';
import { Ellipsis, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { closeTableAction } from '@/actions/tables';
import { Button } from '@/components/atoms/Button';
import { Menu, MenuItem, MenuTrigger } from '@/components/atoms/Menu';
import { Modal } from '@/components/atoms/Modal';
import { Popover } from '@/components/atoms/Popover';
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog';
import { useReloadTables } from '@/hooks/useTables';
import { useRouter } from '@/i18n/navigation';

interface CloseTableProps {
  table: BocTable;
}

/** The actions of an open table: a menu that leads to closing it. */
export function CloseTable({ table }: CloseTableProps) {
  const t = useTranslations('components.closeTable');
  const router = useRouter();
  const reloadTables = useReloadTables();
  const [isConfirming, setConfirming] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setConfirming(false);
    setFailed(false);
  };

  const closeTable = () =>
    startTransition(async () => {
      setFailed(false);

      let result;

      try {
        result = await closeTableAction(table.id);
      } catch {
        // The server has logged the cause; the admin only learns to try again.
        setFailed(true);
        return;
      }

      if ('error' in result) {
        switch (result.error) {
          case 'unauthorized':
            router.replace('/login');
            return;
          case 'notFound':
            close();
            void reloadTables();
            return;
          default:
            setFailed(true);
            return;
        }
      }

      close();
      void reloadTables();
    });

  return (
    <>
      <MenuTrigger>
        <Button variant="icon" aria-label={t('actions', { name: table.name })}>
          <Ellipsis className="h-5 w-5" aria-hidden />
        </Button>
        <Popover placement="bottom end" className="min-w-40">
          <Menu aria-label={t('actions', { name: table.name })}>
            <MenuItem
              id="close"
              textValue={t('close')}
              onAction={() => setConfirming(true)}
            >
              <Lock className="h-4 w-4 text-destructive" aria-hidden />
              {t('close')}
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <Modal
        isOpen={isConfirming}
        onOpenChange={(isOpen) => !isOpen && close()}
        isDismissable={!isPending}
        isKeyboardDismissDisabled={isPending}
      >
        <ConfirmDialog
          title={t('confirmTitle')}
          confirmLabel={t('close')}
          onConfirm={closeTable}
          isPending={isPending}
          error={hasFailed ? t('errors.failed') : undefined}
        >
          {t('confirmText', { name: table.name })}
        </ConfirmDialog>
      </Modal>
    </>
  );
}
