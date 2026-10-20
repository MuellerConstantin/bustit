'use client';

import {
  ModalOverlay,
  type ModalOverlayProps,
  Modal as RACModal,
} from 'react-aria-components/Modal';

/** A window above the page that keeps focus inside until it is closed. */
export function Modal(props: ModalOverlayProps) {
  return (
    <ModalOverlay
      {...props}
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center bg-black/60 p-4 text-center backdrop-blur-sm"
    >
      <RACModal className="w-full max-w-md rounded-2xl border border-border bg-popover text-left text-popover-foreground shadow-2xl forced-colors:bg-[Canvas]">
        {props.children}
      </RACModal>
    </ModalOverlay>
  );
}
