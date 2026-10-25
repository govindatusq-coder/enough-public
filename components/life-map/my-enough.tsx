"use client";
import {contextCards,momentLabels,styleCards,hardNoLabels,extraTimeOptions,scenarios,hasLifeMap,type LifeMap} from '@/lib/life-map';
import {profilingQuestions} from '@/lib/profiling';
import type {FeedbackEvent,OpportunityMoment} from '@/lib/opportunity-log';

type Props={lifeMap?:LifeMap;feedback?:FeedbackEvent[];moments?:OpportunityMoment[];onEdit:(screen:number)=>void;onStart:()=>void};
const join=(items:string[],empty:string)=>items.length?items.join(' · '):empty;

/** My Enough: what Enough understands about where movement fits, and how it's learning. */
export function MyEnough({lifeMap,feedback,moments,onEdit,onStart}:Props){
 if(!hasLifeMap(lifeMap))return <section className="lm-my-enough">
  <header className="page-heading"><div><span className="eyebrow">WHERE MOVEMENT FITS</span><h1>My Enough</h1><p>Enough hasn’t seen the shape of your week yet.</p></div></header>
  <div className="glass-panel lm-start"><h2>Show us what life looks like.</h2><p>About a minute of tapping, and Enough starts spotting where movement fits.</p><button type="button" className="primary" onClick={onStart}>Show me</button></div>
 </section>;
 const map=lifeMap;
 const rated=(feedback||[]).length;
 const reasons=(feedback||[]).filter(f=>f.reason).length;
 const answered=Object.keys(map.profiling).length;
 const happened=(moments||[]).filter(m=>m.status==='done').length;
 const learned=answered+reasons+Object.keys(map.permissions).length+new Set((feedback||[]).map(f=>f.opportunityId)).size;
 const facts=profilingQuestions.filter(q=>map.profiling[q.id]!==undefined).map(q=>({q:q.text,a:q.options.find(o=>o.id===map.profiling[q.id])?.label||''}));
 const keen=scenarios.filter(s=>map.permissions[s.id]==='yes').map(s=>s.prompt.replace(/^You’re |^You’ve |^You need /,'').replace(/\.$/,''));
 const alone=scenarios.filter(s=>map.permissions[s.id]==='no').map(s=>s.options.no);
 const rows:{title:string;value:string;detail?:string;screen:number}[]=[
  {title:'My life',value:join(map.contexts.map(c=>contextCards[c].title),'Nothing picked yet'),detail:map.moments.length?map.moments.map(m=>momentLabels[m]).join(' · ')+(map.otherMoment?` · ${map.otherMoment}`:''):undefined,screen:1},
  {title:'What happens a lot',value:join(map.moments.slice(0,4).map(m=>momentLabels[m]),'Nothing picked yet')+(map.moments.length>4?` and ${map.moments.length-4} more`:''),screen:2},
  {title:'Where movement can sneak in',value:keen.length?`Happy to be nudged: ${scenarios.filter(s=>map.permissions[s.id]==='yes').map(s=>s.id==='kid-wait'?'kids’ activities':s.id==='listening-call'?'listening calls':s.id==='nearby-shop'?'nearby errands':s.id==='early'?'arriving early':s.id==='school-run'?'school runs':s.id==='desk'?'desk time':s.id==='tv'?'TV time':s.id).join(' · ')}`:'Nothing marked keen yet',detail:alone.length?`Leave alone: ${alone.join(' · ')}`:undefined,screen:3},
  {title:'Movement that fits me',value:join(map.styles.map(s=>styleCards[s].title),'Anything easy'),screen:4},
  {title:'Don’t suggest',value:join(map.hardNos.map(n=>hardNoLabels[n]),'Nothing ruled out'),screen:5},
  {title:'Extra time',value:map.extraTime==='none'?'Usually none':map.extraTime==='few'?'A few minutes':'Sometimes 10–15 minutes',detail:extraTimeOptions[map.extraTime].text,screen:6}
 ];
 return <section className="lm-my-enough">
  <header className="page-heading"><div><span className="eyebrow">WHERE MOVEMENT FITS</span><h1>My Enough</h1><p>What Enough understands about your week. Change anything, any time.</p></div></header>
  <div className="glass-panel lm-map-rows">{rows.map(r=><div key={r.title} className="lm-map-row"><div><h2>{r.title}</h2><p>{r.value}</p>{r.detail&&<small>{r.detail}</small>}</div><button type="button" className="text-button" onClick={()=>onEdit(r.screen)} aria-label={`Edit ${r.title}`}>Edit</button></div>)}</div>
  <div className="glass-panel lm-learning"><span className="eyebrow">ENOUGH IS LEARNING</span>
   <p className="lm-learning-figures"><span><strong>{rated}</strong> {rated===1?'idea':'ideas'} rated</span><span><strong>{learned}</strong> {learned===1?'thing':'things'} Enough has learned</span><span><strong>{happened}</strong> {happened===1?'moment':'moments'} that happened</span></p>
   {facts.length>0&&<ul className="lm-facts">{facts.slice(-4).map(f=><li key={f.q}><span>{f.q}</span><strong>{f.a}</strong></li>)}</ul>}
   <p className="lm-note">Every “I’d do that”, “Not for me” and quick question makes the next suggestion fit a little better.</p>
  </div>
  <div className="glass-panel lm-later"><span className="eyebrow">OPTIONAL, LATER</span><p>Enough doesn’t need your calendar, location or health data. One day you may be able to let it spot free moments, stay quiet when you’ve already moved, or notice what’s nearby. Always your choice.</p></div>
 </section>;
}
