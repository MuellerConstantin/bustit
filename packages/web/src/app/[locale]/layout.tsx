import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import localFont from 'next/font/local';
import { currentLocale } from '@/i18n/locale';
import { routing } from '@/i18n/routing';
import { Providers } from '../providers';

import '../globals.css';

/*
 * Fonts are committed to the repository with their licenses, so pages never
 * load anything from Google Fonts.
 */
const geistSans = localFont({
  src: '../fonts/geist/Geist-Variable.ttf',
  variable: '--font-geist-sans',
});

const geistMono = localFont({
  src: '../fonts/geist-mono/GeistMono-Variable.ttf',
  variable: '--font-geist-mono',
});

const bebasNeue = localFont({
  src: '../fonts/bebas-neue/BebasNeue-Regular.ttf',
  variable: '--font-bebas-neue',
});

/*
 * Pages set only their own title; the template appends the name. There is no
 * description, and search engines are asked to stay away.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo');

  return {
    title: { default: t('title'), template: `%s | ${t('title')}` },
    robots: { index: false, follow: false },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** The root layout; it sits below `[locale]` so the locale is a root param. */
export default async function LocaleLayout({
  children,
}: LayoutProps<'/[locale]'>) {
  const locale = await currentLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <Providers locale={locale}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
