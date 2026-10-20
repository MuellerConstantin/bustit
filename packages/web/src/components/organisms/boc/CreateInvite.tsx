'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/atoms/Button';
import { Dialog, DialogHeading } from '@/components/atoms/Dialog';
import { Modal } from '@/components/atoms/Modal';
import { InviteCode } from '@/components/molecules/boc/InviteCode';
import { CreateInviteForm } from '@/components/organisms/boc/CreateInviteForm';
import { INVITES_KEY } from '@/hooks/useInvites';

/**
 * Creates an invite in a dialog: first its title, then its code. Once the
 * code is shown, the dialog only closes on purpose, so it isn't lost by a
 * stray click.
 */
export function CreateInvite() {
  const t = useTranslations('components.createInvite');
  const { mutate } = useSWRConfig();
  const [isOpen, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setCode(null);
  };

  const showCode = (created: string) => {
    setCode(created);
    void mutate(INVITES_KEY);
  };

  return (
    <>
      <Button onPress={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        {t('create')}
      </Button>
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => !open && close()}
        isDismissable={code === null}
        isKeyboardDismissDisabled={code !== null}
      >
        <Dialog>
          {code === null ? (
            <>
              <DialogHeading>{t('formTitle')}</DialogHeading>
              <CreateInviteForm onCreated={showCode} onCancel={close} />
            </>
          ) : (
            <>
              <DialogHeading>{t('codeTitle')}</DialogHeading>
              <InviteCode code={code} />
              <Button className="self-end" onPress={close}>
                {t('done')}
              </Button>
            </>
          )}
        </Dialog>
      </Modal>
    </>
  );
}
