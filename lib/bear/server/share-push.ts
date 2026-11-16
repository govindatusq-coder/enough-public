import 'server-only';
import {inQuietHours} from '@/lib/bear/board/logic';
import {noticeFor,type Share} from '@/lib/bear/board/shares';
import {loadOutbox} from './outbox-robot';
import {pushConfig,sendPush} from './push';

// Tell the person who shared something that the other person answered (or finished it), straight away, by push.
// Their push subscriptions are read from their delivery outbox (the same one reminders use), so no master key is needed.
// Nothing is sent during their quiet hours, if they turned notifications off, or if push isn't set up: they see it in the
// app instead (home notice and the Shared screen). Returns what happened so callers never claim more than was done.
export type SharePushResult='sent'|'quiet'|'off'|'no_device'|'failed'|'nothing';
export async function pushToSender(share:Share,now=new Date()):Promise<SharePushResult>{
 const text=noticeFor(share);if(!text)return 'nothing';
 if(!pushConfig())return 'off';
 const box=await loadOutbox(share.senderId).catch(()=>null);
 if(!box||!box.subs?.length)return 'no_device';
 if(!box.profile?.notification?.pushEnabled)return 'off';
 if(inQuietHours(box.profile.notification,now,box.profile.lifeRhythm?.timezone||'Australia/Sydney'))return 'quiet';
 let sent=0;
 for(const sub of box.subs){if((await sendPush(sub,{title:'Load Bear',body:text,url:'/bear/shared',tag:`share-${share.id}`}).catch(()=>'failed'))==='sent')sent++;}
 return sent?'sent':'failed';
}
