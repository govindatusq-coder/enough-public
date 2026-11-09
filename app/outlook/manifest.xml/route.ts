import {createHash} from 'node:crypto';
import {outlookManifest} from '@/lib/bear/outlook/item';
// One stable add-in id per deployment host, so the preview and the live app can be installed side by side.
function idFor(host:string){const h=createHash('sha256').update('load-bear-outlook:'+host).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${(8+parseInt(h[16],16)%4).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;}
export const dynamic='force-dynamic';
// The Outlook add-in manifest for whichever deployment serves it (preview or production).
// Download it from /outlook/manifest.xml and add it in Outlook: Get Add-ins → My add-ins → Add a custom add-in.
export function GET(req:Request){
 const url=new URL(req.url);const host=req.headers.get('x-forwarded-host')||url.host;const proto=req.headers.get('x-forwarded-proto')||url.protocol.replace(':','');
 const origin=`${host.startsWith('localhost')||host.startsWith('127.')?proto:'https'}://${host}`;
 return new Response(outlookManifest(origin,{id:process.env.BEAR_OUTLOOK_ADDIN_ID||idFor(host),preview:process.env.VERCEL_ENV==='preview'}),{headers:{'Content-Type':'application/xml; charset=utf-8','Content-Disposition':'inline; filename="load-bear-outlook.xml"','Cache-Control':'no-store'}});
}
