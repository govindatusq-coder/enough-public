import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(req:NextRequest){
 let response=NextResponse.next({request:req});
 // Without a Supabase project configured (local development harness) there is no session to refresh.
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){response.headers.set('Cache-Control','private, no-store');return response;}
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
  cookies:{getAll:()=>req.cookies.getAll(),setAll:(values,headers)=>{
   values.forEach(({name,value})=>req.cookies.set(name,value));response=NextResponse.next({request:req});
   values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v));
  }}
 });
 await db.auth.getClaims();
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
// Reckon's API (/api/reckon/*) is stateless and needs no Supabase session; keep it outside this proxy.
export const config={matcher:['/api/((?!reckon/).*)','/auth/:path*','/signin','/bear','/bear/:path*']};
