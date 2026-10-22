'use client';

import {
  TABLE_MAX_SEATS,
  TABLE_MIN_SEATS,
  TABLE_NAME_MAX_LENGTH,
} from '@bustit/shared';
import { useFormik } from 'formik';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';
import { createTableAction } from '@/actions/tables';
import { Button } from '@/components/atoms/Button';
import { Form } from '@/components/atoms/Form';
import { NumberField } from '@/components/atoms/NumberField';
import { TextField } from '@/components/atoms/TextField';
import { useRouter } from '@/i18n/navigation';
import { numberFieldProps, textFieldProps, zodValidate } from '@/lib/formik';

interface CreateTableFormValues {
  name: string;
  seats: number;
  minBet: number;
  maxBet: number;
}

interface CreateTableFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateTableForm({ onCreated, onCancel }: CreateTableFormProps) {
  const t = useTranslations('components.createTableForm');
  const tValidation = useTranslations('validation');
  const router = useRouter();

  const schema = useMemo(() => {
    // An emptied number field holds NaN, which `z.number()` rejects as well.
    const betLimit = z
      .number({ error: t('errors.betRequired') })
      .int(t('errors.betWhole'))
      .min(1, t('errors.betTooLow'));

    return z
      .object({
        name: z
          .string()
          .trim()
          .min(1, t('errors.nameRequired'))
          .max(
            TABLE_NAME_MAX_LENGTH,
            tValidation('errors.tooLong', { max: TABLE_NAME_MAX_LENGTH }),
          ),
        seats: z
          .number({ error: t('errors.seatsRange') })
          .int(t('errors.seatsRange'))
          .min(TABLE_MIN_SEATS, t('errors.seatsRange'))
          .max(TABLE_MAX_SEATS, t('errors.seatsRange')),
        minBet: betLimit,
        maxBet: betLimit,
      })
      .refine(({ minBet, maxBet }) => minBet <= maxBet, {
        message: t('errors.maxBelowMin'),
        path: ['maxBet'],
      });
  }, [t, tValidation]);

  const formik = useFormik<CreateTableFormValues>({
    initialValues: { name: '', seats: 5, minBet: 10, maxBet: 500 },
    validate: zodValidate(schema),
    onSubmit: async (values, { setStatus, setFieldError }) => {
      setStatus(undefined);

      let result;

      try {
        result = await createTableAction(values);
      } catch {
        // The server has logged the cause; the admin only learns to try again.
        setStatus('failed');
        return;
      }

      if ('error' in result) {
        switch (result.error) {
          case 'unauthorized':
            router.replace('/login');
            return;
          case 'nameTaken':
            setFieldError('name', t('errors.nameTaken'));
            return;
          default:
            setStatus('failed');
            return;
        }
      }

      onCreated();
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit} validationBehavior="aria">
      <TextField
        {...textFieldProps(formik, 'name')}
        label={t('name')}
        description={t('nameDescription')}
        placeholder={t('namePlaceholder')}
        autoFocus
        isRequired
      />
      <NumberField
        {...numberFieldProps(formik, 'seats')}
        label={t('seats')}
        description={t('seatsDescription', {
          min: TABLE_MIN_SEATS,
          max: TABLE_MAX_SEATS,
        })}
        minValue={TABLE_MIN_SEATS}
        maxValue={TABLE_MAX_SEATS}
        isRequired
      />
      {/* Aligned to the top, so an error below one limit doesn't stretch the other. */}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <NumberField
          {...numberFieldProps(formik, 'minBet')}
          label={t('minBet')}
          minValue={1}
          isRequired
        />
        <NumberField
          {...numberFieldProps(formik, 'maxBet')}
          label={t('maxBet')}
          minValue={1}
          isRequired
        />
      </div>
      {formik.status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {t('errors.failed')}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onPress={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" isPending={formik.isSubmitting}>
          {t('submit')}
        </Button>
      </div>
    </Form>
  );
}
