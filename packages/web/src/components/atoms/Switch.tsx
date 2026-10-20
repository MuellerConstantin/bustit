'use client';

import {
  Switch as RACSwitch,
  type SwitchProps,
} from 'react-aria-components/Switch';
import { composeRenderProps } from 'react-aria-components/composeRenderProps';
import { tv } from 'tailwind-variants';
import { composeTailwindRenderProps, focusRing } from './utils';

const track = tv({
  extend: focusRing,
  base: 'flex h-5 w-9 shrink-0 cursor-default items-center rounded-full border border-transparent px-0.5 transition duration-200 ease-in-out',
  variants: {
    isSelected: {
      false: 'bg-secondary group-pressed:bg-secondary/80',
      true: 'bg-primary group-pressed:bg-primary/80 forced-colors:bg-[Highlight]',
    },
    isDisabled: {
      true: 'bg-muted forced-colors:bg-[GrayText]',
    },
  },
});

const handle = tv({
  base: 'h-3.5 w-3.5 rounded-full bg-foreground shadow-sm transition duration-200 ease-in-out',
  variants: {
    isSelected: {
      false: 'translate-x-0',
      true: 'translate-x-4',
    },
    isDisabled: {
      true: 'bg-muted-foreground',
    },
  },
});

export function Switch({ children, ...props }: SwitchProps) {
  return (
    <RACSwitch
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex items-center gap-2 text-sm text-foreground transition disabled:text-muted-foreground',
      )}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          <span className={track(renderProps)}>
            <span className={handle(renderProps)} />
          </span>
          {children}
        </>
      ))}
    </RACSwitch>
  );
}
