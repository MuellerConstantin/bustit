import { pageQuerySchema } from '@bustit/shared';
import { HttpStatusCode } from 'axios';
import type { NextRequest } from 'next/server';
import { listUsers } from '@/lib/server/api';
import { respondOnBehalf } from '@/lib/server/bff';

export function GET(request: NextRequest) {
  const query = pageQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return new Response(null, { status: HttpStatusCode.BadRequest });
  }

  return respondOnBehalf((accessToken) => listUsers(accessToken, query.data));
}
