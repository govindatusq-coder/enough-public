export const dynamic='force-dynamic';
// The build stamp is baked in at build time, so a client bundle from an older deploy
// sees a different value here and can offer to refresh.
// liveHost is the project's production address, so a copy opened from an older deployment link or
// a preview link can tell the person they are not on the live app.
export function GET(){return Response.json({build:process.env.NEXT_PUBLIC_BEAR_BUILD||'dev',liveHost:process.env.VERCEL_PROJECT_PRODUCTION_URL||null},{headers:{'Cache-Control':'no-store'}});}
