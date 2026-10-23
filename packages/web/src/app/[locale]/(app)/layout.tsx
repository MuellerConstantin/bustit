import type { ReactNode } from 'react';
import { RealtimeProvider } from '@/providers/RealtimeProvider';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
