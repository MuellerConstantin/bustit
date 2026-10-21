'use client';

import { Search, X } from 'lucide-react';
import {
  SearchField as RACSearchField,
  type SearchFieldProps as RACSearchFieldProps,
} from 'react-aria-components/SearchField';
import { Button } from './Button';
import { Input, Label } from './Field';
import { composeTailwindRenderProps } from './utils';

export interface SearchFieldProps extends RACSearchFieldProps {
  label?: string;
  placeholder?: string;
  /** Names the button that empties the field. */
  clearLabel: string;
}

/** A text field for searching, which Escape or its button empties. */
export function SearchField({
  label,
  placeholder,
  clearLabel,
  ...props
}: SearchFieldProps) {
  return (
    <RACSearchField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
      )}
    >
      {label && <Label>{label}</Label>}
      <div className="flex min-h-9 items-center rounded-lg border border-input bg-card transition focus-within:border-foreground hover:border-ring focus-within:hover:border-foreground">
        <Search
          aria-hidden
          className="ml-3 h-4 w-4 shrink-0 text-muted-foreground"
        />
        {/* The browser's own clear button would duplicate the one below. */}
        <Input
          placeholder={placeholder}
          className="[&::-webkit-search-cancel-button]:hidden"
        />
        <Button
          variant="icon"
          aria-label={clearLabel}
          className="mr-1 group-empty:invisible"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </RACSearchField>
  );
}
