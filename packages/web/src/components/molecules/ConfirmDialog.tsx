'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/Button';
import { Dialog, DialogHeading } from '@/components/atoms/Dialog';

interface ConfirmDialogProps {
  title: string;
  /** What confirming does and what can't be undone. */
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /** Shown above the buttons, e.g. why confirming failed. */
  error?: string;
  isPending?: boolean;
  /** Set when confirming can no longer succeed, e.g. after `error`. */
  isConfirmDisabled?: boolean;
}

/**
 * Asks before something that can't be undone. Goes into a `Modal`, which
 * the caller opens and closes.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  error,
  isPending = false,
  isConfirmDisabled = false,
}: ConfirmDialogProps) {
  const t = useTranslations('components.confirmDialog');

  return (
    <Dialog role="alertdialog">
      {({ close }) => (
        <>
          <DialogHeading>{title}</DialogHeading>
          <div className="text-sm text-muted-foreground">{children}</div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onPress={close} isDisabled={isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onPress={onConfirm}
              isPending={isPending}
              isDisabled={isConfirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
