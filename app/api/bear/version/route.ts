export const dynamic='force-dynamic';
// The build stamp is baked in at build time, so a client bundle from an older deploy
// sees a different value here and can offer to refresh.
export function GET(){return Response.json({build:process.env.NEXT_PUBLIC_BEAR_BUILD||'dev'},{headers:{'Cache-Control':'no-store'}});}
