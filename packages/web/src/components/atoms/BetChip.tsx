'use client';

import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from 'react-aria-components/Button';
import { tv } from 'tailwind-variants';
import { focusRing } from './utils';

export const BET_CHIP_TONES = [
  'green',
  'red',
  'blue',
  'black',
  'purple',
] as const;

export type BetChipTone = (typeof BET_CHIP_TONES)[number];

/** The tone of the chip at a position, running through the tones again after the last. */
export function chipTone(index: number): BetChipTone {
  // The modulo keeps the index inside the list, which the compiler can't see.
  return BET_CHIP_TONES[index % BET_CHIP_TONES.length] ?? 'green';
}

interface BetChipProps extends Omit<RACButtonProps, 'children'> {
  /** The amount the chip stands for, shown on its face. */
  label: string;
  tone: BetChipTone;
}

/* The rim is the logo's green chip, so the other tones turn its hue. */
const rim = tv({
  base: 'absolute inset-0 bg-[url(/images/avatar-chip.svg)] bg-contain bg-center bg-no-repeat',
  variants: {
    tone: {
      green: '',
      red: '[filter:hue-rotate(-130deg)_saturate(1.4)]',
      blue: '[filter:hue-rotate(80deg)]',
      black: '[filter:grayscale(1)_brightness(0.55)]',
      purple: '[filter:hue-rotate(150deg)_saturate(1.2)]',
    },
  },
});

const chip = tv({
  extend: focusRing,
  base: 'relative grid size-14 shrink-0 cursor-pointer place-items-center rounded-full transition [-webkit-tap-highlight-color:transparent] hover:-translate-y-0.5 pressed:translate-y-0 pressed:scale-95',
  variants: {
    isDisabled: {
      true: 'cursor-default opacity-40 hover:translate-y-0',
    },
  },
});

/** A chip of a bet picker. The amount has to be spoken by the button's `aria-label`. */
export function BetChip({ label, tone, className, ...props }: BetChipProps) {
  return (
    <RACButton
      {...props}
      className={(renderProps) =>
        chip({
          isDisabled: renderProps.isDisabled,
          className: typeof className === 'string' ? className : undefined,
        })
      }
    >
      <span aria-hidden className={rim({ tone })} />
      <span
        aria-hidden
        className="relative flex size-[70%] items-center justify-center rounded-full bg-background/90 text-xs font-semibold tabular-nums"
      >
        {label}
      </span>
    </RACButton>
  );
}
