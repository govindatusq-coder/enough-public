import {NextResponse} from 'next/server';
import {clientAddress,limited,shareBearDeps} from '@/lib/bear/server/sharebear';
import {DelegationError} from '@/lib/bear/sharebear/core';
import {recipientAction,recipientView} from '@/lib/bear/sharebear/service';
export const dynamic='force-dynamic';export const maxDuration=30;
// The recipient's side: no sign-in. The token in the link is the only key, and it opens this one request only. Reading
// never changes anything (link previews and scanners can open it safely); every answer is an explicit POST.
const out=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}});
export async function GET(req:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(limited('r:'+clientAddress(req),40))return out({error:'Too many tries. Wait a minute and try again.'},429);
 const deps=await shareBearDeps(req);if(!deps)return out({state:'unavailable'},503);
 return out(await recipientView(deps.rows,token));
}
export async function POST(req:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(limited('rp:'+clientAddress(req),15))return out({error:'Too many tries. Wait a minute and try again.'},429);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return out({error:'Not allowed.'},403);
 const deps=await shareBearDeps(req);if(!deps)return out({error:'Bear can’t take answers just now. Please try again soon.'},503);
 let body:unknown;try{body=await req.json();}catch{return out({error:'That didn’t come through. Please try again.'},400);}
 try{return out(await recipientAction(deps,token,body));}
 catch(e){if(e instanceof DelegationError)return out({error:e.message},e.status);if((e as {name?:string}).name==='ZodError')return out({error:'That didn’t come through. Please try again.'},400);throw e;}
}
