'use client';

import type { Invite } from '@bustit/shared';
import { Ban, Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { revokeInviteAction } from '@/actions/invites';
import { Button } from '@/components/atoms/Button';
import { Menu, MenuItem, MenuTrigger } from '@/components/atoms/Menu';
import { Modal } from '@/components/atoms/Modal';
import { Popover } from '@/components/atoms/Popover';
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog';
import { useReloadInvites } from '@/hooks/useInvites';
import { useRouter } from '@/i18n/navigation';

type Failure = 'used' | 'failed';

interface RevokeInviteProps {
  invite: Invite;
}

/** The actions of an open invite: a menu that leads to revoking it. */
export function RevokeInvite({ invite }: RevokeInviteProps) {
  const t = useTranslations('components.revokeInvite');
  const router = useRouter();
  const reloadInvites = useReloadInvites();
  const [isConfirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setConfirming(false);
    setFailure(null);

    /*
     * Reloading at once would unmount this dialog along with the invite's
     * actions, before the admin could read why revoking failed.
     */
    if (failure === 'used') {
      void reloadInvites();
    }
  };

  const revoke = () =>
    startTransition(async () => {
      setFailure(null);

      let result;

      try {
        result = await revokeInviteAction(invite.id);
      } catch {
        // The server has logged the cause; the admin only learns to try again.
        setFailure('failed');
        return;
      }

      if ('error' in result) {
        switch (result.error) {
          case 'unauthorized':
            router.replace('/login');
            return;
          case 'used':
            setFailure('used');
            return;
          case 'notFound':
            close();
            void reloadInvites();
            return;
          default:
            setFailure('failed');
            return;
        }
      }

      close();
      void reloadInvites();
    });

  return (
    <>
      <MenuTrigger>
        <Button
          variant="icon"
          aria-label={t('actions', { title: invite.title })}
        >
          <Ellipsis className="h-5 w-5" aria-hidden />
        </Button>
        <Popover placement="bottom end" className="min-w-40">
          <Menu aria-label={t('actions', { title: invite.title })}>
            <MenuItem
              id="revoke"
              textValue={t('revoke')}
              onAction={() => setConfirming(true)}
            >
              <Ban className="h-4 w-4 text-destructive" aria-hidden />
              {t('revoke')}
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
          confirmLabel={t('revoke')}
          onConfirm={revoke}
          isPending={isPending}
          isConfirmDisabled={failure === 'used'}
          error={failure ? t(`errors.${failure}`) : undefined}
        >
          {t('confirmText', { title: invite.title })}
        </ConfirmDialog>
      </Modal>
    </>
  );
}
