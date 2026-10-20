'use client';

import {
  Popover as RACPopover,
  type PopoverProps,
} from 'react-aria-components/Popover';
import { composeTailwindRenderProps } from './utils';

export function Popover(props: PopoverProps) {
  return (
    <RACPopover
      offset={8}
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-0 forced-colors:bg-[Canvas]',
      )}
    />
  );
}
