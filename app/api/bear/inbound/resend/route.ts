import {providerFromEnv} from '@/lib/bear/ai/provider';
import {processInbound} from '@/lib/bear/inbound/process';
import {inboundServices} from '@/lib/bear/server/inbound';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Resend email.received webhook. The raw body is verified (Svix signature) before anything else.
// Responses say as little as possible; nothing about the message is logged.
export async function POST(req:Request){
 const s=inboundServices();if(!s)return new Response(null,{status:404});
 const raw=await req.text();
 const r=await processInbound(raw,req.headers,{secret:s.config.secret,domain:s.config.domain,registry:s.registry,mail:s.mail,storeFor:s.storeFor,ai:providerFromEnv()});
 return Response.json({ok:r.status<300},{status:r.status,headers:{'Cache-Control':'no-store'}});
}
