import {createHash,randomBytes} from 'node:crypto';
import type {ActionType,IntegrationResult} from '../engine/actions.ts';
import type {ExecAdapter} from '../engine/execution.ts';
import {SCOPES,type CalendarConfig} from './config.ts';
import type {Tokens} from './accounts.ts';

// Microsoft sign-in (authorisation code + PKCE) and Microsoft Graph calendar events. Only what is needed: create an
// all-day event, read it back to verify. All network goes through an injected fetch (tests use a local stand-in).
export type Fetch=(url:string,init?:RequestInit)=>Promise<Response>;
const b64u=(b:Buffer)=>b.toString('base64url');
export function pkce(){const verifier=b64u(randomBytes(48));return {verifier,challenge:b64u(createHash('sha256').update(verifier).digest())};}
export const newState=()=>b64u(randomBytes(24));

export function authorizeUrl(c:CalendarConfig,o:{redirectUri:string;state:string;challenge:string}){
 const u=new URL(`${c.authority}/${c.tenant}/oauth2/v2.0/authorize`);
 for(const [k,v] of Object.entries({client_id:c.clientId!,response_type:'code',redirect_uri:o.redirectUri,response_mode:'query',scope:SCOPES.join(' '),state:o.state,code_challenge:o.challenge,code_challenge_method:'S256',prompt:'select_account'}))u.searchParams.set(k,v);
 return u.toString();
}
async function tokenRequest(c:CalendarConfig,body:Record<string,string>,f:Fetch,now:Date):Promise<Tokens>{
 const res=await f(`${c.authority}/${c.tenant}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId!,client_secret:c.clientSecret!,...body}).toString()});
 const j=await res.json().catch(()=>({})) as {access_token?:string;refresh_token?:string;expires_in?:number;error?:string};
 if(!res.ok||!j.access_token)throw new Error(j.error||'token_error');
 return {accessToken:j.access_token,refreshToken:j.refresh_token||null,expiresAt:new Date(now.getTime()+(j.expires_in||3600)*1000).toISOString()};
}
export const exchangeCode=(c:CalendarConfig,o:{code:string;redirectUri:string;verifier:string},f:Fetch,now=new Date())=>tokenRequest(c,{grant_type:'authorization_code',code:o.code,redirect_uri:o.redirectUri,code_verifier:o.verifier,scope:SCOPES.join(' ')},f,now);
export const refreshTokens=(c:CalendarConfig,refreshToken:string,f:Fetch,now=new Date())=>tokenRequest(c,{grant_type:'refresh_token',refresh_token:refreshToken,scope:SCOPES.join(' ')},f,now);

export interface EventDetails{title:string;date:string;endDate?:string|null;location?:string|null;description?:string|null}
const nextDay=(d:string)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10);};
// An all-day event. (Timed events are not created here: a wrong time zone would silently put an appointment at the wrong
// hour, so those stay a calendar file the person opens.) transactionId makes a retried create return the same event.
export function eventBody(d:EventDetails,key:string){
 const end=nextDay(d.endDate&&/^\d{4}-\d{2}-\d{2}$/.test(d.endDate)?d.endDate:d.date);
 return {subject:d.title.slice(0,250),isAllDay:true,start:{dateTime:`${d.date}T00:00:00`,timeZone:'UTC'},end:{dateTime:`${end}T00:00:00`,timeZone:'UTC'},
  ...(d.location?{location:{displayName:d.location.slice(0,250)}}:{}),...(d.description?{body:{contentType:'text',content:d.description.slice(0,2000)}}:{}),transactionId:key};
}

// The execution adapter. `getToken` returns a valid access token (refreshing if needed); it is called again after a 401.
// idempotent:true is the documented meaning of transactionId: a retry with the same key can't create a second event.
// Couldn't get a valid token: nothing was sent, so this is a known failure (not an unknown outcome).
class AuthError extends Error{}
export class GraphCalendarAdapter implements ExecAdapter{
 readonly idempotent=true;private cfg:CalendarConfig;private getToken:(force:boolean)=>Promise<string>;private f:Fetch;
 constructor(cfg:CalendarConfig,getToken:(force:boolean)=>Promise<string>,f:Fetch){this.cfg=cfg;this.getToken=getToken;this.f=f;}
 private async call(path:string,init:RequestInit){
  let token:string;try{token=await this.getToken(false);}catch{throw new AuthError('auth');}
  let res=await this.f(this.cfg.graphBase+path,{...init,headers:{...(init.headers||{}),Authorization:'Bearer '+token,'Content-Type':'application/json'}});
  if(res.status===401){try{token=await this.getToken(true);}catch{throw new AuthError('auth');}res=await this.f(this.cfg.graphBase+path,{...init,headers:{...(init.headers||{}),Authorization:'Bearer '+token,'Content-Type':'application/json'}});}
  return res;
 }
 async perform(t:ActionType,input:Record<string,unknown>):Promise<IntegrationResult>{
  if(t!=='create_calendar_event')return {ok:false,error:'unsupported_action',retrySafe:true};
  const key=String(input.idempotencyKey||'');if(!key)return {ok:false,error:'no_idempotency_key',retrySafe:true};
  const d=input as unknown as EventDetails;if(!d.title||!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date)))return {ok:false,error:'invalid_event',retrySafe:true};
  let res:Response;try{res=await this.call('/me/events',{method:'POST',body:JSON.stringify(eventBody(d,key))});}catch(e){if(e instanceof AuthError)return {ok:false,error:'reconnect_needed',retrySafe:true};throw e;}
  if(res.status===201||res.status===200){const j=await res.json().catch(()=>({})) as {id?:string};return j.id?{ok:true,reference:j.id}:{ok:false,error:'no_event_id'};}
  // 4xx other than throttling happened before anything was created; 429 and 5xx are safe to retry because of transactionId.
  return {ok:false,error:`graph_${res.status}`,retrySafe:true};
 }
 async verify(reference:string):Promise<{confirmed:boolean}>{
  let res:Response;try{res=await this.call(`/me/events/${encodeURIComponent(reference)}?$select=id,subject`,{method:'GET'});}catch{return {confirmed:false};}
  if(!res.ok)return {confirmed:false};const j=await res.json().catch(()=>({})) as {id?:string};return {confirmed:j.id===reference};
 }
}
