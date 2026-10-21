'use client';

import type { BocUser } from '@bustit/shared';
import { Ellipsis, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteUserAction } from '@/actions/users';
import { Button } from '@/components/atoms/Button';
import { Menu, MenuItem, MenuTrigger } from '@/components/atoms/Menu';
import { Modal } from '@/components/atoms/Modal';
import { Popover } from '@/components/atoms/Popover';
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog';
import { useReloadUsers } from '@/hooks/useUsers';
import { useRouter } from '@/i18n/navigation';

type Failure = 'self' | 'failed';

interface DeleteUserProps {
  user: BocUser;
}

/** The actions of a user: a menu that leads to deleting them. */
export function DeleteUser({ user }: DeleteUserProps) {
  const t = useTranslations('components.deleteUser');
  const router = useRouter();
  const reloadUsers = useReloadUsers();
  const [isConfirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setConfirming(false);
    setFailure(null);
  };

  const remove = () =>
    startTransition(async () => {
      setFailure(null);

      let result;

      try {
        result = await deleteUserAction(user.id);
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
          case 'self':
            setFailure('self');
            return;
          case 'notFound':
            close();
            void reloadUsers();
            return;
          default:
            setFailure('failed');
            return;
        }
      }

      close();
      void reloadUsers();
    });

  return (
    <>
      <MenuTrigger>
        <Button
          variant="icon"
          aria-label={t('actions', { username: user.username })}
        >
          <Ellipsis className="h-5 w-5" aria-hidden />
        </Button>
        <Popover placement="bottom end" className="min-w-40">
          <Menu aria-label={t('actions', { username: user.username })}>
            <MenuItem
              id="delete"
              textValue={t('delete')}
              onAction={() => setConfirming(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              {t('delete')}
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
          confirmLabel={t('delete')}
          onConfirm={remove}
          isPending={isPending}
          isConfirmDisabled={failure === 'self'}
          error={failure ? t(`errors.${failure}`) : undefined}
        >
          {t('confirmText', { username: user.username })}
        </ConfirmDialog>
      </Modal>
    </>
  );
}
