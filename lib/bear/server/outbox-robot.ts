import 'server-only';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {outboxIdentity,serverSecret,uuidFor} from '@/lib/bear/push-keys';
import type {Outbox} from '@/lib/bear/services/outbox';
// The delivery account: an ordinary Load Bear sign-in that belongs to the server itself. Its rows hold each person's
// delivery outbox, protected by the same row-level rules as everyone's data (only this account can read them). Its password
// is derived from a secret only the server holds. This is how reminders are sent while people are away without the
// database's master key.
const TABLE='bear_push_subscriptions';
const host=()=>process.env.VERCEL_PROJECT_PRODUCTION_URL||'load-bear.app';
let cached:{db:SupabaseClient;userId:string;until:number}|null=null;
export type RobotState='ready'|'no_secret'|'no_database'|'sign_in_failed';
let lastState:RobotState='ready';
export const robotState=()=>lastState;
export async function robot():Promise<{db:SupabaseClient;userId:string;secret:string}|null>{
 const secret=serverSecret();if(!secret){lastState='no_secret';return null;}
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key){lastState='no_database';return null;}
 if(cached&&cached.until>Date.now())return {db:cached.db,userId:cached.userId,secret};
 const id=outboxIdentity(secret,host());const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let r=await db.auth.signInWithPassword(id);
 if(r.error||!r.data.session){const s=await db.auth.signUp({...id,options:{data:{name:'Load Bear delivery'}}});if(!s.error&&!s.data.session)r=await db.auth.signInWithPassword(id);else if(!s.error&&s.data.session)r={data:{user:s.data.user!,session:s.data.session},error:null} as typeof r;}
 if(r.error||!r.data.session||!r.data.user){lastState='sign_in_failed';return null;}
 lastState='ready';cached={db,userId:r.data.user.id,until:Date.now()+Math.max(60,(r.data.session.expires_in||3600)-300)*1000};
 return {db,userId:cached.userId,secret};
}
const boxEndpoint=(userId:string)=>'outbox:'+userId;
export async function loadOutbox(userId:string):Promise<Outbox|null>{const r=await robot();if(!r)return null;const {data}=await r.db.from(TABLE).select('body').eq('user_id',r.userId).eq('endpoint',boxEndpoint(userId)).maybeSingle();return (data?.body as Outbox)||null;}
export async function saveOutbox(box:Outbox){const r=await robot();if(!r)return false;const now=new Date().toISOString();
 const {error}=await r.db.from(TABLE).upsert({id:uuidFor(r.secret,'box:'+box.userId),user_id:r.userId,endpoint:boxEndpoint(box.userId),body:box,updated_at:now},{onConflict:'id'});return !error;}
export async function removeOutbox(userId:string){const r=await robot();if(!r)return;await r.db.from(TABLE).delete().eq('user_id',r.userId).eq('endpoint',boxEndpoint(userId));}
export async function allOutboxes():Promise<Outbox[]|null>{const r=await robot();if(!r)return null;const {data,error}=await r.db.from(TABLE).select('body').eq('user_id',r.userId).like('endpoint','outbox:%').limit(2000);if(error)return null;return (data||[]).map(d=>d.body as Outbox);}
// One run per window, across every server instance: the first insert wins, the rest see the duplicate and stop.
export async function claimWindow(windowKey:string):Promise<'claimed'|'taken'|'unavailable'>{const r=await robot();if(!r)return 'unavailable';
 const {error}=await r.db.from(TABLE).insert({id:uuidFor(r.secret,'lock:'+windowKey),user_id:r.userId,endpoint:'lock:'+windowKey,body:{at:new Date().toISOString()}});
 if(!error){await r.db.from(TABLE).delete().eq('user_id',r.userId).like('endpoint','lock:%').lt('created_at',new Date(Date.now()-48*3600000).toISOString());return 'claimed';}
 return error.code==='23505'?'taken':'unavailable';}
