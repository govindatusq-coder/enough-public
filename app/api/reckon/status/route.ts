import {aiAvailable, MODEL} from '@/lib/reckon/ai/provider';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ai: aiAvailable(), model: aiAvailable() ? MODEL : null, instagramOembed: !!process.env.INSTAGRAM_OEMBED_TOKEN, devTools: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_RECKON_DEV_TOOLS === '1'}, {headers: {'Cache-Control': 'no-store'}});
}
