"use client";
import {useState} from 'react';
import type {LifeMap} from '@/lib/life-map';
import type {OpportunityMoment} from '@/lib/opportunity-log';
import {liveCommitments,usualChoices,type AdaptiveMovementCommitment,type InviteMode} from '@/lib/goal-fitting';
import {todaysInvitation,invitationCopy,pendingCheckIns,checkInMode,reviewDue,longerOffer,activeMinutesToday,durationChoices,notTodayReasons,notTodayLabels,otherKinds,otherKindLabels,type FollowThroughEvent,type DayLoad,type NotTodayReason,type OtherKind} from '@/lib/follow-through';
import type {OpportunityActions} from './actions';

type TodayProps={commitments?:AdaptiveMovementCommitment[];events?:FollowThroughEvent[];moments?:OpportunityMoment[];lifeMap?:LifeMap;dayLoad?:DayLoad;now:number;actions:OpportunityActions};

/**
 * Home's follow-through: answers owed from yesterday or today, at most one
 * invitation, and the occasional "still worth it?". Often this is empty,
 * because staying quiet is the right call.
 */
export function FollowThroughToday({commitments,events,moments,lifeMap,dayLoad,now,actions}:TodayProps){
 const date=new Date(now);
 // A card stays on screen once someone starts answering it, even though the answer is saved straight away.
 const [held,setHeld]=useState<Record<string,{kind:'check'|'invite';decision?:'usual'|'minimum'|'alternative'}>>({});
 const hold=(id:string,kind:'check'|'invite',decision?:'usual'|'minimum'|'alternative')=>setHeld(h=>h[id]?.kind===kind?h:{...h,[id]:{kind,decision}});
 const byId=(id:string)=>(commitments||[]).find(c=>c.id===id);
 const due=pendingCheckIns(commitments,events,date);
 const pending=[...due.slice(0,2),...Object.entries(held).filter(([id,h])=>h.kind==='check'&&!due.some(c=>c.id===id)).map(([id])=>byId(id)).filter(Boolean) as AdaptiveMovementCommitment[]];
 const heldInvite=Object.entries(held).find(([,h])=>h.kind==='invite');
 const review=liveCommitments(commitments).find(c=>!pending.includes(c)&&reviewDue(c,events,date));
 const offer=liveCommitments(commitments).map(c=>({c,minutes:longerOffer(c,events)})).find(x=>x.minutes&&!pending.includes(x.c));
 const invitation=todaysInvitation(commitments,{now:date,events,lifeMap,activeMinutes:activeMinutesToday(moments,events,date),dayLoad});
 const showInvite=!!invitation&&invitation.commitment.id!==review?.id&&!pending.includes(invitation.commitment)&&!heldInvite;
 const heldCommitment=heldInvite&&byId(heldInvite[0]);
 if(!pending.length&&!review&&!offer&&!showInvite&&!heldCommitment)return null;
 return <section className="lm-yours" aria-labelledby="yours-label">
  <h2 id="yours-label" className="lm-section-label">Yours</h2>
  {pending.map(c=><CheckInCard key={c.id+':check'} commitment={c} events={events} actions={actions} onStart={()=>hold(c.id,'check')}/>)}
  {heldCommitment&&heldInvite?<InvitationCard key={heldCommitment.id+':held'} commitment={heldCommitment} decision={heldInvite[1].decision||'usual'} declinedAlready actions={actions} onHold={()=>{}}/>
  :showInvite&&invitation&&<InvitationCard key={invitation.commitment.id+invitation.decision} commitment={invitation.commitment} decision={invitation.decision as 'usual'|'minimum'|'alternative'} actions={actions} onHold={()=>hold(invitation.commitment.id,'invite',invitation.decision as 'usual'|'minimum'|'alternative')}/>}
  {review&&<ReviewCard key={review.id+':review'} commitment={review} actions={actions}/>}
  {offer?.minutes&&<article className="glass-panel lm-follow" aria-live="polite">
   <span className="eyebrow">{offer.c.originalSuggestionSnapshot.title.toUpperCase()}</span>
   <p className="lm-follow-title">You’ve been going longer lately.</p>
   <p className="lm-note">Make {offer.minutes} minutes your usual? Shorter days still count.</p>
   <div className="lm-actions"><button type="button" className="secondary" onClick={()=>actions.review(offer.c.id,'take-longer',offer.minutes!)}>Yes, make it {offer.minutes}</button><button type="button" className="lm-quiet" onClick={()=>actions.review(offer.c.id,'keep-usual')}>Keep it as is</button></div>
  </article>}
 </section>;
}

function InvitationCard({commitment,decision,actions,onHold,declinedAlready=false}:{commitment:AdaptiveMovementCommitment;decision:'usual'|'minimum'|'alternative';actions:OpportunityActions;onHold:()=>void;declinedAlready?:boolean}){
 const [declined,setDeclined]=useState(declinedAlready),[said,setSaid]=useState('');
 const copy=invitationCopy(commitment,decision);
 if(said)return <article className="glass-panel lm-follow" role="status"><p className="lm-note">{said}</p></article>;
 if(declined)return <article className="glass-panel lm-follow" aria-live="polite">
  <p className="lm-follow-title">No problem. Nothing carries over.</p>
  <p className="lm-note">Want to say what got in the way? Optional.</p>
  <Reasons onPick={r=>{actions.notTodayReason(commitment.id,r);setSaid('Thanks. Enough will take that into account.');}} onSkip={()=>setSaid('Today’s done. See you another time.')}/>
 </article>;
 return <article className="glass-panel lm-follow lm-invite">
  <span className="eyebrow">ONE OF YOURS</span>
  <p className="lm-follow-title">{copy.heading}</p>
  <p className="lm-card-text">{copy.body}</p>
  <div className="lm-actions">
   <button type="button" className="primary" onClick={()=>{actions.checkIn({commitmentId:commitment.id,kind:'accepted',source:'invitation',decision});}}>{copy.yes}</button>
   <button type="button" className="lm-quiet" onClick={()=>{onHold();setDeclined(true);actions.checkIn({commitmentId:commitment.id,kind:'not-today',source:'invitation',decision});}}>{copy.no}</button>
  </div>
  {decision==='usual'&&<button type="button" className="text-button lm-full-on" onClick={()=>actions.fullOnDay(true)}>Full-on day?</button>}
 </article>;
}

function Reasons({onPick,onSkip}:{onPick:(r:NotTodayReason)=>void;onSkip:()=>void}){
 return <><div className="lm-chips">{notTodayReasons.map(r=><button key={r} type="button" onClick={()=>onPick(r)}>{notTodayLabels[r]}</button>)}</div><button type="button" className="text-button" onClick={onSkip}>Skip</button></>;
}
function Durations({onPick,usual}:{onPick:(minutes:number)=>void;usual?:number}){
 return <div className="lm-chips">{durationChoices.map(d=><button key={d.label} type="button" onClick={()=>onPick(d.minutes)}>{d.label}</button>)}{usual&&!durationChoices.some(d=>d.minutes===usual)&&<button type="button" onClick={()=>onPick(usual)}>{usual} min</button>}</div>;
}

/** "How did it go?" One tap once Enough knows the usual; a little more detail early on. Every answer is optional. */
export function CheckInCard({commitment,events,actions,source='check-in',onDone,onStart}:{commitment:AdaptiveMovementCommitment;events?:FollowThroughEvent[];actions:OpportunityActions;source?:'check-in'|'my-moves';onDone?:()=>void;onStart?:()=>void}){
 const [stage,setStage]=useState<'ask'|'duration'|'reasons'|'other'|'other-minutes'>(source==='my-moves'?'duration':'ask');
 const [other,setOther]=useState<OtherKind>('walk'),[said,setSaid]=useState('');
 const light=checkInMode(commitment,events)==='light',usual=commitment.usualVersion?.minutes;
 const finish=(text:string)=>{setSaid(text);onDone?.();};
 const begin=(next?:typeof stage)=>{onStart?.();if(next)setStage(next);};
 const did=(minutes?:number)=>{onStart?.();actions.checkIn({commitmentId:commitment.id,kind:'did-it',source,minutes:minutes??usual});finish('Nice. That’s in My Wins.');};
 if(said)return <article className="glass-panel lm-follow" role="status"><p className="lm-note">{said}</p></article>;
 return <article className="glass-panel lm-follow lm-checkin" aria-live="polite">
  <span className="eyebrow">{commitment.originalSuggestionSnapshot.title.toUpperCase()}</span>
  <p className="lm-follow-title">{source==='my-moves'?'How long was it?':stage==='reasons'?'Fair enough. What got in the way?':stage==='other'?'What did you do instead?':stage==='other-minutes'||stage==='duration'?'About how long?':'How did it go?'}</p>
  {stage==='ask'&&<div className="lm-actions">
   <button type="button" className="primary" onClick={()=>light?did():begin('duration')}>Did it</button>
   <button type="button" className="secondary" onClick={()=>{begin('reasons');actions.checkIn({commitmentId:commitment.id,kind:'not-today',source});}}>Not today</button>
   <button type="button" className="lm-quiet" onClick={()=>begin('other')}>Did something else</button>
  </div>}
  {stage==='ask'&&source==='check-in'&&<p className="lm-note">Whenever it’s happened. This stays here until tomorrow, then quietly goes.</p>}
  {stage==='ask'&&light&&<button type="button" className="text-button" onClick={()=>setStage('duration')}>Different amount?</button>}
  {stage==='duration'&&<><Durations usual={usual} onPick={did}/>{source!=='my-moves'&&<button type="button" className="text-button" onClick={()=>did()}>Skip</button>}</>}
  {stage==='reasons'&&<><p className="lm-note">Optional. Nothing carries over to tomorrow.</p><Reasons onPick={r=>{actions.notTodayReason(commitment.id,r);finish('Thanks. Enough will take that into account.');}} onSkip={()=>finish('No problem. Today’s done.')}/></>}
  {stage==='other'&&<div className="lm-chips">{otherKinds.map(k=><button key={k} type="button" onClick={()=>{setOther(k);setStage('other-minutes');}}>{otherKindLabels[k]}</button>)}</div>}
  {stage==='other-minutes'&&<Durations onPick={minutes=>{onStart?.();actions.checkIn({commitmentId:commitment.id,kind:'something-else',source,minutes,other});finish('That counts. It’s in My Wins.');}}/>}
  {stage==='ask'&&source==='check-in'&&<button type="button" className="text-button" onClick={()=>{onStart?.();actions.checkIn({commitmentId:commitment.id,kind:'check-in-skipped',source});finish('No worries.');}}>Skip</button>}
 </article>;
}

function ReviewCard({commitment,actions}:{commitment:AdaptiveMovementCommitment;actions:OpportunityActions}){
 const [said,setSaid]=useState('');
 if(said)return <article className="glass-panel lm-follow" role="status"><p className="lm-note">{said}</p></article>;
 return <article className="glass-panel lm-follow">
  <span className="eyebrow">{commitment.originalSuggestionSnapshot.title.toUpperCase()}</span>
  <p className="lm-follow-title">Still worth suggesting?</p>
  <div className="lm-actions">
   <button type="button" className="secondary" onClick={()=>{actions.review(commitment.id,'keep');setSaid('Great. It stays as it is.');}}>Yes, keep it</button>
   <button type="button" className="lm-quiet" onClick={()=>{actions.review(commitment.id,'less');setSaid('Enough will bring it up less often.');}}>Less often</button>
   <button type="button" className="lm-quiet" onClick={()=>{actions.review(commitment.id,'stop');setSaid('Paused. It’s in My Moves if you want it back.');}}>Stop suggesting it</button>
  </div>
 </article>;
}

const inviteLabels:Record<InviteMode,string>={fit:'When it fits',rarely:'Now and then',never:'Don’t bring it up'};
/** My Moves: the movement this person has adopted. Not a plan: what fits, how much is enough, and when it works best. */
export function AdoptedMoves({commitments,events,actions}:{commitments?:AdaptiveMovementCommitment[];events?:FollowThroughEvent[];actions:OpportunityActions}){
 const list=(commitments||[]).filter(c=>c.status!=='retired');
 const [open,setOpen]=useState<{id:string;mode:'log'|'change'}|null>(null);
 if(!list.length)return null;
 return <section className="lm-adopted" aria-labelledby="adopted-label">
  <h2 id="adopted-label" className="lm-section-label">Your movement that fits</h2>
  <div className="lm-adopted-list">{list.map(c=>{const paused=c.status==='paused';return <article key={c.id} className={'glass-panel lm-adopted-card'+(paused?' lm-paused':'')}>
   {c.originalSuggestionSnapshot.imageReference&&<img src={c.originalSuggestionSnapshot.imageReference} alt="" loading="lazy"/>}
   <div className="lm-adopted-body">
    <h3>{c.originalSuggestionSnapshot.title}{paused&&<span className="lm-tag">Paused</span>}</h3>
    <dl className="lm-adopted-facts">
     {c.usualVersion&&<div><dt>{c.frequencyIntent==='sometimes'?'When it lines up':'Usually'}</dt><dd>{c.usualVersion.description.replace(/^Around /,'').replace(/\.$/,'')}</dd></div>}
     {c.minimumVersion&&<div><dt>Full-on day</dt><dd>{c.minimumVersion.minutes} min</dd></div>}
     {c.anchor&&<div><dt>Works best</dt><dd>{c.anchor.description}</dd></div>}
    </dl>
    {open?.id===c.id&&open.mode==='log'?<CheckInCard commitment={c} events={events} actions={actions} source="my-moves" onDone={()=>setTimeout(()=>setOpen(null),1600)}/>
    :open?.id===c.id&&open.mode==='change'?<div className="lm-adopted-change">
     <p className="lm-note">Your usual</p><div className="lm-pills">{usualChoices(c).map(n=><button key={n} type="button" aria-pressed={c.usualVersion?.minutes===n} onClick={()=>actions.change(c.id,{usual:n})}>{n} min</button>)}</div>
     <p className="lm-note">Bring it up</p><div className="lm-pills">{(Object.keys(inviteLabels) as InviteMode[]).map(m=><button key={m} type="button" aria-pressed={c.invite===m} onClick={()=>actions.change(c.id,{invite:m})}>{inviteLabels[m]}</button>)}</div>
     <div className="lm-actions"><button type="button" className="secondary" onClick={()=>setOpen(null)}>Done</button><button type="button" className="lm-quiet" onClick={()=>{actions.change(c.id,{status:'retired'});setOpen(null);}}>Remove it</button></div>
    </div>
    :<div className="lm-actions">
     {!paused&&<button type="button" className="secondary" onClick={()=>setOpen({id:c.id,mode:'log'})}>Did one</button>}
     <button type="button" className="lm-quiet" onClick={()=>setOpen({id:c.id,mode:'change'})}>Change</button>
     <button type="button" className="lm-quiet" onClick={()=>actions.change(c.id,{status:paused?'active':'paused'})}>{paused?'Resume':'Pause'}</button>
    </div>}
   </div>
  </article>;})}</div>
 </section>;
}
