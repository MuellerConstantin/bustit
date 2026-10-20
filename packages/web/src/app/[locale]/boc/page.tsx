import { redirect } from '@/i18n/navigation';
import { currentLocale } from '@/i18n/locale';

export default async function BocPage() {
  redirect({ href: '/boc/users', locale: await currentLocale() });
}
