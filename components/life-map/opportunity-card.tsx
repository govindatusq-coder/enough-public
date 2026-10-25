"use client";
import {useState} from 'react';
import {Illustration} from './illustration';
import {extraLabel,extraLabelLong,movementLabel,type CardCopy} from '@/lib/opportunity-copy';
import {rejectReasons,rejectReasonLabels,type RejectReason} from '@/lib/opportunity-log';
import type {Ranked} from '@/lib/opportunity-engine';

type Props={
 ranked:Ranked;
 copy:CardCopy;
 variant:'hero'|'compact'|'payoff';
 eyebrow?:string;
 acceptLabel?:string;
 rejectLabel?:string;
 onAccept:()=>void;
 /** Called once, with the optional reason when the person gives one. */
 onReject:(reason?:RejectReason)=>void;
 /** Offer the optional reason sheet after "Not for me". */
 askReason?:boolean;
 accepted?:boolean;
};
/** One opportunity, in the Enough card style: painting for mood, words for specifics. */
export function OpportunityCard({ranked,copy,variant,eyebrow,acceptLabel='I’d do that',rejectLabel='Not for me',onAccept,onReject,askReason,accepted}:Props){
 const [asking,setAsking]=useState(false),[declined,setDeclined]=useState(false);
 const decline=(reason?:RejectReason)=>{setAsking(false);setDeclined(true);onReject(reason);};
 const reject=()=>{if(askReason)setAsking(true);else decline();};
 if(asking)return <article className={`lm-card lm-${variant} lm-reasons`} aria-live="polite">
  <p className="lm-reasons-title">Fair enough. Want to say why?</p>
  <p className="lm-note">Optional. It helps Enough pick better next time.</p>
  <div className="lm-chips">{rejectReasons.map(r=><button key={r} type="button" onClick={()=>decline(r)}>{rejectReasonLabels[r]}</button>)}</div>
  <button type="button" className="text-button" onClick={()=>decline()}>Skip</button>
 </article>;
 if(declined&&variant!=='payoff')return <article className={`lm-card lm-${variant} lm-declined`} role="status"><p>Got it. Enough will suggest “{copy.title}” less.</p></article>;
 return <article className={`lm-card lm-${variant}${accepted?' lm-accepted':''}${declined?' lm-was-declined':''}`}>
  <div className="lm-art"><Illustration category={ranked.opportunity.imageCategory} variant={ranked.opportunity.imageVariant} eager={variant==='hero'}/></div>
  <div className="lm-card-body">
   {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
   <h3>{copy.title}</h3>
   <p className="lm-card-text">{copy.body}</p>
   <dl className="lm-metrics">
    <div><dt className="sr-only">Movement</dt><dd><strong>{copy.minutes}</strong> {variant==='payoff'?'movement minutes':'min movement'}</dd></div>
    <div><dt className="sr-only">Extra time</dt><dd>{variant==='payoff'?extraLabelLong(copy):extraLabel(copy)}</dd></div>
   </dl>
   {variant!=='payoff'&&copy.why&&<p className="lm-why">{copy.why}</p>}
   {accepted?<p className="lm-done-note" role="status">Noted. It’s waiting for you on Home.</p>:<div className="lm-actions">
    <button type="button" className="primary" onClick={onAccept} aria-label={`${acceptLabel}: ${copy.title}`}>{acceptLabel}</button>
    <button type="button" className="lm-quiet" onClick={reject} aria-label={`${rejectLabel}: ${copy.title}`}>{rejectLabel}</button>
   </div>}
  </div>
  <span className="sr-only">{movementLabel(copy)}. {extraLabel(copy)}.</span>
 </article>;
}
