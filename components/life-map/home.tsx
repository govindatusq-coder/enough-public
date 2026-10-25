"use client";
import {useMemo,useState} from 'react';
import {hasLifeMap,emptyLifeMap,type LifeMap} from '@/lib/life-map';
import {diversify,rank,rightNow,situationsFor,situationLabels,stealOptions,type Ranked} from '@/lib/opportunity-engine';
import {cardCopy} from '@/lib/opportunity-copy';
import {plannedMoments,type FeedbackEvent,type OpportunityMoment,type Situation} from '@/lib/opportunity-log';
import {opportunityById,fillMinutes} from '@/lib/opportunities';
import {nextProfilingQuestion} from '@/lib/profiling';
import {OpportunityCard} from './opportunity-card';
import {usePersonalisedCopy} from './use-personalised-copy';
import type {OpportunityActions} from './actions';

type Props={lifeMap?:LifeMap;feedback?:FeedbackEvent[];moments?:OpportunityMoment[];now:number;name?:string;aiWording:boolean;actions:OpportunityActions;onStart:()=>void};

function greeting(now:Date){const h=now.getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}

/** Home: where could movement fit today? Three strong ideas, not a feed. */
export function OpportunityHome({lifeMap,feedback,moments,now,name,aiWording,actions,onStart}:Props){
 const date=new Date(now),ready=hasLifeMap(lifeMap),map=lifeMap||emptyLifeMap();
 const input={lifeMap:map,feedback,moments,now:date};
 // Planned ideas live in their own list below, so Home always has fresh ones.
 const picks=useMemo(()=>{const planned=new Set(plannedMoments(moments).map(m=>m.opportunityId));return diversify(rank(input).filter(r=>!planned.has(r.opportunity.id)),3);},[map,feedback,moments,Math.floor(now/36e5)]);
 const top=useMemo(()=>rank(input).slice(0,12).map(r=>r.opportunity),[map,feedback,Math.floor(now/36e5)]);
 const question=ready?nextProfilingQuestion(map,top,date):null;
 const [best,...others]=picks;
 const bestCopy=usePersonalisedCopy(best||null,aiWording&&ready);
 const planned=plannedMoments(moments).slice(-4).reverse();
 const [notice,setNotice]=useState('');

 return <div className="lm-home">
  <header className="lm-home-heading">
   <span className="eyebrow">{greeting(date).toUpperCase()}{name?`, ${name.toUpperCase()}`:''}</span>
   <h1>Where could movement fit today?</h1>
   {!ready&&<p>Show us what life looks like and Enough will find where movement fits. It takes about a minute.</p>}
  </header>

  {!ready&&<section className="glass-panel lm-start"><h2>Exercise hiding in your life.</h2><p>No plans, no workouts, no tracking. A few taps about your week and Enough starts noticing the easy moments.</p><button type="button" className="primary" onClick={onStart}>Show me</button></section>}

  <p className="lm-notice" role="status">{notice}</p>
  {best&&bestCopy&&<section aria-labelledby="best-fit-label">
   <h2 id="best-fit-label" className="lm-section-label">{ready?'Best fit':'A few that fit most weeks'}</h2>
   <OpportunityCard key={best.opportunity.id} ranked={best} copy={bestCopy} variant="hero" eyebrow={best.matchedMoment?undefined:'WORTH A LOOK'} askReason onAccept={()=>{actions.accept(best,'home');setNotice(`“${bestCopy.title}” is in your list below. Tap “It happened” when it does.`);}} onReject={reason=>actions.reject(best,'home',undefined,reason)}/>
  </section>}

  {others.length>0&&<section aria-labelledby="other-ways-label">
   <h2 id="other-ways-label" className="lm-section-label">Other ways movement could fit</h2>
   <div className="lm-compact-list">{others.map(r=><OpportunityCard key={r.opportunity.id} ranked={r} copy={cardCopy(r)} variant="compact" askReason onAccept={()=>{actions.accept(r,'home');setNotice(`“${r.opportunity.title}” is in your list below. Tap “It happened” when it does.`);}} onReject={reason=>actions.reject(r,'home',undefined,reason)}/>)}</div>
  </section>}

  {ready&&!picks.length&&<section className="glass-panel lm-empty"><h2>Room to breathe.</h2><p>Nothing in the library fits your answers right now, and that’s fine. You can loosen anything in My Enough if life changes.</p></section>}

  <RightNow lifeMap={map} feedback={feedback} moments={moments} now={now} aiWording={aiWording&&ready} actions={actions}/>

  {planned.length>0&&<section className="glass-panel lm-planned" aria-labelledby="planned-label">
   <h2 id="planned-label">You said you’d do these</h2>
   <p className="lm-note">Did any of them happen? Only the ones that did show up in My Wins.</p>
   <ul>{planned.map(m=>{const o=opportunityById(m.opportunityId);if(!o)return null;return <li key={m.id}>
    <div><strong>{o.title}</strong><span>{fillMinutes(o.action,m.minutes)}</span></div>
    <div className="lm-planned-actions"><button type="button" className="secondary" onClick={()=>actions.resolve(m.id,true)}>It happened</button><button type="button" className="lm-quiet" onClick={()=>actions.resolve(m.id,false)}>Not this time</button></div>
   </li>})}</ul>
  </section>}

  {question&&<section className="glass-panel lm-question" aria-labelledby="quick-one">
   <span className="eyebrow" id="quick-one">QUICK ONE</span>
   <p>{question.text}</p>
   <div className="lm-pills">{question.options.map(o=><button key={o.id} type="button" onClick={()=>actions.answer(question.id,o.id)}>{o.label}</button>)}</div>
   <button type="button" className="text-button" onClick={()=>actions.dismiss(question.id)}>Not now</button>
  </section>}

  <p className="lm-footnote">Enough works from what you’ve told it. No calendar, location or health data needed.</p>
 </div>;
}

/** "Find something that fits right now": one question, maybe two, one answer. */
export function RightNow({lifeMap,feedback,moments,now,aiWording,actions}:{lifeMap:LifeMap;feedback?:FeedbackEvent[];moments?:OpportunityMoment[];now:number;aiWording:boolean;actions:OpportunityActions}){
 const [open,setOpen]=useState(false),[situation,setSituation]=useState<Situation|null>(null),[steal,setSteal]=useState<number|null>(null),[skipped,setSkipped]=useState<string[]>([]);
 const result:Ranked|null=useMemo(()=>{
  if(!situation||steal===null)return null;
  const exclude=new Set(skipped);
  const first=rightNow({lifeMap,feedback,moments,now:new Date(now),library:undefined},situation,steal);
  if(first&&!exclude.has(first.opportunity.id))return first;
  return rank({lifeMap,feedback,moments,now:new Date(now)},{situation,extraAllowance:steal}).find(r=>!exclude.has(r.opportunity.id))||null;
 },[situation,steal,skipped,lifeMap,feedback]);
 const copy=usePersonalisedCopy(result,aiWording,situation||undefined,steal??undefined);
 const reset=()=>{setSituation(null);setSteal(null);setSkipped([]);};
 if(!open)return <button type="button" className="glass-panel lm-right-now-open" onClick={()=>setOpen(true)}><strong>Find something that fits right now</strong><span>Tell Enough what’s happening. You’ll get one idea.</span></button>;
 return <section className="glass-panel lm-right-now" aria-labelledby="right-now-title">
  <div className="lm-right-now-top"><h2 id="right-now-title">Right now</h2><button type="button" className="text-button" onClick={()=>{setOpen(false);reset();}}>Close</button></div>
  {!situation&&<><p>What’s happening?</p><div className="lm-pills">{situationsFor(lifeMap).map(s=><button key={s} type="button" onClick={()=>setSituation(s)}>{situationLabels[s]}</button>)}</div></>}
  {situation&&steal===null&&<><p>How much time can movement steal?</p><div className="lm-pills">{stealOptions.map(o=><button key={o.id} type="button" onClick={()=>setSteal(o.minutes)}>{o.label}</button>)}</div><button type="button" className="text-button" onClick={()=>setSituation(null)}>Back</button></>}
  {situation&&steal!==null&&(result&&copy?<>
   <OpportunityCard key={result.opportunity.id} ranked={result} copy={copy} variant="hero" eyebrow={situationLabels[situation].toUpperCase()} onAccept={()=>actions.accept(result,'right-now',situation)} askReason onReject={reason=>{actions.reject(result,'right-now',situation,reason);setSkipped([...skipped,result.opportunity.id]);}}/>
   <button type="button" className="text-button" onClick={reset}>Something else is happening</button>
  </>:<><p>Nothing fits that moment within your answers. Sometimes the right amount of movement is none.</p><button type="button" className="text-button" onClick={reset}>Try a different moment</button></>)}
 </section>;
}
