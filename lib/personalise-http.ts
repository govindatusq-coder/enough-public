import {z} from 'zod';
import {validateState} from './account-validation.ts';
import {requireAiConsent,AiConsentRequired} from './ai-consent.ts';
import {trustedWrite} from './public-auth.ts';
import {rank} from './opportunity-engine.ts';
import {situations} from './opportunity-log.ts';
import {cardCopy,personaliseContext,validatePersonalised} from './opportunity-copy.ts';
import {hasLifeMap} from './life-map.ts';

/**
 * POST /api/personalise: rewords ONE opportunity the engine has already
 * chosen. The server re-runs the engine from the saved account, so a request
 * can never personalise something the person's constraints exclude. Any
 * failure answers 200 with `copy: null` and the app keeps its template copy.
 */
type Dependencies={
 authenticated:boolean;
 available:boolean;
 readAccount:()=>Promise<{state_json:unknown}|null>;
 generate:(context:ReturnType<typeof personaliseContext>)=>Promise<unknown>;
 now?:()=>Date;
};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const bodySchema=z.object({opportunityId:z.string().min(1).max(60),situation:z.enum(situations).optional(),extraAllowance:z.number().int().min(0).max(60).optional()}).strict();

export function createPersonalisePost(deps:Dependencies){return async(req:Request)=>{
 if(!deps.authenticated)return json({error:'Sign in for personalised wording.'},401);
 if(!trustedWrite(req))return json({error:'Request origin is not allowed.'},403);
 let body:z.infer<typeof bodySchema>;
 try{body=bodySchema.parse(await req.json());}catch{return json({error:'Check the request.'},400);}
 try{
  const record=await deps.readAccount();
  if(!record)return json({copy:null});
  const state=validateState(record.state_json);
  requireAiConsent(state.aiConsent);
  if(!deps.available||!hasLifeMap(state.lifeMap))return json({copy:null});
  const now=deps.now?.()||new Date();
  const ranked=rank({lifeMap:state.lifeMap,feedback:state.opportunityFeedback,moments:state.opportunityMoments,now},{situation:body.situation,extraAllowance:body.extraAllowance}).find(r=>r.opportunity.id===body.opportunityId);
  if(!ranked)return json({copy:null});
  try{
   const raw=await deps.generate(personaliseContext(ranked,state.lifeMap,body.situation));
   return json({copy:validatePersonalised(raw,ranked,cardCopy(ranked))});
  }catch(error){console.warn('Personalised wording unavailable',error instanceof Error?error.message:error);return json({copy:null});}
 }catch(error){
  if(error instanceof AiConsentRequired)return json({copy:null,consentRequired:true});
  console.warn('Personalised wording unavailable',error instanceof Error?error.message:error);
  return json({copy:null});
 }
};}
