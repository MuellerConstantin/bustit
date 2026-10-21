import { tv } from 'tailwind-variants';

interface BillProps {
  /** @default 'sm' */
  size?: 'sm' | 'lg';
  className?: string;
}

// The small bill is sized in em, so it follows the text next to it.
const bill = tv({
  base: 'inline-block aspect-8/5 shrink-0 bg-[url(/images/bill.svg)] bg-contain bg-center bg-no-repeat',
  variants: {
    size: {
      sm: 'h-[1em]',
      lg: 'w-32',
    },
  },
  defaultVariants: {
    size: 'sm',
  },
});

/** The bill of the play currency. Decorative: the amount has to be given next to it. */
export function Bill({ size, className }: BillProps) {
  return <span aria-hidden className={bill({ size, className })} />;
}
