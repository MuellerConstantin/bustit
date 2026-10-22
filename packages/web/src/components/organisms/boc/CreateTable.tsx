'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Dialog, DialogHeading } from '@/components/atoms/Dialog';
import { Modal } from '@/components/atoms/Modal';
import { CreateTableForm } from '@/components/organisms/boc/CreateTableForm';
import { useReloadTables } from '@/hooks/useTables';

/** Creates a table in a dialog, which closes once the table exists. */
export function CreateTable() {
  const t = useTranslations('components.createTable');
  const reloadTables = useReloadTables();
  const [isOpen, setOpen] = useState(false);

  const created = () => {
    setOpen(false);
    void reloadTables();
  };

  return (
    <>
      <Button onPress={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        {t('create')}
      </Button>
      <Modal isOpen={isOpen} onOpenChange={setOpen} isDismissable>
        <Dialog>
          <DialogHeading>{t('formTitle')}</DialogHeading>
          <CreateTableForm
            onCreated={created}
            onCancel={() => setOpen(false)}
          />
        </Dialog>
      </Modal>
    </>
  );
}
