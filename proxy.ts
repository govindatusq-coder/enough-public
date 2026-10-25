import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(req:NextRequest){
 let response=NextResponse.next({request:req});
 // Refreshing the session is best-effort: if Supabase is unreachable or not configured,
 // let the route answer with its own JSON error instead of crashing every API call.
 try{
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>req.cookies.getAll(),setAll:(values,headers)=>{
   values.forEach(({name,value})=>req.cookies.set(name,value));response=NextResponse.next({request:req});
   values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v));
  }}
 });
 await db.auth.getClaims();
 }catch{response=NextResponse.next({request:req});}
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/api/:path*','/auth/:path*','/signin']};
