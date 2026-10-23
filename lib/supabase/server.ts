import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {bearerToken} from '@/lib/public-auth';
export async function serverClient(token:string|null=null){
 if(token)return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>[],setAll:()=>{}},global:{headers:{Authorization:'Bearer '+token}}
 });
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>jar.getAll(),setAll:(values)=>{values.forEach(({name,value,options})=>jar.set(name,value,options))}}
 });
}
// A bearer token (native app) takes precedence over the browser cookie session; the token is
// verified with Supabase Auth on every request and row-level rules apply to that user only.
export async function signedIn(req?:Request){
 const token=req?bearerToken(req):null;
 const db=await serverClient(token);
 const {data,error}=token?await db.auth.getUser(token):await db.auth.getUser();
 if(error||!data.user||data.user.is_anonymous)return {db,user:null};
 return {db,user:data.user};
}
