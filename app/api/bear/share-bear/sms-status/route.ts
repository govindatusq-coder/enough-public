import {NextResponse} from 'next/server';
import {shareBearDeps} from '@/lib/bear/server/sharebear';
import {twilioSignatureOk} from '@/lib/bear/sharebear/sms';
import {deliveryReport} from '@/lib/bear/sharebear/service';
export const dynamic='force-dynamic';
// Delivery reports from Twilio. Only reports signed with our Twilio auth token are believed. A report never moves a
// request backwards; a first text that couldn't be delivered tells her so.
export async function POST(req:Request){
 const token=process.env.TWILIO_AUTH_TOKEN;if(!token)return new NextResponse(null,{status:404});
 const form=await req.formData();const params:Record<string,string>={};form.forEach((v,k)=>{params[k]=String(v);});
 const base=process.env.SHARE_BEAR_BASE_URL;const url=base?`${base.replace(/\/$/,'')}/api/bear/share-bear/sms-status`:req.url;
 if(!(await twilioSignatureOk(token,url,params,req.headers.get('x-twilio-signature'))))return new NextResponse(null,{status:403});
 const deps=await shareBearDeps(req);if(!deps||!params.MessageSid)return new NextResponse(null,{status:204});
 await deliveryReport(deps,params.MessageSid,(params.MessageStatus||'').toLowerCase(),params.ErrorCode||null).catch(()=>false);
 return new NextResponse(null,{status:204});
}
