import { listInvitesQuerySchema } from '@bustit/shared';
import { HttpStatusCode } from 'axios';
import type { NextRequest } from 'next/server';
import { listInvites } from '@/lib/server/api';
import { respondOnBehalf } from '@/lib/server/bff';

export function GET(request: NextRequest) {
  const query = listInvitesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return new Response(null, { status: HttpStatusCode.BadRequest });
  }

  return respondOnBehalf((accessToken) => listInvites(accessToken, query.data));
}
