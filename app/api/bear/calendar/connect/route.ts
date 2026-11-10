import {HttpError,withBear} from '@/lib/bear/server/context';
import {authorizeUrl,newState,pkce} from '@/lib/bear/calendar/graph';
import {calendarDeps,publicOrigin} from '@/lib/bear/server/calendar';
export const dynamic='force-dynamic';
// Start Microsoft sign-in. The one-time state and PKCE verifier live in a short-lived, httpOnly cookie that only the
// callback can read; the client secret never reaches the browser.
export const GET=(req:Request)=>withBear(req,async()=>{
 const {cfg}=calendarDeps();if(!cfg.ready)throw new HttpError('Outlook calendar isn’t set up yet.',404);
 const {verifier,challenge}=pkce();const state=newState();const redirectUri=publicOrigin(req)+'/api/bear/calendar/callback';
 const cookie=Buffer.from(JSON.stringify({state,verifier})).toString('base64url');
 return new Response(null,{status:302,headers:{Location:authorizeUrl(cfg,{redirectUri,state,challenge}),'Cache-Control':'private, no-store',
  'Set-Cookie':`bear_ms_oauth=${cookie}; Max-Age=600; Path=/api/bear/calendar; HttpOnly; SameSite=Lax${redirectUri.startsWith('https')?'; Secure':''}`}});
});
