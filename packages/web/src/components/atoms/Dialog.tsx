'use client';

import {
  type DialogProps,
  Heading as RACHeading,
  type HeadingProps,
  Dialog as RACDialog,
} from 'react-aria-components/Dialog';
import { twMerge } from 'tailwind-merge';

export function Dialog(props: DialogProps) {
  return (
    <RACDialog
      {...props}
      className={twMerge(
        'relative flex max-h-[inherit] flex-col gap-4 overflow-auto p-6 outline-0',
        props.className,
      )}
    />
  );
}

/** The dialog's title, which labels it for assistive technology. */
export function DialogHeading(props: HeadingProps) {
  return (
    <RACHeading
      slot="title"
      {...props}
      className={twMerge(
        'font-display text-3xl tracking-wide',
        props.className,
      )}
    />
  );
}
