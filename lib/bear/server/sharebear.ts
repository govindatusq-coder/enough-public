import 'server-only';
import {inQuietHours} from '@/lib/bear/board/logic';
import {noticeText,type Delegation,type NoticeType} from '@/lib/bear/sharebear/core';
import {smsFromEnv} from '@/lib/bear/sharebear/sms';
import type {Deps} from '@/lib/bear/sharebear/service';
import {delegationRows} from './sharebear-rows';
import {loadOutbox} from './outbox-robot';
import {pushConfig,sendPush} from './push';

// Everything Share Bear needs on the server: where delegations live, the text provider, the address links point to, and
// telling her straight away (by push, outside her quiet hours) when someone answers. Push failing never changes a delegation.
export async function shareBearDeps(req:Request):Promise<Deps|null>{
 const rows=await delegationRows();if(!rows)return null;
 const origin=new URL(req.url).origin;const baseUrl=process.env.SHARE_BEAR_BASE_URL||origin;
 const sms=smsFromEnv();
 return {rows,sms,baseUrl,statusCallback:sms.mode==='twilio'&&baseUrl.startsWith('https://')?`${baseUrl}/api/bear/share-bear/sms-status`:null,notify:pushToOwner};
}
export async function pushToOwner(d:Delegation,t:NoticeType,now=new Date()):Promise<'sent'|'quiet'|'off'|'no_device'|'failed'>{
 if(!pushConfig())return 'off';
 const box=await loadOutbox(d.ownerId).catch(()=>null);if(!box||!box.subs?.length)return 'no_device';
 if(!box.profile?.notification?.pushEnabled)return 'off';
 if(inQuietHours(box.profile.notification,now,box.profile.lifeRhythm?.timezone||'Australia/Sydney'))return 'quiet';
 const n=noticeText(d,t);let sent=0;
 for(const sub of box.subs)if((await sendPush(sub,{title:`🐻 ${n.title}`,body:n.body,url:`/bear/brain/${d.taskId}`,tag:`sb-${d.id}-${t}`}).catch(()=>'failed'))==='sent')sent++;
 return sent?'sent':'failed';
}
// A simple per-address limit for the public pages (per server instance): enough for a person, too few for guessing.
const hits=new Map<string,number[]>();
export function limited(key:string,max:number,windowMs=60000){const now=Date.now();const a=(hits.get(key)||[]).filter(t=>now-t<windowMs);a.push(now);hits.set(key,a);if(hits.size>5000)hits.clear();return a.length>max;}
export const clientAddress=(req:Request)=>(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||req.headers.get('x-real-ip')||'local';
