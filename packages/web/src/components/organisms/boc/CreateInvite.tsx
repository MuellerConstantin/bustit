'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useSWRConfig } from 'swr';
import { createInviteAction } from '@/actions/invites';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/atoms/Modal';
import { InviteCodeDialog } from '@/components/molecules/boc/InviteCodeDialog';
import { INVITES_KEY } from '@/hooks/useInvites';
import { useRouter } from '@/i18n/navigation';

export function CreateInvite() {
  const t = useTranslations('components.createInvite');
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const create = () =>
    startTransition(async () => {
      setFailed(false);

      let result;

      try {
        result = await createInviteAction();
      } catch {
        // The server has logged the cause; the admin only learns to try again.
        setFailed(true);
        return;
      }

      if ('error' in result) {
        if (result.error === 'unauthorized') {
          router.replace('/login');
        } else {
          setFailed(true);
        }

        return;
      }

      setCode(result.code);
      void mutate(INVITES_KEY);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onPress={create} isPending={isPending}>
        <Plus className="h-4 w-4" aria-hidden />
        {t('create')}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('error')}
        </p>
      )}
      {/* Closes only on purpose, so the code isn't lost by a stray click. */}
      <Modal
        isOpen={code !== null}
        onOpenChange={(isOpen) => !isOpen && setCode(null)}
        isKeyboardDismissDisabled
      >
        {code && <InviteCodeDialog code={code} />}
      </Modal>
    </div>
  );
}
