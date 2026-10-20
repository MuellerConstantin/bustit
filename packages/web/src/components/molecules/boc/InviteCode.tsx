'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';

interface InviteCodeProps {
  code: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Shows the code of a new invite with a button to copy it. The game server
 * keeps only its hash, so this is the only time the code can be seen.
 */
export function InviteCode({ code }: InviteCodeProps) {
  const t = useTranslations('components.inviteCode');
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
    <div className="flex flex-col gap-2">
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
    </div>
  );
}
