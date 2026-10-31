'use client';
import {useCallback,useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {valueAreas,type ValueArea,type ValuesGoalsMap,type UserGoal} from '@/lib/bear/priority/types';
import {Button,Chip} from './ui';

// What matters to you: the values and goals behind Bear's sense of importance. Bear's guesses are
// shown as guesses; nothing counts as confirmed until the person taps it.
const label:Record<ValueArea,string>={family:'Family',relationships:'Relationships',career:'Career',financial_security:'Money security',health:'Health',home:'Home',learning:'Learning',independence:'Life admin under control',community:'Community',rest:'Rest',enjoyment:'Enjoyment',creativity:'Creativity',parenting:'Parenting',caregiving:'Caring for others'};
const kinds:{key:UserGoal['kind'];label:string}[]=[{key:'goal',label:'A goal'},{key:'responsibility',label:'A responsibility'},{key:'non_negotiable',label:'Must not slip'}];
export function ValuesEditor({onSaid}:{onSaid:(s:string)=>void}){
 const [data,setData]=useState<{saved:ValuesGoalsMap;effective:ValuesGoalsMap}|null>(null);const [text,setText]=useState('');const [kind,setKind]=useState<UserGoal['kind']>('goal');const [busy,setBusy]=useState(false);
 const load=useCallback(()=>apiGet<{saved:ValuesGoalsMap;effective:ValuesGoalsMap}>('/api/bear/values').then(setData).catch(()=>{}),[]);
 useEffect(()=>{load();},[load]);
 if(!data)return null;
 const confirmed=new Set(data.saved.values.filter(v=>v.source==='user'&&v.confidence>0).map(v=>v.key));
 const guesses=data.effective.values.filter(v=>v.source==='inferred'&&!confirmed.has(v.key));
 async function save(next:ValuesGoalsMap){setBusy(true);try{setData(await apiSend('/api/bear/values',next,'PUT'));}catch(e){onSaid((e as Error).message);}finally{setBusy(false);}}
 const toggle=(k:ValueArea)=>{const rest=data.saved.values.filter(v=>v.key!==k);save({...data.saved,values:confirmed.has(k)?[...rest,{key:k,source:'user',confidence:0}]:[...rest,{key:k,source:'user',confidence:1}]});};
 const addGoal=()=>{if(!text.trim())return;save({...data.saved,goals:[...data.saved.goals,{id:Math.random().toString(36).slice(2,10),text:text.trim(),kind,area:null,createdAt:new Date().toISOString()}]});setText('');};
 return (
  <section className="section" aria-labelledby="matters"><p className="eyebrow" id="matters">What matters to you</p><div className="card">
   <p className="small">Bear uses this to tell what&rsquo;s important from what&rsquo;s merely loud. It never decides how to do things from it.</p>
   <div className="chips" style={{marginTop:10}} role="group" aria-label="Values">{valueAreas.map(k=><Chip key={k} label={label[k]} selected={confirmed.has(k)} onToggle={()=>!busy&&toggle(k)}/>)}</div>
   {guesses.length>0&&<p className="small muted" style={{marginTop:8}}>Bear&rsquo;s guess so far: {guesses.map(g=>label[g.key]).join(', ')}. Tap one above to confirm it.</p>}
   <p className="small" style={{marginTop:14,fontWeight:700}}>Goals and things that must not slip</p>
   {data.saved.goals.map(g=><div key={g.id} className="row"><span className="grow"><span className="title">{g.text}</span><br/><span className="faint">{kinds.find(k=>k.key===g.kind)?.label}</span></span><button type="button" className="step-x" aria-label={`Remove ${g.text}`} disabled={busy} onClick={()=>save({...data.saved,goals:data.saved.goals.filter(x=>x.id!==g.id)})}>×</button></div>)}
   <div className="field"><label htmlFor="goal-text">Add one</label><input id="goal-text" placeholder="e.g. Maintain my professional registration" value={text} maxLength={120} onChange={e=>setText(e.target.value)}/></div>
   <div className="chips" style={{marginTop:8}}>{kinds.map(k=><Chip key={k.key} label={k.label} selected={kind===k.key} onToggle={()=>setKind(k.key)}/>)}</div>
   <div className="btn-row"><Button className="sm" variant="ghost" disabled={busy||!text.trim()} onClick={addGoal}>Add</Button></div>
  </div></section>
 );
}
