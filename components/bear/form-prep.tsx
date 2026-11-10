'use client';
import {useRef,useState} from 'react';
import {apiForm,apiSend} from '@/lib/bear/client';
import type {Task} from '@/lib/bear/domain/types';

// A school permission form for this responsibility. Bear fills in what it can verify and says what is left for the parent.
// It cannot sign or send anything: the parent finishes it, signs it, sends it, and then says so.
const pretty=(n:string)=>n.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').trim();
const LABEL:Record<string,string>={parent_name:'Your name',phone:'Your mobile',email:'Your email',address:'Your address'};
type Facts={parentName?:string;phone?:string;email?:string;address?:string};const KEY:Record<string,keyof Facts>={parent_name:'parentName',phone:'phone',email:'email',address:'address'};
export function hasFormStep(task:Pick<Task,'load'>){return !!task.load?.nodes.some(n=>n.pattern==='FORM_APPLICATION');}
export function FormPrep({task,onChanged}:{task:Task;onChanged:()=>void}){
 const pf=task.preparedForm;const [busy,setBusy]=useState(false);const [msg,setMsg]=useState<string|null>(null);const [facts,setFacts]=useState<Facts>({});const [remember,setRemember]=useState(true);const [saved,setSaved]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 async function add(file:File){setBusy(true);setMsg(null);try{const form=new FormData();form.append('file',file,file.name);await apiForm(`/api/bear/tasks/${task.id}/form`,form);onChanged();}catch(e){setMsg((e as Error).message);}finally{setBusy(false);if(input.current)input.current.value='';}}
 async function update(){setBusy(true);setMsg(null);try{await apiSend(`/api/bear/tasks/${task.id}/form`,{facts,remember});setSaved(remember&&Object.values(facts).some(Boolean));setFacts({});onChanged();}catch(e){setMsg((e as Error).message);}finally{setBusy(false);}}
 async function forget(){try{await apiSend('/api/bear/tasks/'+task.id+'/form',{},'DELETE');setSaved(false);setMsg('Forgotten. Bear won’t reuse those details.');}catch(e){setMsg((e as Error).message);}}
 const details=(pf?.needsDetail||[]).filter(d=>KEY[d.role]);
 return <section className="card" style={{marginTop:10}} aria-label="Permission form">
  <p className="eyebrow">{pf?'Form ready':'Permission form'}</p>
  {!pf&&<>
   <p className="small">Have the form? Add it as a PDF and Bear will fill in what it can. You decide the rest. Bear can’t sign or send it for you.</p>
   <div className="btn-row"><input ref={input} type="file" accept="application/pdf" hidden onChange={e=>{const f=e.target.files?.[0];if(f)add(f);}}/><button type="button" className="btn ghost sm" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Reading the form…':'Add the form'}</button></div>
  </>}
  {pf&&<>
   <p style={{fontWeight:700,margin:'2px 0 0'}}>Bear filled in {pf.filled.length} thing{pf.filled.length===1?'':'s'} it could check.</p>
   {pf.needsDecision.length>0&&<p className="small" style={{margin:'6px 0 0'}}><b>Yours to decide:</b> {pf.needsDecision.slice(0,5).map(pretty).join(', ')}{pf.needsDecision.length>5?` and ${pf.needsDecision.length-5} more`:''}. Bear never ticks, signs or answers these.</p>}
   {details.length>0&&<div style={{marginTop:8}}><p className="small">Add these and Bear will fill them in:</p>
    {details.map(d=><div className="field" key={d.field}><label htmlFor={'f-'+d.field}>{LABEL[d.role]}</label><input id={'f-'+d.field} value={facts[KEY[d.role]]||''} maxLength={d.role==='address'?200:80} onChange={e=>setFacts({...facts,[KEY[d.role]]:e.target.value})}/></div>)}
    <label className="small" style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember these for next time</label>
    <div className="btn-row"><button type="button" className="btn ghost sm" disabled={busy||!Object.values(facts).some(Boolean)} onClick={update}>{busy?'One moment…':'Update the form'}</button></div></div>}
   <div className="btn-row"><a className="btn primary sm" href={`/api/bear/tasks/${task.id}/form`} download>Download the form</a></div>
   <p className="small muted" style={{marginTop:8}}>Check it, finish the rest, sign it and send it to the school. Then tap the “done” button above. Bear can’t tell that it was sent unless you say so.</p>
   {saved&&<p className="small muted" style={{marginTop:4}}>Saved for next time. <button type="button" className="btn quiet sm" onClick={forget}>Forget them</button></p>}
  </>}
  {msg&&<p className="note" role="status" style={{marginTop:8}}>{msg}</p>}
 </section>;
}
