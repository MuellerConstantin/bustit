'use client';

import { HttpStatusCode, isAxiosError } from 'axios';
import type { Locale } from 'next-intl';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { RouterProvider } from 'react-aria-components';
import { SWRConfig } from 'swr';
import { getPathname, useRouter } from '@/i18n/navigation';

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>['push']>[1]
    >;
  }
}

/**
 * React Aria formats for the page's locale, and its links and buttons with an
 * `href` navigate through the locale-aware Next.js router. `useHref` puts the
 * locale into the rendered `href` as well, so opening a link in a new tab
 * keeps the language. A 401 from the web app's API means the session has
 * ended, so any data request that gets one sends the user to the login.
 */
export function Providers({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <I18nProvider locale={locale}>
      <RouterProvider
        navigate={(href, options) => router.push(href, options)}
        useHref={(href) => getPathname({ href, locale })}
      >
        <SWRConfig
          value={{
            onError: (error) => {
              if (
                isAxiosError(error) &&
                error.response?.status === HttpStatusCode.Unauthorized
              ) {
                router.replace('/login');
              }
            },
          }}
        >
          {children}
        </SWRConfig>
      </RouterProvider>
    </I18nProvider>
  );
}
