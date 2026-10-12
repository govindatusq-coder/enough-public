import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {createScriptNonce,contentSecurityPolicy,securityHeaders} from './lib/security-headers.ts';
export async function proxy(req:NextRequest){
 const options={nonce:createScriptNonce(),supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,development:process.env.NODE_ENV==='development'};
 const headers=new Headers(req.headers);
 // Replace caller-supplied values before Next renders its authorised scripts.
 headers.set('x-nonce',options.nonce);
 headers.set('Content-Security-Policy',contentSecurityPolicy(options));
 const forward=()=>{
  const cookie=req.headers.get('cookie');
  if(cookie)headers.set('cookie',cookie);else headers.delete('cookie');
  return NextResponse.next({request:{headers}});
 };
 let response=forward();
 // Keep the original session-refresh routes. Public page rendering needs the
 // nonce, but does not need an extra Supabase call.
 if(req.nextUrl.pathname.startsWith('/api/')||req.nextUrl.pathname.startsWith('/auth/')||req.nextUrl.pathname==='/signin'){
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>req.cookies.getAll(),setAll:(values,headers)=>{
   values.forEach(({name,value})=>req.cookies.set(name,value));response=forward();
   values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v));
  }}
 });
 await db.auth.getClaims();
 }
 for(const {key,value} of securityHeaders(options))response.headers.set(key,value);
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|images/|favicon\\.ico|favicon\\.svg|icon-32\\.png|apple-touch-icon\\.png).*)']};
