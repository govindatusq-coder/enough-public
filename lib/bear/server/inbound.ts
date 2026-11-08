import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {flags} from '@/lib/bear/flags';
import {SupabaseInboundRegistry} from '@/lib/bear/inbound/registry';
import {ResendInbound} from '@/lib/bear/inbound/resend';
import {SupabaseStore} from '@/lib/bear/store/supabase';

// Forward-to-Bear wiring. Everything is OFF unless BEAR_INBOUND_EMAIL_ENABLED=on AND all of these
// are configured: BEAR_INBOUND_DOMAIN (the receiving domain), BEAR_INBOUND_SECRET (the webhook signing
// secret), RESEND_API_KEY (to fetch the message body and attachments), SUPABASE_SERVICE_ROLE_KEY.
export function inboundConfig(){
 const domain=process.env.BEAR_INBOUND_DOMAIN,secret=process.env.BEAR_INBOUND_SECRET,apiKey=process.env.RESEND_API_KEY,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const ready=flags.inboundEmail()&&!!domain&&!!secret&&!!apiKey&&!!serviceKey&&!!url;
 return {ready,domain,secret,apiKey,serviceKey,url};
}
export const hashKey=(s:string)=>createHash('sha256').update(s).digest('hex');
export function inboundServices(){
 const c=inboundConfig();if(!c.ready)return null;
 const admin=createClient(c.url!,c.serviceKey!,{auth:{persistSession:false}});
 return {config:c,admin,registry:new SupabaseInboundRegistry(admin,hashKey),mail:new ResendInbound(c.apiKey!),storeFor:(userId:string)=>new SupabaseStore(userId,admin)};
}
