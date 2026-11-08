import {createHmac,timingSafeEqual} from 'node:crypto';

// Webhook authenticity for Resend (Svix "standard webhooks"), implemented to match the official
// `standardwebhooks` library exactly: the secret is base64 after an optional "whsec_" prefix; the signed
// content is `${id}.${timestamp}.${rawBody}`; HMAC-SHA256, base64; the header holds space-separated
// "v1,<signature>" entries; timestamps more than 5 minutes off are rejected (replay protection).
export const TOLERANCE_SECONDS=5*60;
export type SignatureResult={ok:true}|{ok:false;reason:'missing_secret'|'missing_headers'|'bad_timestamp'|'too_old'|'too_new'|'no_match'};
const header=(h:Headers|Record<string,string|undefined>,name:string)=>h instanceof Headers?h.get(name):(h[name]??h[name.toLowerCase()]);
export function sign(secret:string,id:string,timestamp:number,body:string){
 const key=Buffer.from(secret.startsWith('whsec_')?secret.slice(6):secret,'base64');
 return 'v1,'+createHmac('sha256',key).update(`${id}.${timestamp}.${body}`).digest('base64');
}
export function verifySignature(rawBody:string,headers:Headers|Record<string,string|undefined>,secret:string|undefined,nowSeconds=Math.floor(Date.now()/1000)):SignatureResult{
 if(!secret)return {ok:false,reason:'missing_secret'};
 const id=header(headers,'svix-id')||header(headers,'webhook-id');const ts=header(headers,'svix-timestamp')||header(headers,'webhook-timestamp');const sig=header(headers,'svix-signature')||header(headers,'webhook-signature');
 if(!id||!ts||!sig)return {ok:false,reason:'missing_headers'};
 const t=parseInt(ts,10);if(Number.isNaN(t))return {ok:false,reason:'bad_timestamp'};
 if(nowSeconds-t>TOLERANCE_SECONDS)return {ok:false,reason:'too_old'};if(t>nowSeconds+TOLERANCE_SECONDS)return {ok:false,reason:'too_new'};
 const expected=Buffer.from(sign(secret,id,t,rawBody).split(',')[1]);
 for(const part of sig.split(' ')){const [v,s]=part.split(',');if(v!=='v1'||!s)continue;const got=Buffer.from(s);if(got.length===expected.length&&timingSafeEqual(got,expected))return {ok:true};}
 return {ok:false,reason:'no_match'};
}
