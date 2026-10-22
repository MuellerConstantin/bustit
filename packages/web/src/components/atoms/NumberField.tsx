'use client';

import {
  NumberField as RACNumberField,
  type NumberFieldProps as RACNumberFieldProps,
  type ValidationResult,
} from 'react-aria-components/NumberField';
import { tv } from 'tailwind-variants';
import {
  Description,
  FieldError,
  Input,
  Label,
  fieldBorderStyles,
} from './Field';
import { composeTailwindRenderProps, focusRing } from './utils';

const inputStyles = tv({
  extend: focusRing,
  base: 'box-border min-h-9 rounded-lg border bg-card px-3 py-0 text-sm tabular-nums transition',
  variants: {
    isFocused: fieldBorderStyles.variants.isFocusWithin,
    isInvalid: fieldBorderStyles.variants.isInvalid,
    isDisabled: fieldBorderStyles.variants.isDisabled,
  },
});

export interface NumberFieldProps extends RACNumberFieldProps {
  label?: string;
  description?: string;
  placeholder?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

/** A field for a number, formatted for the locale while not being edited. */
export function NumberField({
  label,
  description,
  errorMessage,
  placeholder,
  ...props
}: NumberFieldProps) {
  return (
    <RACNumberField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex flex-col gap-1',
      )}
    >
      {label && <Label>{label}</Label>}
      <Input className={inputStyles} placeholder={placeholder} />
      {/* The error replaces the description, which often states the same rule. */}
      {description && !props.isInvalid && (
        <Description>{description}</Description>
      )}
      <FieldError>{errorMessage}</FieldError>
    </RACNumberField>
  );
}
