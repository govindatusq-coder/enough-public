import {aiAvailable, MODEL} from '@/lib/reckon/ai/provider';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ai: aiAvailable(), model: aiAvailable() ? MODEL : null, instagramOembed: !!process.env.INSTAGRAM_OEMBED_TOKEN, devTools: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_RECKON_DEV_TOOLS === '1', build: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7), env: process.env.VERCEL_ENV ?? process.env.NODE_ENV}, {headers: {'Cache-Control': 'no-store'}});
}
