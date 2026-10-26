"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check} from 'lucide-react';
import {lifeContexts,contextCards,suggestedMoments,momentLabels,scenariosFor,permissionLevels,movementStyles,styleCards,hardNos,hardNoLabels,extraTimeChoices,extraTimeOptions,emptyLifeMap,frictions,frictionLabels,goalFeelings,goalFeelLabels,suggestStyles,suggestStyleLabels,type LifeMap,type LifeContext,type RecurringMoment,type MovementStyle,type HardNo,type ExtraTime,type Friction} from '@/lib/life-map';
import {Illustration} from './illustration';
import {payoff,type Ranked} from '@/lib/opportunity-engine';
import {cardCopy} from '@/lib/opportunity-copy';
import type {FeedbackEvent} from '@/lib/opportunity-log';
import {OpportunityCard} from './opportunity-card';

export type ScreenId='welcome'|'contexts'|'moments'|'permissions'|'styles'|'hard-nos'|'extra-time'|'friction'|'feel'|'payoff';
const baseScreens:ScreenId[]=['welcome','contexts','moments','permissions','styles','hard-nos','extra-time'];
/** The suggestion engine's screens come first and are unchanged; goal fitting adds two short, optional ones. */
export const onboardingScreens=(adaptive:boolean):ScreenId[]=>[...baseScreens,...(adaptive?['friction','feel'] as ScreenId[]:[]),'payoff'];
type Props={
 initial?:LifeMap;
 feedback?:FeedbackEvent[];
 /** Open one screen to edit it, then return. */
 editScreen?:ScreenId;
 /** adaptiveGoalFittingV1: ask what gets in the way and how suggestions should feel. */
 adaptive?:boolean;
 onChange:(map:LifeMap)=>void;
 onPayoff:(r:Ranked,response:'accept'|'reject')=>void;
 onFinish:(map:LifeMap)=>void;
 onExit:()=>void;
};
const toggle=<T,>(list:T[],value:T)=>list.includes(value)?list.filter(v=>v!==value):[...list,value];

/** The Life Map onboarding: about a minute, mostly tapping pictures. */
export function LifeMapOnboarding({initial,feedback,editScreen,adaptive=false,onChange,onPayoff,onFinish,onExit}:Props){
 const [map,setMap]=useState<LifeMap>(()=>initial||emptyLifeMap());
 const screens=onboardingScreens(adaptive),last=screens.length-1;
 const [screen,setScreen]=useState(Math.max(0,editScreen?screens.indexOf(editScreen):0));
 const current=screens[screen];
 const [showMore,setShowMore]=useState(false);
 const [other,setOther]=useState(!!map.otherMoment);
 const [extraChosen,setExtraChosen]=useState(!!initial?.onboardingCompleted);
 const [responses,setResponses]=useState<Record<string,'accept'|'reject'>>({});
 const heading=useRef<HTMLHeadingElement>(null);
 const editing=editScreen!==undefined;
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo(0,0);},[screen]);
 const change=(next:LifeMap)=>{setMap(next);onChange(next);};

 const moments=useMemo(()=>suggestedMoments(map.contexts),[map.contexts]);
 const shownScenarios=useMemo(()=>scenariosFor(map),[map.contexts,map.moments]);
 const [rejected,setRejected]=useState<string[]>([]);
const cards=useMemo(()=>current==='payoff'?payoff({lifeMap:{...map,onboardingCompleted:true},feedback},rejected):[],[screen,map,rejected]);
 const [shown,setShown]=useState<Ranked[]>([]);
 // Keep accepted cards in place; replace a "Not really" with the next best fit.
 useEffect(()=>{if(current!=='payoff')return;setShown(prev=>{
  const keep=prev.filter(r=>!rejected.includes(r.opportunity.id));
  const fill=cards.filter(r=>!keep.some(k=>k.opportunity.id===r.opportunity.id));
  return [...keep,...fill].slice(0,3);
 });},[cards,screen]);

 const valid=current==='contexts'?map.contexts.length>0:current==='hard-nos'?map.hardNosAnswered:current==='extra-time'?extraChosen:true;
 const fitting=map.fitting||{};
 const next=()=>{
  if(editing){onFinish({...map});return;}
  if(current==='payoff'){onFinish({...map,onboardingCompleted:true});return;}
  setScreen(screen+1);
 };
 const back=()=>{if(editing||screen===0){onExit();return;}if(current==='payoff'){setShown([]);setRejected([]);}setScreen(screen-1);};
 const optionalEmpty=current==='friction'?!fitting.frictionAnswered:current==='feel'?!fitting.goalFeel&&!fitting.suggestStyle:false;
 const cta=editing?'Save':current==='welcome'?'Show me':current==='contexts'?'That’s pretty much me':current==='moments'?'That’s about it':current==='payoff'?'Find my movement':optionalEmpty?'Skip':'Next';

 return <div className="lm-onboarding">
  <div className="lm-onboarding-frame">
   {screen>0&&<div className="lm-top">
    <button type="button" className="lm-back" onClick={back} aria-label={editing?'Close without saving':'Back'}><ArrowLeft size={20}/></button>
    {!editing&&<div className="lm-progress" aria-label={`Step ${screen} of ${last}`}>{Array.from({length:last},(_,i)=><span key={i} className={i<screen?'on':''}/>)}</div>}
   </div>}

   {current==='welcome'&&<section className="lm-welcome">
    <img className="lm-welcome-logo" src="/logo.svg" alt="Enough"/>
    <h1 ref={heading} tabIndex={-1}>Exercise that fits your vibe.</h1>
    <p>Show us what life looks like. We’ll find where movement fits.</p>
   </section>}

   {current==='contexts'&&<section>
    <h1 ref={heading} tabIndex={-1}>What fills your week?</h1>
    <p className="lm-sub">Pick anything that’s regularly part of your life.</p>
    <div className="lm-tiles">{lifeContexts.map((c:LifeContext)=>{const card=contextCards[c];const on=map.contexts.includes(c);
     return <button key={c} type="button" className="lm-tile" aria-pressed={on} onClick={()=>change({...map,contexts:toggle(map.contexts,c)})}>
      <span className="lm-tile-art"><Illustration category={card.image}/></span>
      <span className="lm-tile-text"><strong>{card.title}</strong><small>{card.text}</small></span>
      <span className="lm-tick" aria-hidden="true">{on&&<Check size={14} strokeWidth={3}/>}</span>
     </button>})}</div>
   </section>}

   {current==='moments'&&<section>
    <h1 ref={heading} tabIndex={-1}>What happens a lot?</h1>
    <p className="lm-sub">These are the moments where Enough might find something.</p>
    <div className="lm-pills">{[...moments.likely,...(showMore?moments.other:[])].map((m:RecurringMoment)=><button key={m} type="button" aria-pressed={map.moments.includes(m)} onClick={()=>change({...map,moments:toggle(map.moments,m)})}>{momentLabels[m]}</button>)}
     <button type="button" aria-pressed={other} onClick={()=>{setOther(!other);if(other)change({...map,otherMoment:undefined});}}>Something else</button></div>
    {!showMore&&moments.other.length>0&&<button type="button" className="text-button lm-more" onClick={()=>setShowMore(true)}>Show more moments</button>}
    {other&&<label className="lm-field">What else happens a lot?<input maxLength={120} value={map.otherMoment||''} onChange={e=>change({...map,otherMoment:e.target.value||undefined})} placeholder="Band practice, visiting Dad…"/></label>}
   </section>}

   {current==='permissions'&&<section>
    <h1 ref={heading} tabIndex={-1}>Where could movement sneak in?</h1>
    <p className="lm-sub">There’s no right answer. We’re finding the moments that wouldn’t annoy you.</p>
    <div className="lm-scenarios">{shownScenarios.map(s=><fieldset key={s.id} className="lm-scenario"><legend>{s.prompt}</legend>
     <div className="lm-options">{permissionLevels.map(level=><button key={level} type="button" aria-pressed={map.permissions[s.id]===level} onClick={()=>change({...map,permissions:{...map.permissions,[s.id]:level}})}>{s.options[level]}</button>)}</div>
    </fieldset>)}</div>
   </section>}

   {current==='styles'&&<section>
    <h1 ref={heading} tabIndex={-1}>What sounds least annoying?</h1>
    <p className="lm-sub">Forget workouts. What kinds of movement actually suit you?</p>
    <div className="lm-tiles">{movementStyles.map((s:MovementStyle)=>{const card=styleCards[s];const on=map.styles.includes(s);
     return <button key={s} type="button" className="lm-tile" aria-pressed={on} onClick={()=>change({...map,styles:toggle(map.styles,s)})}>
      <span className="lm-tile-art"><Illustration category={card.image} variant={1}/></span>
      <span className="lm-tile-text"><strong>{card.title}</strong><small>{card.text}</small></span>
      <span className="lm-tick" aria-hidden="true">{on&&<Check size={14} strokeWidth={3}/>}</span>
     </button>})}</div>
   </section>}

   {current==='hard-nos'&&<section>
    <h1 ref={heading} tabIndex={-1}>Anything we should never suggest?</h1>
    <p className="lm-sub">We’ll keep these out of your recommendations.</p>
    <div className="lm-pills">{hardNos.map((n:HardNo)=><button key={n} type="button" aria-pressed={map.hardNos.includes(n)} onClick={()=>change({...map,hardNos:toggle(map.hardNos,n),hardNosAnswered:true})}>{hardNoLabels[n]}</button>)}
     <button type="button" aria-pressed={map.hardNosAnswered&&!map.hardNos.length} onClick={()=>change({...map,hardNos:[],hardNosAnswered:true})}>Nothing comes to mind</button></div>
   </section>}

   {current==='extra-time'&&<section>
    <h1 ref={heading} tabIndex={-1}>How much extra time is okay?</h1>
    <p className="lm-sub">“None” is a perfectly good answer. There’s plenty hiding inside what you already do.</p>
    <div className="lm-choices">{extraTimeChoices.map((c:ExtraTime)=><button key={c} type="button" aria-pressed={extraChosen&&map.extraTime===c&&!(adaptive&&fitting.extraTimeVaries)} onClick={()=>{setExtraChosen(true);change(adaptive?{...map,extraTime:c,fitting:{...fitting,extraTimeVaries:false}}:{...map,extraTime:c});}}><strong>{extraTimeOptions[c].title}</strong><small>{extraTimeOptions[c].text}</small></button>)}
     {/* Compatibility: "Depends on the day" gives the suggestion engine the middle setting it already understands. */}
     {adaptive&&<button type="button" aria-pressed={extraChosen&&!!fitting.extraTimeVaries} onClick={()=>{setExtraChosen(true);change({...map,extraTime:'few',fitting:{...fitting,extraTimeVaries:true}});}}><strong>Depends on the day</strong><small>Some days there’s room, some days there isn’t.</small></button>}</div>
   </section>}

   {current==='friction'&&<section>
    <h1 ref={heading} tabIndex={-1}>What tends to get in the way?</h1>
    <p className="lm-sub">Enough plans around these. It won’t change what it suggests, just how much it asks.</p>
    <div className="lm-pills">{frictions.map((f:Friction)=><button key={f} type="button" aria-pressed={!!fitting.friction?.includes(f)} onClick={()=>change({...map,fitting:{...fitting,friction:toggle(fitting.friction||[],f),frictionAnswered:true}})}>{frictionLabels[f]}</button>)}
     <button type="button" aria-pressed={!!fitting.frictionAnswered&&!fitting.friction?.length} onClick={()=>change({...map,fitting:{...fitting,friction:[],frictionAnswered:true}})}>Nothing in particular</button></div>
   </section>}

   {current==='feel'&&<section>
    <h1 ref={heading} tabIndex={-1}>How do exercise goals usually feel?</h1>
    <p className="lm-sub">No wrong answers. This changes how Enough talks to you.</p>
    <div className="lm-choices lm-choices-compact">{goalFeelings.map(g=><button key={g} type="button" aria-pressed={fitting.goalFeel===g} onClick={()=>change({...map,fitting:{...fitting,goalFeel:g}})}><strong>{goalFeelLabels[g]}</strong></button>)}</div>
    <h2 className="lm-subheading">How should Enough suggest things?</h2>
    <div className="lm-choices lm-choices-compact">{suggestStyles.map(t=><button key={t} type="button" aria-pressed={fitting.suggestStyle===t} onClick={()=>change({...map,fitting:{...fitting,suggestStyle:t}})}><strong>{suggestStyleLabels[t]}</strong></button>)}</div>
   </section>}

   {current==='payoff'&&<section>
    <h1 ref={heading} tabIndex={-1}>We found movement hiding in your week.</h1>
    <p className="lm-sub">Does this sound like you?</p>
    <div className="lm-payoff">{shown.map(r=><OpportunityCard key={r.opportunity.id} ranked={r} copy={cardCopy(r)} variant="payoff" acceptLabel="That’s me" rejectLabel="Not really" accepted={responses[r.opportunity.id]==='accept'}
     onAccept={()=>{setResponses({...responses,[r.opportunity.id]:'accept'});onPayoff(r,'accept');}}
     onReject={()=>{setResponses({...responses,[r.opportunity.id]:'reject'});onPayoff(r,'reject');setRejected([...rejected,r.opportunity.id]);}}/>)}</div>
    {!shown.length&&<p className="lm-note">Nothing fits yet with these answers, and that’s fine. You can change them any time in My Enough.</p>}
   </section>}

   <div className="lm-footer">
    <button type="button" className="primary lm-cta" disabled={!valid} onClick={next}>{cta}</button>
    {!valid&&current==='contexts'&&<p className="lm-note">Pick at least one.</p>}
    {!valid&&current==='hard-nos'&&<p className="lm-note">Pick any, or “Nothing comes to mind”.</p>}
    {!valid&&current==='extra-time'&&<p className="lm-note">Pick one.</p>}
    {current==='welcome'&&<button type="button" className="text-button" onClick={onExit}>Not now</button>}
   </div>
  </div>
 </div>;
}
