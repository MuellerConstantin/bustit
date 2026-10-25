'use client';

import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from 'react-aria-components/Button';
import { composeRenderProps } from 'react-aria-components/composeRenderProps';
import { tv } from 'tailwind-variants';
import { focusRing } from './utils';

export interface ButtonProps extends RACButtonProps {
  /** @default 'primary' */
  variant?:
    | 'primary'
    | 'secondary'
    | 'destructive'
    | 'icon'
    | 'table'
    | 'table-primary';
}

const button = tv({
  extend: focusRing,
  base: 'relative inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent px-3.5 text-center text-sm font-medium transition [-webkit-tap-highlight-color:transparent]',
  variants: {
    variant: {
      primary:
        'bg-primary text-primary-foreground hover:bg-primary/90 pressed:bg-primary/80',
      secondary:
        'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 pressed:bg-secondary/60',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 pressed:bg-destructive/80',
      icon: 'h-fit w-fit rounded-md border-none bg-transparent p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground pressed:bg-accent/80',
      /* The buttons of the table: dark wood, and felt for the main move. */
      table:
        'table-button h-12 rounded-xl px-5 font-display text-xl tracking-wider text-foreground hover:brightness-125 pressed:translate-y-px pressed:brightness-90',
      'table-primary':
        'table-button table-button-felt h-12 rounded-xl px-5 font-display text-xl tracking-wider text-foreground hover:brightness-125 pressed:translate-y-px pressed:brightness-90',
    },
    isDisabled: {
      true: 'cursor-default bg-muted text-muted-foreground forced-colors:text-[GrayText]',
    },
    isPending: {
      true: 'cursor-default text-transparent',
    },
  },
  compoundVariants: [
    {
      variant: 'icon',
      isDisabled: true,
      class: 'bg-transparent',
    },
    {
      variant: ['table', 'table-primary'],
      isDisabled: true,
      class: 'opacity-50 saturate-50 hover:brightness-100',
    },
  ],
  defaultVariants: {
    variant: 'primary',
  },
});

export function Button(props: ButtonProps) {
  return (
    <RACButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        button({ ...renderProps, variant: props.variant, className }),
      )}
    >
      {composeRenderProps(props.children, (children, { isPending }) => (
        <>
          {children}
          {isPending && (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 animate-spin text-current"
                stroke="currentColor"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="4"
                  fill="none"
                  className="opacity-25"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                  pathLength="100"
                  strokeDasharray="60 140"
                />
              </svg>
            </span>
          )}
        </>
      ))}
    </RACButton>
  );
}
