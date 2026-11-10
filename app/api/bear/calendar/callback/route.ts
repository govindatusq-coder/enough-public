import {HttpError,withBear} from '@/lib/bear/server/context';
import {completeConnection} from '@/lib/bear/calendar/service';
import {calendarDeps,publicOrigin} from '@/lib/bear/server/calendar';
export const dynamic='force-dynamic';
const back=(origin:string,status:string)=>new Response(null,{status:302,headers:{Location:`${origin}/bear/me?calendar=${status}`,'Cache-Control':'private, no-store',
 'Set-Cookie':'bear_ms_oauth=; Max-Age=0; Path=/api/bear/calendar; HttpOnly; SameSite=Lax'}});
// Microsoft sends the person back here with a one-time code. The state must match the cookie from connect (so a code
// from someone else's sign-in can't be attached to this account), and only then is the code exchanged.
export const GET=(req:Request)=>withBear(req,async({store})=>{
 const d=calendarDeps();if(!d.cfg.ready)throw new HttpError('Outlook calendar isn’t set up yet.',404);
 const url=new URL(req.url);const origin=publicOrigin(req);
 const jar=Object.fromEntries((req.headers.get('cookie')||'').split(/;\s*/).map(c=>{const i=c.indexOf('=');return [c.slice(0,i),c.slice(i+1)];}));
 let saved:{state:string;verifier:string}|null=null;try{saved=JSON.parse(Buffer.from(jar.bear_ms_oauth||'','base64url').toString());}catch{saved=null;}
 const code=url.searchParams.get('code'),state=url.searchParams.get('state');
 if(url.searchParams.get('error')||!code||!state||!saved||saved.state!==state)return back(origin,'error');
 try{await completeConnection(store,d,{code,redirectUri:origin+'/api/bear/calendar/callback',verifier:saved.verifier});}catch{return back(origin,'error');}
 return back(origin,'connected');
});
