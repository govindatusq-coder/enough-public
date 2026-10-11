import {validateState} from './account-validation.ts';
import {completeProfile} from './journey.ts';
import {eligible} from './recommendations.ts';
import {mergeIdeas} from './suggestion-history.ts';
import {generateFreshCandidates,SuggestionBusy} from './suggestion-service.ts';
import {AiConsentRequired,checkCurrentAiConsent,requireAiConsent} from './ai-consent.ts';
import type {Idea} from './ideas.ts';
import type {aiContext} from './ai-ideas.ts';

type Dependencies={
 authenticated:boolean;
 available:boolean;
 readAccount:()=>Promise<{state_json:unknown;revision:number}|null>;
 readConsent:()=>Promise<unknown>;
 recentIdeas:()=>Promise<Idea[]>;
 withRequest:<T>(work:()=>Promise<T>)=>Promise<T>;
 generate:(context:ReturnType<typeof aiContext>&{requestSeed:string;attempt:number;previousAttemptTitles:string[]})=>Promise<unknown>;
 keep:(ideas:Idea[])=>Promise<Idea[]>;
 pictures:(ideas:Idea[],previous:Idea[],checkConsent:()=>Promise<void>)=>Promise<{ready:number;errors:{id:number;message:string}[]}>;
 now?:()=>Date;
};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

// The HTTP boundary reads consent from the authenticated account, never from
// request JSON. Tests exercise the same boundary with inert provider adapters.
export function createIdeasPost(deps:Dependencies){return async(req:Request)=>{
 if(!deps.authenticated)return json({error:'Sign in to request new ideas.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Request origin is not allowed.'},403);
 try{
  const record=await deps.readAccount();
  if(!record)return json({error:'Keep your ENOUGH profile first.'},409);
  const state=validateState(record.state_json),consent=requireAiConsent(state.aiConsent);
  if(!deps.available)return json({error:'AI generation is not connected. Your personalised library ideas are still available.'},503);
  if(!completeProfile(state.profile))return json({error:'Complete your PINS and routines first.'},409);
  if(state.profile.needs.some(n=>n.startsWith('Something else: ')))return json({error:'Your written need is saved. Review the listed boundaries in My Pins before requesting suggestions.'},409);
  const body=await req.json() as {timezone?:string};let now=deps.now?.()||new Date();
  if(body.timezone){
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:body.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
   const part=(key:string)=>parts.find(p=>p.type===key)?.value;
   now=new Date(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00`);
  }
  const checkConsent=async()=>checkCurrentAiConsent(consent,await deps.readConsent());
  return await deps.withRequest(async()=>{
   await checkConsent();
   state.generated=mergeIdeas(await deps.recentIdeas(),state.generated||[]);
   const ideas=await generateFreshCandidates(state,now,async context=>{await checkConsent();return deps.generate(context);},deps.keep);
   await checkConsent();
   // Older full-context text can contain health details. Reduced permission
   // allows pictures for this new, reduced-context batch only.
   const previous=consent.choice==='without-health'?[]:(state.generated||[]).filter(i=>eligible(i,state,now)&&!state.tuning?.hidden.includes(i.id));
   const pictures=await deps.pictures(ideas,previous,checkConsent);
   await checkConsent();
   if(pictures.errors.length)console.warn('Some idea pictures could not be prepared',{failed:pictures.errors.length,prepared:pictures.ready});
   return json({ideas,baseRevision:record.revision,picturesPrepared:pictures.ready,...(pictures.errors.length?{imageWarning:true}:{})});
  });
 }catch(error){
  if(error instanceof AiConsentRequired)return json({error:error.message,consentRequired:true},409);
  if(error instanceof SuggestionBusy)return Response.json({error:error.message},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'5'}});
  console.error('Idea generation failed',error);
  return json({error:'New ideas could not be prepared. Your library remains available. Try again later.'},503);
 }
};}
