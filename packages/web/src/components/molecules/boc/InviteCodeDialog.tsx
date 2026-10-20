'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Dialog, DialogHeading } from '@/components/atoms/Dialog';

interface InviteCodeDialogProps {
  code: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Shows the code of a new invite. The game server keeps only its hash, so
 * this is the only time the code can be seen.
 */
export function InviteCodeDialog({ code }: InviteCodeDialogProps) {
  const t = useTranslations('components.inviteCodeDialog');
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      // The clipboard needs a secure context and the user's permission.
      setCopyState('failed');
    }
  };

  return (
    <Dialog>
      {({ close }) => (
        <>
          <DialogHeading>{t('title')}</DialogHeading>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
            <code className="grow font-mono text-lg tracking-wider select-all">
              {code}
            </code>
            <Button
              variant="icon"
              aria-label={t('copy')}
              onPress={() => void copy()}
            >
              {copyState === 'copied' ? (
                <Check className="h-5 w-5 text-primary" aria-hidden />
              ) : (
                <Copy className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm">
            {copyState === 'copied' && (
              <span className="text-muted-foreground">{t('copied')}</span>
            )}
            {copyState === 'failed' && (
              <span className="text-destructive">{t('copyFailed')}</span>
            )}
          </p>
          <Button className="self-end" onPress={close}>
            {t('done')}
          </Button>
        </>
      )}
    </Dialog>
  );
}
