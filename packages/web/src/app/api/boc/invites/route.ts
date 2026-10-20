import { listInvites } from '@/lib/server/api';
import { respondOnBehalf } from '@/lib/server/bff';

export function GET() {
  return respondOnBehalf(listInvites);
}
