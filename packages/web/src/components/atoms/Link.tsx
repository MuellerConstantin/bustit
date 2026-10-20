'use client';

import {
  Link as RACLink,
  type LinkProps as RACLinkProps,
} from 'react-aria-components/Link';
import { composeRenderProps } from 'react-aria-components/composeRenderProps';
import { tv } from 'tailwind-variants';
import { focusRing } from './utils';

export interface LinkProps extends RACLinkProps {
  /**
   * `nav` is an entry of a navigation list, highlighted while its page is
   * open, which the caller marks with `aria-current="page"`.
   * @default 'inline'
   */
  variant?: 'inline' | 'nav';
}

const link = tv({
  extend: focusRing,
  base: 'cursor-pointer rounded-xs transition [-webkit-tap-highlight-color:transparent]',
  variants: {
    variant: {
      inline:
        'font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary',
      nav: 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground no-underline hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground',
    },
    isDisabled: {
      true: 'cursor-default text-muted-foreground no-underline forced-colors:text-[GrayText]',
    },
  },
  defaultVariants: {
    variant: 'inline',
  },
});

export function Link({ variant, ...props }: LinkProps) {
  return (
    <RACLink
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        link({ ...renderProps, variant, className }),
      )}
    />
  );
}
