"use client";
import {useState} from 'react';
import {movementGaveBack,periodStart,type OpportunityMoment} from '@/lib/opportunity-log';
import {winsLedger,type FollowThroughEvent} from '@/lib/follow-through';
import type {AdaptiveMovementCommitment} from '@/lib/goal-fitting';
import type {Entry} from '@/lib/journey';

const periods=['This week','This month','All time'] as const;
const minutes=(n:number)=>n<60?`${n} min`:`${Math.floor(n/60)}h${n%60?` ${n%60}m`:''}`;
type Adaptive={events?:FollowThroughEvent[];commitments?:AdaptiveMovementCommitment[]};

/** My Wins, reframed: not workouts or streaks, but what movement gave back. */
export function OpportunityWins({moments,entries,now,adaptive}:{moments?:OpportunityMoment[];entries:Entry[];now:number;adaptive?:Adaptive}){
 const [period,setPeriod]=useState<typeof periods[number]>('This week');
 const since=periodStart(period,new Date(now));
 const g=movementGaveBack(moments,entries,since,new Date(now));
 const ledger=adaptive?winsLedger({moments,entries,events:adaptive.events,commitments:adaptive.commitments,since,now:new Date(now)}):null;
 const lines=[
  {value:minutes(g.found),label:'movement found'},
  {value:minutes(g.insideExisting),label:'happened inside things you were already doing'},
  {value:String(g.useful),label:g.useful===1?'useful thing done while moving':'useful things done while moving'},
  {value:String(g.withPeople),label:g.withPeople===1?'walk with someone you care about':'walks with someone you care about'},
  {value:minutes(g.extraUsed),label:'extra used',prefix:'Only '}
 ];
 const empty=ledger?ledger.used===0:g.moments===0;
 return <section className="glass-panel lm-wins" aria-labelledby="gave-back-title">
  <div className="lm-wins-top"><div><span className="eyebrow">MY WINS</span><h2 id="gave-back-title">What movement gave back</h2></div>
   <div className="period-control" role="group" aria-label="Period">{periods.map(p=><button key={p} type="button" aria-pressed={p===period} onClick={()=>setPeriod(p)}>{p}</button>)}</div></div>
  {empty?<p className="lm-note">Nothing yet for {period.toLowerCase()}. {ledger?'When one of yours happens, or you do something else, it lands here.':'When something you said you’d do happens, tap “It happened” on Home and it lands here.'}</p>
  :ledger?<>
   <ul className="lm-ledger lm-ledger-lines">{ledger.lines.map(l=><li key={l.title}><span>{l.title}{l.times>1?` · ${l.times} times`:''}</span><strong>{minutes(l.minutes)}</strong></li>)}</ul>
   <ul className="lm-ledger lm-ledger-totals">
    <li><strong>{minutes(ledger.movement)}</strong><span>movement</span></li>
    <li><strong>{minutes(ledger.extra)}</strong><span>extra time</span></li>
    <li><strong>{ledger.used}</strong><span>{ledger.used===1?'opportunity used':'opportunities used'}</span></li>
   </ul>
   <p className="lm-wins-message">{ledger.insideExisting*2>=ledger.movement?'Most of this fitted into things you were already doing.':'Every bit of this counts, however it fitted in.'}</p>
  </>:<>
   <ul className="lm-ledger">{lines.map(l=><li key={l.label}><strong>{l.prefix||''}{l.value}</strong><span>{l.label}</span></li>)}</ul>
   <p className="lm-wins-message">You didn’t make room for exercise. Enough found room that was already there.</p>
  </>}
 </section>;
}
