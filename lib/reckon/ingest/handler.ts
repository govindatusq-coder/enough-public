/**
 * Request handler for /api/reckon/ingest, kept outside app/ so it can be unit-tested.
 * It always answers JSON: a failed IngestionRecord is a valid, honest answer.
 */
import {detectSource} from '../platform.ts';
import {failedRecord} from '../model.ts';
import {retrieveSource} from './retrieve.ts';

const noStore = {headers: {'Cache-Control': 'no-store'}};

export async function handleIngest(req: Request): Promise<Response> {
  let body: {url?: string};
  try { body = await req.json(); } catch { return Response.json({error: 'Invalid JSON'}, {status: 400}); }
  const detected = typeof body.url === 'string' ? detectSource(body.url) : null;
  if (!detected) return Response.json({error: 'That does not look like a link Reckon can open.'}, {status: 400});
  try {
    const result = await retrieveSource(detected);
    return Response.json({detected, ...result}, noStore);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[reckon ingest]', message);
    return Response.json({detected, content: {embedUrl: detected.embedUrl}, record: failedRecord(message)}, noStore);
  }
}
