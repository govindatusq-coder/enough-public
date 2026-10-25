"use client";
import {useState} from 'react';
import {movementGaveBack,periodStart,type OpportunityMoment} from '@/lib/opportunity-log';
import type {Entry} from '@/lib/journey';

const periods=['This week','This month','All time'] as const;
const minutes=(n:number)=>n<60?`${n} min`:`${Math.floor(n/60)}h${n%60?` ${n%60}m`:''}`;

/** My Wins, reframed: not workouts or streaks, but what movement gave back. */
export function OpportunityWins({moments,entries,now}:{moments?:OpportunityMoment[];entries:Entry[];now:number}){
 const [period,setPeriod]=useState<typeof periods[number]>('This week');
 const g=movementGaveBack(moments,entries,periodStart(period,new Date(now)),new Date(now));
 const lines=[
  {value:minutes(g.found),label:'movement found'},
  {value:minutes(g.insideExisting),label:'happened inside things you were already doing'},
  {value:String(g.useful),label:g.useful===1?'useful thing done while moving':'useful things done while moving'},
  {value:String(g.withPeople),label:g.withPeople===1?'walk with someone you care about':'walks with someone you care about'},
  {value:minutes(g.extraUsed),label:'extra used',prefix:'Only '}
 ];
 return <section className="glass-panel lm-wins" aria-labelledby="gave-back-title">
  <div className="lm-wins-top"><div><span className="eyebrow">MY WINS</span><h2 id="gave-back-title">What movement gave back</h2></div>
   <div className="period-control" role="group" aria-label="Period">{periods.map(p=><button key={p} type="button" aria-pressed={p===period} onClick={()=>setPeriod(p)}>{p}</button>)}</div></div>
  {g.moments===0?<p className="lm-note">Nothing yet for {period.toLowerCase()}. When something you said you’d do happens, tap “It happened” on Home and it lands here.</p>:<>
   <ul className="lm-ledger">{lines.map(l=><li key={l.label}><strong>{l.prefix||''}{l.value}</strong><span>{l.label}</span></li>)}</ul>
   <p className="lm-wins-message">You didn’t make room for exercise. Enough found room that was already there.</p>
  </>}
 </section>;
}
