import {detectSource} from '@/lib/reckon/platform';
import {retrieveSource} from '@/lib/reckon/ingest/retrieve';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: {url?: string};
  try { body = await req.json(); } catch { return Response.json({error: 'Invalid JSON'}, {status: 400}); }
  const detected = typeof body.url === 'string' ? detectSource(body.url) : null;
  if (!detected) return Response.json({error: 'That does not look like a link Reckon can open.'}, {status: 400});
  const result = await retrieveSource(detected);
  return Response.json({detected, ...result}, {headers: {'Cache-Control': 'no-store'}});
}
