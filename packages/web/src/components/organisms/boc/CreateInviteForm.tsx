'use client';

import { INVITE_TITLE_MAX_LENGTH } from '@bustit/shared';
import { useFormik } from 'formik';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';
import { createInviteAction } from '@/actions/invites';
import { Button } from '@/components/atoms/Button';
import { Form } from '@/components/atoms/Form';
import { TextField } from '@/components/atoms/TextField';
import { useRouter } from '@/i18n/navigation';
import { textFieldProps, zodValidate } from '@/lib/formik';

interface CreateInviteFormValues {
  title: string;
}

interface CreateInviteFormProps {
  /** Gets the code of the new invite, which can't be looked up later. */
  onCreated: (code: string) => void;
  onCancel: () => void;
}

export function CreateInviteForm({
  onCreated,
  onCancel,
}: CreateInviteFormProps) {
  const t = useTranslations('components.createInviteForm');
  const tValidation = useTranslations('validation');
  const router = useRouter();

  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(1, t('errors.titleRequired'))
          .max(
            INVITE_TITLE_MAX_LENGTH,
            tValidation('errors.tooLong', { max: INVITE_TITLE_MAX_LENGTH }),
          ),
      }),
    [t, tValidation],
  );

  const formik = useFormik<CreateInviteFormValues>({
    initialValues: { title: '' },
    validate: zodValidate(schema),
    onSubmit: async (values, { setStatus }) => {
      setStatus(undefined);

      let result;

      try {
        result = await createInviteAction(values);
      } catch {
        // The server has logged the cause; the admin only learns to try again.
        setStatus('failed');
        return;
      }

      if ('error' in result) {
        if (result.error === 'unauthorized') {
          router.replace('/login');
        } else {
          setStatus('failed');
        }

        return;
      }

      onCreated(result.code);
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit} validationBehavior="aria">
      <TextField
        {...textFieldProps(formik, 'title')}
        label={t('title')}
        description={t('titleDescription')}
        placeholder={t('titlePlaceholder')}
        autoFocus
        isRequired
      />
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
