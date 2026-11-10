import 'server-only';
import {calendarConfig} from '@/lib/bear/calendar/config';
export const calendarDeps=()=>({cfg:calendarConfig(),f:fetch as typeof fetch,env:process.env as Record<string,string|undefined>});
// The public address people reach Bear at (behind Vercel's proxy), for the sign-in return link.
export function publicOrigin(req:Request){const u=new URL(req.url);const host=req.headers.get('x-forwarded-host')||u.host;const proto=req.headers.get('x-forwarded-proto')||u.protocol.replace(':','');
 return `${/^(localhost|127\.)/.test(host)?proto:'https'}://${host}`;}
