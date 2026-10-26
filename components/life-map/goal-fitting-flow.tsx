"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import type {LifeMap,RecurringMoment} from '@/lib/life-map';
import {opportunityById} from '@/lib/opportunities';
import {fitCommitment,fittingQuestion,answerFittingQuestion,confirmationLines,confirmationNote,usualChoices,changeCommitment,newId,type FittingQuestion,type AdaptiveMovementCommitment,type FrequencyIntent,type InviteMode} from '@/lib/goal-fitting';

export type FitTarget={opportunityId:string;snapshot:AdaptiveMovementCommitment['originalSuggestionSnapshot'];matchedMoment?:RecurringMoment;plannedMomentId?:string};
type Props={target:FitTarget;lifeMap:LifeMap;onAdopt:(c:AdaptiveMovementCommitment,map:LifeMap)=>void;onJustToday:()=>void;onExit:()=>void};
const intents:{id:FrequencyIntent;title:string;text:string}[]=[
 {id:'usually',title:'Usually',text:'It comes up most weeks.'},
 {id:'sometimes',title:'Sometimes',text:'Useful when things line up.'},
 {id:'once',title:'Just today',text:'No need to keep it around.'}
];
const inviteLabels:Record<InviteMode,string>={fit:'When it looks like a decent fit',rarely:'Now and then',never:'Don’t bring it up'};

/** After "I'd do that": one light question, maybe two, then a plan Enough looks after. */
export function GoalFittingFlow({target,lifeMap,onAdopt,onJustToday,onExit}:Props){
 const [step,setStep]=useState<'intent'|'question'|'confirm'|'change'>('intent');
 const [intent,setIntent]=useState<Exclude<FrequencyIntent,'once'>>('usually');
 const [map,setMap]=useState(lifeMap),[answers,setAnswers]=useState<Record<string,string>>({});
 const [edits,setEdits]=useState<{usual?:number;invite?:InviteMode}>({});
 const heading=useRef<HTMLHeadingElement>(null);
 const [id]=useState(newId),[asked,setAsked]=useState<FittingQuestion|null>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo(0,0);},[step]);
 const o=opportunityById(target.opportunityId);
 const fitted=useMemo(()=>{
  const c=fitCommitment({opportunityId:target.opportunityId,snapshot:target.snapshot,matchedMoment:target.matchedMoment,lifeMap:map,intent,answers,plannedMomentId:target.plannedMomentId,id});
  return edits.usual||edits.invite?changeCommitment(c,edits):c;
 },[target,map,intent,answers,edits,id]);
 const choose=(next:FrequencyIntent)=>{
  if(next==='once'){onJustToday();return;}
  setIntent(next);const ask=o?fittingQuestion(o,map,next,answers):null;setAsked(ask);setStep(ask?'question':'confirm');
 };
 const back=()=>{if(step==='intent'){onExit();return;}setStep(step==='change'?'confirm':step==='confirm'&&asked?'question':'intent');};
 const [usualDraft,setUsualDraft]=useState<number|undefined>(undefined),[inviteDraft,setInviteDraft]=useState<InviteMode|undefined>(undefined);
 const conditions=(fitted.feasibilityConditions||[]).slice(0,2).join(' · ');

 return <div className="lm-onboarding lm-fitting">
  <div className="lm-onboarding-frame">
   <div className="lm-top"><button type="button" className="lm-back" onClick={back} aria-label={step==='intent'?'Close':'Back'}><ArrowLeft size={20}/></button></div>

   {step==='intent'&&<section>
    <span className="eyebrow">{target.snapshot.title.toUpperCase()}</span>
    <h1 ref={heading} tabIndex={-1}>Could this become one of yours?</h1>
    <p className="lm-sub">No plan to set up. Enough will look after the rest.</p>
    <div className="lm-choices">{intents.map(i=><button key={i.id} type="button" onClick={()=>choose(i.id)}><strong>{i.title}</strong><small>{i.text}</small></button>)}</div>
   </section>}

   {step==='question'&&asked&&<section>
    <span className="eyebrow">ONE QUICK THING</span>
    <h1 ref={heading} tabIndex={-1}>{asked.text}</h1>
    <p className="lm-sub">So Enough only brings it up when it can actually work.</p>
    <div className="lm-choices">{asked.options.map(a=><button key={a.id} type="button" onClick={()=>{const r=answerFittingQuestion(map,answers,asked.id,a.id);setMap(r.map);setAnswers(r.answers);setStep('confirm');}}><strong>{a.label}</strong></button>)}</div>
   </section>}

   {step==='confirm'&&<section>
    <span className="eyebrow">{target.snapshot.title.toUpperCase()}</span>
    <h1 ref={heading} tabIndex={-1}>Here’s how we’ll treat it</h1>
    <dl className="glass-panel lm-fit-lines">{confirmationLines(fitted).map(l=><div key={l.label}><dt>{l.label}</dt><dd>{l.text}</dd></div>)}
     {fitted.anchor&&<div><dt>Works best</dt><dd>{fitted.anchor.description}{conditions&&<small>{conditions}</small>}</dd></div>}</dl>
    <p className="lm-sub">{confirmationNote(fitted)}</p>
   </section>}

   {step==='change'&&<section>
    <span className="eyebrow">{target.snapshot.title.toUpperCase()}</span>
    <h1 ref={heading} tabIndex={-1}>Change it</h1>
    <fieldset className="lm-fit-field"><legend>Your usual</legend><div className="lm-pills">{usualChoices(fitted).map(n=><button key={n} type="button" aria-pressed={(usualDraft??fitted.usualVersion?.minutes)===n} onClick={()=>setUsualDraft(n)}>{n} min</button>)}</div></fieldset>
    <fieldset className="lm-fit-field"><legend>Bring it up</legend><div className="lm-pills">{(Object.keys(inviteLabels) as InviteMode[]).map(m=><button key={m} type="button" aria-pressed={(inviteDraft??fitted.invite)===m} onClick={()=>setInviteDraft(m)}>{inviteLabels[m]}</button>)}</div></fieldset>
   </section>}

   {(step==='confirm'||step==='change')&&<div className="lm-footer">
    {step==='confirm'?<>
     <button type="button" className="primary lm-cta" onClick={()=>onAdopt(fitted,map)}>Sounds good</button>
     <button type="button" className="text-button" onClick={()=>{setUsualDraft(undefined);setInviteDraft(undefined);setStep('change');}}>Change it</button>
    </>:<button type="button" className="primary lm-cta" onClick={()=>{setEdits({usual:usualDraft??edits.usual,invite:inviteDraft??edits.invite});setStep('confirm');}}>Done</button>}
   </div>}
  </div>
 </div>;
}
