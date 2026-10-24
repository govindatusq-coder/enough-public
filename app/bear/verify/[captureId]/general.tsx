'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiSend,ApiError} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {areaLabels} from '@/lib/bear/domain/labels';
import type {ExtractedEntity,Task} from '@/lib/bear/domain/types';
import {BearHead} from '@/components/bear/art';
import {Button,ErrorCard} from '@/components/bear/ui';

const kindLabel:Record<string,string>={appointment:'Appointment',school:'School',form:'Form to deal with',errand:'Errand',shopping:'Shopping',message:'From a message',note:'Note',event:'Event',other:'Task'};
type Key='title'|'area'|'when'|'timeOfDay'|'person'|'location'|'isRecurring';
export function GeneralVerify({extraction,documentUrl,isDemo}:{extraction:ExtractedEntity;documentUrl:string|null;isDemo:boolean}){
 const router=useRouter();const g=extraction.general;
 const [v,setV]=useState<Record<Key,string|boolean|null>>({title:g.title.value||'',area:g.area.value||'',when:g.when.value||'',timeOfDay:g.timeOfDay.value||'',person:g.person.value||'',location:g.location.value||'',isRecurring:g.isRecurring.value});
 const [notes,setNotes]=useState(g.summary||'');const [confirmed,setConfirmed]=useState<Set<string>>(new Set());const [answered,setAnswered]=useState<Set<string>>(new Set());const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [includeSteps,setIncludeSteps]=useState(true);
 const questions=extraction.questions.filter(q=>!answered.has(q.field));
 const set=(k:Key,val:string|boolean|null)=>{setV(x=>({...x,[k]:val}));setConfirmed(c=>new Set(c).add(k));};
 const answer=(field:string,value:unknown)=>{setAnswered(a=>new Set(a).add(field));if(value===null){setTimeout(()=>document.getElementById('g-'+field)?.focus(),50);return;}set(field as Key,value as string);};
 const unsure=(k:Key)=>{const t=g[k];return t.value!==null&&t.confidence<0.75&&!confirmed.has(k);};
 async function confirm(){setBusy(true);setError(null);
  const corrections:Record<string,unknown>={};
  const cmp=(k:Key,val:unknown)=>{if(JSON.stringify(val)!==JSON.stringify(g[k].value))corrections[k]=val;};
  cmp('title',String(v.title).trim());if(v.area)cmp('area',v.area);cmp('when',v.when?String(v.when):null);cmp('timeOfDay',v.timeOfDay?String(v.timeOfDay):null);cmp('person',v.person?String(v.person).trim():null);cmp('location',v.location?String(v.location).trim():null);if(typeof v.isRecurring==='boolean')cmp('isRecurring',v.isRecurring);
  if(notes.trim()!==(g.summary||''))corrections.notes=notes.trim()||null;
  const confirmedFields=['title','area','when','timeOfDay','person','location','isRecurring'].filter(k=>!(k in corrections));
  try{const res=await apiSend<{task:Task}>('/api/bear/tasks/confirm',{extractionId:extraction.id,corrections,confirmedFields,includeSteps});router.replace(`/bear/tasks/${res.task.id}?plan=1`);}
  catch(e){setError((e as ApiError).message);setBusy(false);}
 }
 return (<>
  <div className="card" style={{marginTop:16}}>
   <p className="eyebrow">{kindLabel[g.kind]||'Task'}{isDemo&&<span className="demo-tag" style={{marginLeft:8}}>Example</span>}</p>
   <h2>{v.title||'Something for Bear to hold'}</h2>
   <p className="muted" style={{marginTop:6}}>{v.when?`${formatAU(String(v.when))}${v.timeOfDay?' · '+v.timeOfDay:''}`:'No date yet'}{v.area?` · ${areaLabels[String(v.area)]}`:''}{v.person?` · for ${v.person}`:''}</p>
   {g.summary&&<p className="small faint" style={{marginTop:8}}>{g.summary}</p>}
   {documentUrl&&<a href={documentUrl} target="_blank" rel="noreferrer" className="pill" style={{marginTop:12}}>View original</a>}
  </div>
  {questions.length>0&&<div className="glass" style={{padding:18,marginTop:14}}><div style={{display:'flex',gap:12,alignItems:'flex-start'}}><BearHead size={56}/><div style={{flex:1}}>
   <p className="hand" style={{fontSize:20}}>{questions.length===1?"One thing I'm not sure about:":"A couple of things I'm not sure about:"}</p>
   {questions.slice(0,1).map(q=><div key={q.field} style={{marginTop:8}}><p style={{fontWeight:600}}>{q.question}</p><div className="btn-row">{q.options.map((o,i)=><Button key={i} variant={i===0&&o.value!==null?'primary':'ghost'} className="sm" onClick={()=>answer(q.field,o.value)}>{o.label}</Button>)}</div></div>)}
  </div></div></div>}
  <div className="section">
   <p className="eyebrow">The details</p>
   <div className={`field ${unsure('title')?'unsure':''}`}><label htmlFor="g-title">What is it?{unsure('title')&&<span className="pill mustard" style={{marginLeft:8}}>Not sure</span>}</label><input id="g-title" value={String(v.title)} onChange={e=>set('title',e.target.value)} maxLength={120} placeholder="Book Ava's dentist"/></div>
   <div className={`field ${unsure('area')?'unsure':''}`}><label htmlFor="g-area">Part of life</label><select id="g-area" value={String(v.area)} onChange={e=>set('area',e.target.value||null)}><option value="">Choose…</option>{Object.entries(areaLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
    <div className={`field ${unsure('when')?'unsure':''}`}><label htmlFor="g-when">When{unsure('when')&&<span className="pill mustard" style={{marginLeft:8}}>Not sure</span>}</label><input id="g-when" type="date" value={String(v.when)} onChange={e=>set('when',e.target.value)}/><span className="hint">Leave blank if there&rsquo;s no date.</span></div>
    <div className="field"><label htmlFor="g-time">Time</label><input id="g-time" type="time" value={String(v.timeOfDay)} onChange={e=>set('timeOfDay',e.target.value)}/></div>
   </div>
   <div className="field"><label htmlFor="g-person">Who it&rsquo;s for</label><input id="g-person" value={String(v.person)} onChange={e=>set('person',e.target.value)} maxLength={80} placeholder="Ava"/></div>
   <div className="field"><label htmlFor="g-location">Where</label><input id="g-location" value={String(v.location)} onChange={e=>set('location',e.target.value)} maxLength={160}/></div>
   <div className="field"><label htmlFor="g-notes">Notes</label><textarea id="g-notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} style={{minHeight:90}}/></div>
   <div className="field"><label htmlFor="g-rec">Happens regularly</label><select id="g-rec" value={v.isRecurring===true?'yes':v.isRecurring===false?'no':''} onChange={e=>set('isRecurring',e.target.value===''?null:e.target.value==='yes')}><option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></div>
   {g.steps.length>0&&<div className="note plain" style={{marginTop:14}}><div><p style={{fontWeight:600}}>Bear can break this into steps</p><ul style={{margin:'6px 0 0 18px',padding:0}}>{g.steps.map(s=><li key={s} className="small">{s}</li>)}</ul><label style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}><input type="checkbox" checked={includeSteps} onChange={e=>setIncludeSteps(e.target.checked)} style={{width:20,height:20}}/> Keep the steps</label></div></div>}
  </div>
  {error&&<div style={{marginTop:14}}><ErrorCard message={error}/></div>}
  <div className="btn-stack"><Button variant="coral" disabled={busy||!String(v.title).trim()} onClick={confirm}>{busy?'One moment…':"Yep, Bear's got it"}</Button></div>
 </>);
}
