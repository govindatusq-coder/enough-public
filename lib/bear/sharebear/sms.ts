// Sending Share Bear texts. One small interface, three providers:
//  twilio - real texts, when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (a number or a Messaging Service SID
//           "MG…") are set on the server. A text counts as sent only when Twilio accepts the request and returns its id.
//  mock   - development and tests (SHARE_BEAR_SMS=mock, or no database configured). Never sends anything; the app says so.
//  none   - production without credentials. Nothing is sent; the app offers to open her own Messages app instead.
// Credentials stay on the server; nothing here runs in the browser.
export type SmsResult={ok:true;providerId:string;status:'accepted'|'queued'|'sent';provider:'twilio'|'mock'}|{ok:false;error:string;retryable:boolean;provider:'twilio'|'mock'};
export interface SmsProvider{readonly mode:'twilio'|'mock'|'none';send(to:string,body:string,opts:{idempotencyKey:string;statusCallback?:string|null}):Promise<SmsResult>}

const g=globalThis as unknown as {__bearMockSms?:{to:string;body:string;id:string;key:string}[]};
export const mockOutbox=()=>(g.__bearMockSms??=[]);
export function mockSms(failFor:(to:string)=>boolean=()=>false):SmsProvider{
 return {mode:'mock',async send(to,body,{idempotencyKey}){
  const box=mockOutbox();const dup=box.find(m=>m.key===idempotencyKey);if(dup)return {ok:true,providerId:dup.id,status:'accepted',provider:'mock'};
  if(failFor(to))return {ok:false,error:'mock_failure',retryable:false,provider:'mock'};
  const id='MOCK'+(box.length+1).toString().padStart(6,'0');box.push({to,body,id,key:idempotencyKey});return {ok:true,providerId:id,status:'accepted',provider:'mock'};}};
}
type Fetch=typeof fetch;
export function twilioSms(cfg:{sid:string;token:string;from:string},f:Fetch=fetch):SmsProvider{
 return {mode:'twilio',async send(to,body,{idempotencyKey,statusCallback}){
  const form=new URLSearchParams({To:to,Body:body,...(cfg.from.startsWith('MG')?{MessagingServiceSid:cfg.from}:{From:cfg.from}),...(statusCallback?{StatusCallback:statusCallback}:{})});
  let res:Response;
  try{res=await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.sid)}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded','I-Twilio-Idempotency-Token':idempotencyKey.slice(0,64)},body:form,signal:AbortSignal.timeout(15000)});}
  catch{return {ok:false,error:'network',retryable:true,provider:'twilio'};}
  const j=await res.json().catch(()=>({})) as {sid?:string;status?:string;code?:number;message?:string};
  if(res.ok&&j.sid)return {ok:true,providerId:j.sid,status:j.status==='sent'?'sent':j.status==='queued'?'queued':'accepted',provider:'twilio'};
  // 429 and 5xx can be tried again later; 4xx (a bad number, an unverified number on a trial account) cannot.
  return {ok:false,error:`${res.status}${j.code?` ${j.code}`:''}: ${(j.message||'').slice(0,160)}`,retryable:res.status===429||res.status>=500,provider:'twilio'};}};
}
export function noSms():SmsProvider{return {mode:'none',async send(){return {ok:false,error:'not_configured',retryable:false,provider:'mock'};}};}
export function smsFromEnv(env:Record<string,string|undefined>=process.env):SmsProvider{
 if(env.SHARE_BEAR_SMS==='mock'||(!env.NEXT_PUBLIC_SUPABASE_URL&&env.SHARE_BEAR_SMS!=='twilio'))return mockSms();
 if(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM)return twilioSms({sid:env.TWILIO_ACCOUNT_SID,token:env.TWILIO_AUTH_TOKEN,from:env.TWILIO_FROM});
 return noSms();
}
// Twilio signs its delivery callbacks: base64(HMAC-SHA1(auth token, full URL + each POST field name and value, sorted)).
export async function twilioSignatureOk(token:string,url:string,params:Record<string,string>,signature:string|null){
 if(!signature)return false;
 const data=url+Object.keys(params).sort().map(k=>k+params[k]).join('');
 const key=await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const mac=Buffer.from(await globalThis.crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))).toString('base64');
 if(mac.length!==signature.length)return false;let diff=0;for(let i=0;i<mac.length;i++)diff|=mac.charCodeAt(i)^signature.charCodeAt(i);return diff===0;
}
