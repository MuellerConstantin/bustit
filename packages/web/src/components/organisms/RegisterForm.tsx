'use client';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@bustit/shared';
import { useFormik } from 'formik';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';
import { registerAction } from '@/actions/auth';
import { Button } from '@/components/atoms/Button';
import { Form } from '@/components/atoms/Form';
import { TextField } from '@/components/atoms/TextField';
import { useRouter } from '@/i18n/navigation';
import { textFieldProps, zodValidate } from '@/lib/formik';

interface RegisterFormValues {
  inviteCode: string;
  username: string;
  password: string;
  passwordConfirmation: string;
}

/** Why the last submit failed; kept in Formik's `status`. */
type RegisterFailure = 'invalidInvite' | 'usernameTaken' | 'unavailable';

export function RegisterForm() {
  const t = useTranslations('components.registerForm');
  const router = useRouter();
  const tValidation = useTranslations('validation');
  const usernameRule = tValidation('rules.username');
  const passwordRule = tValidation('rules.password', {
    min: PASSWORD_MIN_LENGTH,
  });

  /*
   * Applies the server's rules from @bustit/shared with messages for people.
   * The invite code is only checked for presence; whether it is valid only
   * the server can tell.
   */
  const schema = useMemo(
    () =>
      z
        .object({
          inviteCode: z.string().trim().min(1, t('errors.inviteCodeRequired')),
          username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(USERNAME_PATTERN, usernameRule),
          password: z
            .string()
            .min(PASSWORD_MIN_LENGTH, passwordRule)
            .max(
              PASSWORD_MAX_LENGTH,
              tValidation('errors.tooLong', { max: PASSWORD_MAX_LENGTH }),
            ),
          passwordConfirmation: z.string(),
        })
        .refine((values) => values.password === values.passwordConfirmation, {
          path: ['passwordConfirmation'],
          message: tValidation('errors.passwordsDiffer'),
        }),
    [t, tValidation, usernameRule, passwordRule],
  );

  const formik = useFormik<RegisterFormValues>({
    initialValues: {
      inviteCode: '',
      username: '',
      password: '',
      passwordConfirmation: '',
    },
    validate: zodValidate(schema),
    onSubmit: async (values, { setStatus }) => {
      setStatus(undefined);

      let result;

      try {
        result = await registerAction({
          inviteCode: values.inviteCode,
          username: values.username,
          password: values.password,
        });
      } catch {
        // The server has logged the cause; users only learn to try later.
        setStatus('unavailable' satisfies RegisterFailure);
        return;
      }

      if ('error' in result) {
        // The form applies the server's rules, so it only refuses tampered input.
        setStatus(
          (result.error === 'invalid'
            ? 'unavailable'
            : result.error) satisfies RegisterFailure,
        );
        return;
      }

      router.replace('/');
    },
  });

  const failure = formik.status as RegisterFailure | undefined;

  return (
    <Form onSubmit={formik.handleSubmit} validationBehavior="aria">
      <TextField
        {...textFieldProps(formik, 'inviteCode')}
        label={t('inviteCode')}
        placeholder={t('inviteCodePlaceholder')}
        autoComplete="off"
        isRequired
      />
      <TextField
        {...textFieldProps(formik, 'username')}
        label={t('username')}
        description={usernameRule}
        autoComplete="username"
        isRequired
      />
      <TextField
        {...textFieldProps(formik, 'password')}
        label={t('password')}
        description={passwordRule}
        type="password"
        autoComplete="new-password"
        isRequired
      />
      <TextField
        {...textFieldProps(formik, 'passwordConfirmation')}
        label={t('passwordConfirmation')}
        type="password"
        autoComplete="new-password"
        isRequired
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${failure}`)}
        </p>
      )}
      <Button
        type="submit"
        className="mt-2 h-11 w-full font-semibold"
        isPending={formik.isSubmitting}
      >
        {t('submit')}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </Form>
  );
}
