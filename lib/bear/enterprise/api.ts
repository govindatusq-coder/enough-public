import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {todayISO} from '../domain/dates.ts';
import {registry,performAction,type ActionType} from '../engine/actions.ts';
import {history} from '../engine/events.ts';
import {extractResponsibilities} from '../engine/extract.ts';
import {planFor,validatePlan,planFromGraph} from '../engine/plan.ts';
import {responsibilityView} from '../engine/view.ts';
import {maybeAutoSetup} from '../services/auto-setup.ts';
import {createCapture} from '../services/capture.ts';
import {completeTask} from '../services/completion.ts';
import {ensureProfile,saveProfile} from '../services/profile.ts';
import {understand} from '../load/engine.ts';
import {currentCapabilities} from '../load/types.ts';
import type {BearStore} from '../store/store.ts';
import {brandFor} from './branding.ts';
import type {Tenant,TenantRegistry} from './tenants.ts';

// The vendor-neutral enterprise API (v1). Framework-agnostic: the Next.js route only adapts requests.
// The same Responsibility Engine as the consumer app; nothing is duplicated. Every request is
// authenticated (tenant API key), scoped to one tenant, and acts for one of that tenant's own members.
export interface ApiRequest{method:string;path:string;headers:Record<string,string|undefined>;body:unknown;query?:Record<string,string|undefined>}
export interface ApiResponse{status:number;body:unknown;headers:Record<string,string>}
export interface ApiDeps{registry:TenantRegistry;storeFor:(userId:string)=>BearStore;rateLimit?:RateLimiter;now?:()=>Date}
export const K_ANONYMITY=10;

// Fixed-window rate limit per tenant key. In-memory: per server instance (documented limitation).
export class RateLimiter{
 private hits=new Map<string,{window:number;count:number}>();
 limit:number;windowMs:number;
 constructor(limit=120,windowMs=60_000){this.limit=limit;this.windowMs=windowMs;}
 take(key:string,now=Date.now()){const w=Math.floor(now/this.windowMs);const h=this.hits.get(key);if(!h||h.window!==w){this.hits.set(key,{window:w,count:1});return true;}h.count++;return h.count<=this.limit;}
}
const fail=(status:number,code:string,message:string,requestId:string):ApiResponse=>({status,body:{error:{code,message,requestId}},headers:{'X-Request-Id':requestId}});
const ok=(status:number,body:unknown,requestId:string):ApiResponse=>({status,body,headers:{'X-Request-Id':requestId}});
const ID=/^[0-9a-f-]{36}$/i;
const textSchema=z.object({text:z.string().trim().min(1).max(20000),sourceType:z.enum(['image','document','voice','text','message']).optional(),today:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict();
const createSchema=z.object({text:z.string().trim().min(1).max(20000)}).strict();
const planSchema=z.union([z.object({text:z.string().trim().min(1).max(20000)}).strict(),z.object({responsibilityId:z.string().regex(ID)}).strict()]);
const actionSchema=z.object({actionType:z.string().max(40),approved:z.boolean().optional(),input:z.record(z.string(),z.unknown()).optional()}).strict();
const verifySchema=z.object({method:z.literal('user_confirmation')}).strict();
const memberSchema=z.object({externalId:z.string().trim().min(1).max(128).regex(/^[\w.@:-]+$/)}).strict();

export async function handle(req:ApiRequest,d:ApiDeps):Promise<ApiResponse>{
 const requestId=(req.headers['x-request-id']&&/^[\w-]{6,64}$/.test(req.headers['x-request-id']!)?req.headers['x-request-id']!:randomUUID());
 const now=d.now?d.now():new Date();
 // 1. Authenticate the tenant.
 const auth=req.headers['authorization']||'';const raw=/^Bearer\s+(lbk_[\w-]{20,})$/.exec(auth)?.[1];
 if(!raw)return fail(401,'unauthenticated','Missing or malformed API key.',requestId);
 const tenant=await d.registry.tenantForKey(raw);if(!tenant)return fail(401,'unauthenticated','Invalid API key.',requestId);
 if(d.rateLimit&&!d.rateLimit.take(tenant.id,now.getTime()))return {...fail(429,'rate_limited','Too many requests. Try again shortly.',requestId),headers:{'X-Request-Id':requestId,'Retry-After':'60'}};
 // 2. Idempotency for writes.
 const idemKey=req.method==='POST'||req.method==='DELETE'?req.headers['idempotency-key']:undefined;
 if(idemKey!==undefined&&!/^[\w-]{8,128}$/.test(idemKey))return fail(400,'invalid_idempotency_key','Idempotency-Key must be 8–128 letters, digits, - or _.',requestId);
 if(idemKey){const prev=await d.registry.idempotent(tenant.id,`${req.method}:${req.path}:${idemKey}`);if(prev)return {status:prev.status,body:prev.body,headers:{'X-Request-Id':requestId,'Idempotent-Replay':'true'}};}
 let res:ApiResponse;
 try{res=await route(req,d,tenant,requestId,now);}
 catch(e){if(e instanceof z.ZodError)return fail(400,'invalid_request',e.issues.map(i=>`${i.path.join('.')||'body'}: ${i.message}`).join('; ').slice(0,300),requestId);return fail(500,'internal_error','Something went wrong.',requestId);}
 if(idemKey&&res.status<500)await d.registry.saveIdempotent(tenant.id,`${req.method}:${req.path}:${idemKey}`,{status:res.status,body:res.body});
 return res;
}

async function route(req:ApiRequest,d:ApiDeps,tenant:Tenant,requestId:string,now:Date):Promise<ApiResponse>{
 const parts=req.path.replace(/^\/+|\/+$/g,'').split('/');if(parts[0]==='api')parts.shift();
 if(parts[0]!=='v1')return fail(404,'not_found','Unknown endpoint.',requestId);
 const [, resource,id,sub]=parts;const m=req.method;
 // Members are addressed by the tenant's own external id, never by Load Bear's internal ids.
 const subject=async()=>{const ext=req.headers['x-loadbear-subject'];if(!ext)return null;return d.registry.member(tenant.id,ext);};
 if(resource==='capabilities'&&m==='GET')return ok(200,{capabilities:registry().map(c=>({actionType:c.actionType,state:c.state,requiresUserApproval:c.requiresUserApproval,riskLevel:c.riskLevel,supportsVerification:c.supportsVerification}))},requestId);
 if(resource==='branding'&&m==='GET')return ok(200,{brand:brandFor(tenant.brand)},requestId);
 if(resource==='members'){
  if(m==='POST'&&!id){const {externalId}=memberSchema.parse(req.body);const mem=await d.registry.provision(tenant.id,externalId);
   const s=d.storeFor(mem.userId);await ensureProfile(s);await saveProfile(s,{onboardingComplete:true});return ok(201,{externalId,status:'active'},requestId);}
  if(m==='DELETE'&&id){const done=await d.registry.deprovision(tenant.id,decodeURIComponent(id));return done?ok(200,{externalId:decodeURIComponent(id),status:'deprovisioned'},requestId):fail(404,'not_found','No active member with that id.',requestId);}
 }
 if(resource==='reports'&&id==='usage'&&m==='GET')return ok(200,await usageReport(d,tenant),requestId);
 if(resource!=='responsibilities')return fail(404,'not_found','Unknown endpoint.',requestId);
 // Stateless: extract and plan from text without storing anything.
 if(id==='extract'&&m==='POST'){const b=textSchema.parse(req.body);return ok(200,extractResponsibilities(b.text,{today:b.today||todayISO('Australia/Sydney',now),sourceType:b.sourceType||'text',sourceId:requestId,now}),requestId);}
 if(id==='plan'&&m==='POST'){const b=planSchema.parse(req.body);
  if('text' in b){const {graph}=understand({text:b.text,today:todayISO('Australia/Sydney',now),caps:currentCapabilities(false)});return ok(200,{plan:validatePlan(planFromGraph(graph))},requestId);}
  const mem=await subject();if(!mem)return fail(403,'forbidden','Unknown subject for this tenant.',requestId);
  const t=await d.storeFor(mem.userId).get('tasks',b.responsibilityId);if(!t?.load)return fail(404,'not_found','No such responsibility.',requestId);return ok(200,{plan:planFor(t.load)},requestId);}
 const mem=await subject();if(!mem)return fail(403,'forbidden','Unknown subject for this tenant.',requestId);
 const store=d.storeFor(mem.userId);
 if(!id&&m==='POST'){const b=createSchema.parse(req.body);const {extraction}=await createCapture(store,null,{method:'text',text:b.text,referenceYear:now.getFullYear()});
  const before=new Set((await store.list('tasks')).map(t=>t.id));const auto=await maybeAutoSetup(store,extraction,now);
  const created=(await store.list('tasks')).filter(t=>!before.has(t.id)&&t.load).map(t=>t.id);
  const ids=created.length?created:auto?[auto.task.id]:[];
  return ok(auto?.merged?200:ids.length?201:202,{responsibilityIds:ids,merged:!!auto?.merged,needsReview:!auto,extractionKind:extraction.kind},requestId);}
 if(!id||!ID.test(id))return fail(404,'not_found','No such responsibility.',requestId);
 if(!sub&&m==='GET'){const v=await responsibilityView(store,id,now);return v?ok(200,v,requestId):fail(404,'not_found','No such responsibility.',requestId);}
 const t=await store.get('tasks',id);if(!t)return fail(404,'not_found','No such responsibility.',requestId);
 if(sub==='history'&&m==='GET')return ok(200,{events:(await history(store,id)).map(e=>({type:e.eventType,from:e.previousState||null,to:e.nextState||null,actor:e.actor,at:e.at,metadata:e.metadata||{}}))},requestId);
 if(sub==='actions'&&m==='POST'){const b=actionSchema.parse(req.body);const known=registry().find(c=>c.actionType===b.actionType);if(!known)return fail(400,'unknown_action','Unknown actionType.',requestId);
  const outcome=await performAction(b.actionType as ActionType,b.input||{},{approved:b.approved});
  return ok(outcome.status==='failed'?502:outcome.status==='not_available'?409:200,{outcome},requestId);}
 if(sub==='verify'&&m==='POST'){verifySchema.parse(req.body);if(t.status!=='open')return fail(409,'not_open','Already closed.',requestId);
  await completeTask(store,{taskId:id,method:'api',expectNext:false,evidence:'user'},now);return ok(200,await responsibilityView(store,id,now),requestId);}
 return fail(405,'method_not_allowed','Method not allowed.',requestId);
}

// Employer reporting: counts only, across members, and nothing at all for small groups (no individual can
// be singled out). Never titles, dates, categories, children, money, health or documents.
async function usageReport(d:ApiDeps,tenant:Tenant){
 const members=(await d.registry.members(tenant.id)).filter(m=>m.status==='active');
 if(members.length<K_ANONYMITY)return {suppressed:true,reason:`Fewer than ${K_ANONYMITY} active members`,activeMembers:null};
 let users=0,responsibilities=0,verified=0;
 for(const m of members){const s=d.storeFor(m.userId);const tasks=(await s.list('tasks')).filter(t=>t.load);if(tasks.length)users++;responsibilities+=tasks.length;verified+=(await s.list('completions')).filter(c=>c.evidence?.level==='confirmed'||c.evidence?.level==='user_confirmed').length;}
 const round=(n:number)=>Math.round(n/5)*5;   // coarse counts make differencing attacks harder
 return {suppressed:false,activeMembers:members.length,membersUsingLoadBear:round(users),responsibilitiesManaged:round(responsibilities),completionsConfirmed:round(verified)};
}
