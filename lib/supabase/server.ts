import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function serverClient(){
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>jar.getAll(),setAll:(values)=>{values.forEach(({name,value,options})=>jar.set(name,value,options))}}
 });
}
export async function signedIn(){
 const db=await serverClient();
 const {data,error}=await db.auth.getUser();
 if(error||!data.user||data.user.is_anonymous)return {db,user:null};
 return {db,user:data.user};
}
