'use client';

import { Check } from 'lucide-react';
import { composeRenderProps } from 'react-aria-components/composeRenderProps';
import {
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  type MenuItemProps,
  type MenuProps,
  Separator,
  type SeparatorProps,
} from 'react-aria-components/Menu';
import { tv } from 'tailwind-variants';
import { composeTailwindRenderProps } from './utils';

export { MenuTrigger } from 'react-aria-components/Menu';

export function Menu<T extends object>(props: MenuProps<T>) {
  return (
    <RACMenu
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'max-h-[inherit] overflow-auto p-1 outline-0',
      )}
    />
  );
}

const menuItem = tv({
  base: 'flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-popover-foreground outline-0 select-none forced-color-adjust-none [-webkit-tap-highlight-color:transparent] [&[href]]:cursor-pointer',
  variants: {
    isFocused: {
      true: 'bg-accent text-accent-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]',
    },
    isDisabled: {
      true: 'text-muted-foreground forced-colors:text-[GrayText]',
    },
    isSelected: {
      true: 'font-semibold',
    },
  },
});

export function MenuItem(props: MenuItemProps) {
  const textValue =
    props.textValue ??
    (typeof props.children === 'string' ? props.children : undefined);

  return (
    <RACMenuItem
      {...props}
      textValue={textValue}
      className={(renderProps) => menuItem(renderProps)}
    >
      {composeRenderProps(props.children, (children, { isSelected }) => (
        <>
          {children}
          {isSelected && <Check aria-hidden className="ml-auto h-4 w-4" />}
        </>
      ))}
    </RACMenuItem>
  );
}

export function MenuSeparator(props: SeparatorProps) {
  return <Separator {...props} className="mx-1 my-1 border-b border-border" />;
}
