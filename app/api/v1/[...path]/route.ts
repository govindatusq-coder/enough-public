import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {handle,RateLimiter} from '@/lib/bear/enterprise/api';
import {SupabaseTenantRegistry} from '@/lib/bear/enterprise/supabase-registry';
import {SupabaseStore} from '@/lib/bear/store/supabase';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Enterprise API v1. Off unless BEAR_ENTERPRISE_API_ENABLED=on and the service-role key is configured.
const limiter=new RateLimiter(Number(process.env.BEAR_API_RATE_LIMIT||120),60_000);
async function serve(req:Request,{params}:{params:Promise<{path:string[]}>}){
 if(process.env.BEAR_ENTERPRISE_API_ENABLED!=='on'||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.NEXT_PUBLIC_SUPABASE_URL)return new Response(null,{status:404});
 const {path}=await params;const raw=req.method==='GET'||req.method==='DELETE'?'':await req.text();
 if(raw.length>64*1024)return Response.json({error:{code:'too_large',message:'Request too large.'}},{status:413});
 let body:unknown=null;if(raw){try{body=JSON.parse(raw);}catch{return Response.json({error:{code:'invalid_json',message:'Body must be JSON.'}},{status:400});}}
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const headers:Record<string,string>={};req.headers.forEach((v,k)=>{headers[k.toLowerCase()]=v;});
 const r=await handle({method:req.method,path:`/api/v1/${path.join('/')}`,headers,body},{registry:new SupabaseTenantRegistry(admin),storeFor:u=>new SupabaseStore(u,admin),rateLimit:limiter});
 return Response.json(r.body,{status:r.status,headers:{...r.headers,'Cache-Control':'no-store'}});
}
export const GET=serve;export const POST=serve;export const DELETE=serve;
