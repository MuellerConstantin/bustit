import { HttpStatusCode } from 'axios';
import { z } from 'zod';
import { getTable } from '@/lib/server/api';
import { callOnBehalf } from '@/lib/server/bff';

export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/tables/[id]'>,
) {
  const id = z.uuid().safeParse((await params).id);

  if (!id.success) {
    return new Response(null, { status: HttpStatusCode.BadRequest });
  }

  const result = await callOnBehalf((accessToken) =>
    getTable(accessToken, id.data),
  );

  if (!result.success) {
    return new Response(null, {
      status:
        result.error === 'unauthorized'
          ? HttpStatusCode.Unauthorized
          : HttpStatusCode.Forbidden,
    });
  }

  if (!result.data) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  return Response.json(result.data);
}
