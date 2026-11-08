'use client';
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {PackCoverage} from '@/lib/bear/coverage/coverage-service';
import {Button} from './ui';

// What Bear covers: each category Bear can keep on top of, said honestly. What Bear is handling, what
// still needs you, and what Bear can't see. Nothing here implies Bear watches anything it isn't given.
export function CoverageSettings(){
 const [v,setV]=useState<{enabled:boolean;packs:PackCoverage[]}|null>(null);const [busy,setBusy]=useState(false);
 useEffect(()=>{apiGet<{enabled:boolean;packs:PackCoverage[]}>('/api/bear/coverage').then(setV).catch(()=>setV(null));},[]);
 if(!v?.enabled||!v.packs.length)return null;
 async function toggle(p:PackCoverage){setBusy(true);try{setV(await apiSend('/api/bear/coverage',{pack:p.id,active:!p.active}));}finally{setBusy(false);}}
 return <section className="section" aria-labelledby="covers"><p className="eyebrow" id="covers">What Bear covers</p>{v.packs.map(p=><div key={p.id} className="card coverage-card">
  <div className="coverage-head"><p style={{fontWeight:700}}>{p.name}</p><Button className="sm" variant={p.active?'quiet':'primary'} disabled={busy} onClick={()=>toggle(p)}>{p.active?'Turn off':'Keep it together'}</Button></div>
  {p.active?<>
   <p className="small" style={{marginTop:8,fontWeight:600}}>Bear is handling</p>{p.handling.map(l=><p key={l} className="small muted">· {l}</p>)}
   <p className="small" style={{marginTop:8,fontWeight:600}}>Still needs you</p>{p.needsYouLines.map(l=><p key={l} className="small muted">· {l}</p>)}
   <p className="small" style={{marginTop:8,fontWeight:600}}>Bear can’t see</p>{p.cannotSee.map(l=><p key={l} className="small muted">· {l}</p>)}
  </>:<p className="small muted" style={{marginTop:6}}>Bear groups school notices you give it, keeps every deadline, and shows what still needs you in one place.</p>}
 </div>)}</section>;
}
