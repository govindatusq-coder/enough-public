import {aiContext,validateCandidates} from './ai-ideas.ts';
import type {State} from './journey.ts';
import type {Idea} from './ideas.ts';
import {requireAiConsent} from './ai-consent.ts';

export class SuggestionBusy extends Error{
 constructor(){super('Your suggestions are still being prepared in another request. Try again when they are ready.');}
}
export async function withSuggestionRequest<T>(begin:(id:string)=>Promise<boolean>,end:(id:string)=>Promise<void>,work:()=>Promise<T>){
 const id=crypto.randomUUID();
 if(!await begin(id))throw new SuggestionBusy();
 try{return await work();}
 finally{try{await end(id);}catch{console.warn('The suggestion request reservation will expire automatically.');}}
}
type BatchContext=ReturnType<typeof aiContext>&{requestSeed:string;attempt:number;previousAttemptTitles:string[]};
export async function generateFreshCandidates(state:State,now:Date,generate:(context:BatchContext)=>Promise<unknown>,keepUnique:(ideas:Idea[])=>Promise<Idea[]>){
 requireAiConsent(state.aiConsent);
 const requestSeed=crypto.randomUUID(),previousAttemptTitles:string[]=[];
 // A single retry can find another safe angle when a batch is entirely
 // duplicate or ineligible. Neither attempt loosens the user's boundaries.
 for(let attempt=1;attempt<=2;attempt++){
  const result=await generate({...aiContext(state,now),requestSeed,attempt,previousAttemptTitles});
  const candidates=validateCandidates(result,state,now).slice(0,10);
  const ideas=candidates.length?await keepUnique(candidates):[];
  if(ideas.length)return ideas;
  if(result&&typeof result==='object'&&'candidates' in result&&Array.isArray(result.candidates)){
   previousAttemptTitles.push(...result.candidates.flatMap(row=>typeof row?.title==='string'?[row.title.slice(0,100)]:[]));
  }
 }
 return [];
}
