"use client";
import {useMemo,useState} from 'react';
import {emptyLifeMap,momentLabels,type LifeMap,type RecurringMoment} from '@/lib/life-map';
import {rank,type Ranked} from '@/lib/opportunity-engine';
import {cardCopy} from '@/lib/opportunity-copy';
import {plannedMoments,type FeedbackEvent,type OpportunityMoment} from '@/lib/opportunity-log';
import {OpportunityCard} from './opportunity-card';
import type {OpportunityActions} from './actions';

const filters=['All','No extra time','Under 5 minutes','With people','Useful'] as const;
type Filter=typeof filters[number];
const keep=(r:Ranked,f:Filter)=>f==='No extra time'?r.extraMinutes===0:f==='Under 5 minutes'?r.minutes<=5:f==='With people'?r.opportunity.movementTypes.includes('people'):f==='Useful'?r.opportunity.movementTypes.includes('useful'):true;

/** My Moves → Explore: everything that fits, grouped by the moment it lives in. */
export function OpportunityBrowse({lifeMap,feedback,moments,now,actions,onClassic}:{lifeMap?:LifeMap;feedback?:FeedbackEvent[];moments?:OpportunityMoment[];now:number;actions:OpportunityActions;onClassic:()=>void}){
 const [filter,setFilter]=useState<Filter>('All');
 const [accepted,setAccepted]=useState<string[]>([]);
 const map=lifeMap||emptyLifeMap();
 // Feedback changes the order next visit, not while you're reading the list.
 const ranked=useMemo(()=>rank({lifeMap:map,feedback,moments,now:new Date(now)}),[map]);
 const planned=new Set(plannedMoments(moments).map(m=>m.opportunityId));
 const shown=ranked.filter(r=>keep(r,filter));
 const groups=new Map<RecurringMoment,Ranked[]>();
 for(const r of shown){const m=r.matchedMoment||r.opportunity.moments[0];groups.set(m,[...(groups.get(m)||[]),r]);}
 return <section className="lm-browse" aria-label="Movement that fits your week">
  <div className="discovery-filters" role="group" aria-label="Filter">{filters.map(f=><button key={f} type="button" aria-pressed={f===filter} onClick={()=>setFilter(f)}>{f}</button>)}</div>
  <p className="lm-note">{shown.length} {shown.length===1?'idea fits':'ideas fit'} your answers{filter==='All'?'':' · '+filter.toLowerCase()}. Your “don’t suggest” list always applies.</p>
  {[...groups.entries()].map(([moment,items])=><div key={moment} className="lm-group">
   <h2 className="lm-section-label">{momentLabels[moment]}</h2>
   <div className="lm-compact-list">{items.map(r=><OpportunityCard key={r.opportunity.id} ranked={r} copy={cardCopy(r)} variant="compact" accepted={planned.has(r.opportunity.id)||accepted.includes(r.opportunity.id)} askReason
    onAccept={()=>{actions.accept(r,'browse');setAccepted([...accepted,r.opportunity.id]);}} onReject={reason=>actions.reject(r,'browse',undefined,reason)}/>)}</div>
  </div>)}
  {!shown.length&&<div className="glass-empty"><h2>Nothing with that filter.</h2><button type="button" className="secondary" onClick={()=>setFilter('All')}>Show everything that fits</button></div>}
  <p className="lm-classic"><button type="button" className="text-button" onClick={onClassic}>Browse the classic idea library</button></p>
 </section>;
}
