import type { FormikErrors, FormikProps } from 'formik';
import type { z } from 'zod';

/**
 * Turns a Zod schema into a Formik `validate` function. Each field gets the
 * first message the schema reports for it.
 */
export function zodValidate<TValues>(schema: z.ZodType) {
  return (values: TValues): FormikErrors<TValues> => {
    const result = schema.safeParse(values);

    if (result.success) {
      return {};
    }

    const errors: Record<string, string> = {};

    for (const issue of result.error.issues) {
      const field = issue.path.join('.');
      errors[field] ??= issue.message;
    }

    return errors as FormikErrors<TValues>;
  };
}

/**
 * Connects a `TextField` to a Formik field. Errors only show once the field
 * was left or the form was submitted, so users aren't told off while typing.
 */
export function textFieldProps<TValues>(
  formik: FormikProps<TValues>,
  name: keyof TValues & string,
) {
  const error =
    formik.touched[name] && typeof formik.errors[name] === 'string'
      ? formik.errors[name]
      : undefined;

  return {
    name,
    value: String(formik.values[name] ?? ''),
    onChange: (value: string) => void formik.setFieldValue(name, value),
    onBlur: () => void formik.setFieldTouched(name, true),
    isInvalid: error !== undefined,
    errorMessage: error,
  };
}

/**
 * Connects a `NumberField` to a Formik field, like `textFieldProps`. An empty
 * field holds `NaN`, which the form's schema has to reject.
 */
export function numberFieldProps<TValues>(
  formik: FormikProps<TValues>,
  name: keyof TValues & string,
) {
  const error =
    formik.touched[name] && typeof formik.errors[name] === 'string'
      ? formik.errors[name]
      : undefined;

  return {
    name,
    value: Number(formik.values[name]),
    onChange: (value: number) => void formik.setFieldValue(name, value),
    onBlur: () => void formik.setFieldTouched(name, true),
    isInvalid: error !== undefined,
    errorMessage: error,
  };
}
