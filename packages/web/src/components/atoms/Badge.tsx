import { tv } from 'tailwind-variants';

interface BadgeProps {
  /** @default 'neutral' */
  variant?: 'neutral' | 'primary' | 'destructive';
  children: React.ReactNode;
  className?: string;
}

const badge = tv({
  base: 'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  variants: {
    variant: {
      neutral: 'border-border text-muted-foreground',
      primary: 'border-primary/40 bg-primary/15 text-foreground',
      destructive: 'border-destructive/40 bg-destructive/15 text-foreground',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

export function Badge({ variant, children, className }: BadgeProps) {
  return <span className={badge({ variant, className })}>{children}</span>;
}
