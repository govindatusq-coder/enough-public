'use client';
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {Profile} from '@/lib/bear/domain/types';
import {Button} from './ui';

// Family details: so Bear knows whose note it is (Year 3 means Ava, St Mary's means Sam) and what applies (allergies).
// Everything is optional. Children already named in onboarding are filled in to start with.
type Member=NonNullable<Profile['family']>[number];
const blank=(relation:Member['relation']='child'):Member=>({name:'',relation,age:null,yearLevel:null,school:null,allergies:null,notes:null});
export function FamilyDetails(){
 const [list,setList]=useState<Member[]|null>(null);const [state,setState]=useState<'idle'|'saving'|'saved'|'error'>('idle');const [open,setOpen]=useState(false);
 useEffect(()=>{let live=true;apiGet<{profile:Profile&{people?:{role:string;name:string}[]}}>('/api/bear/profile').then(r=>{if(!live)return;const fam=r.profile.family;
  setList(fam?.length?fam:(r.profile.people||[]).filter(p=>p.name&&(p.role==='child'||p.role==='partner')).map(p=>({...blank(p.role==='partner'?'partner':'child'),name:p.name})));}).catch(()=>live&&setList([]));return()=>{live=false;};},[]);
 if(!list)return null;
 const set=(i:number,patch:Partial<Member>)=>{setState('idle');setList(l=>l!.map((m,k)=>k===i?{...m,...patch}:m));};
 const text=(v:string)=>v.trim()?v:null;
 async function save(){setState('saving');try{await apiSend('/api/bear/profile',{family:list!.filter(m=>m.name.trim()).map(m=>({...m,name:m.name.trim()}))},'PUT');setState('saved');}catch{setState('error');}}
 return <section className="section" aria-labelledby="fam"><p className="eyebrow" id="fam">Family details</p><div className="card">
  <p className="small">Helps Bear tell whose note it is and what applies. Everything here is optional.</p>
  {!open&&<div className="btn-row"><Button className="sm" variant="ghost" onClick={()=>setOpen(true)}>{list.length?`Edit (${list.length})`:'Add family details'}</Button></div>}
  {open&&<>
   {list.map((m,i)=><fieldset key={i} className="fam-member"><legend className="sr-only">Family member {i+1}</legend>
    <div className="fam-row"><label>Name<input value={m.name} onChange={e=>set(i,{name:e.target.value})} maxLength={40}/></label>
     <label>Who<select value={m.relation} onChange={e=>set(i,{relation:e.target.value as Member['relation']})}><option value="child">Child</option><option value="partner">Partner</option><option value="other">Other</option></select></label></div>
    <div className="fam-row"><label>Age<input inputMode="numeric" value={m.age??''} onChange={e=>{const n=parseInt(e.target.value,10);set(i,{age:Number.isFinite(n)&&n>=0&&n<=120?n:null});}}/></label>
     <label>Year or class<input value={m.yearLevel??''} onChange={e=>set(i,{yearLevel:text(e.target.value)})} placeholder="Year 3" maxLength={40}/></label></div>
    <label>School or centre<input value={m.school??''} onChange={e=>set(i,{school:text(e.target.value)})} maxLength={80}/></label>
    <label>Allergies or medical<input value={m.allergies??''} onChange={e=>set(i,{allergies:text(e.target.value)})} maxLength={160}/></label>
    <label>Anything else (teams, activities)<input value={m.notes??''} onChange={e=>set(i,{notes:text(e.target.value)})} maxLength={200}/></label>
    <button type="button" className="qc-link" onClick={()=>{setState('idle');setList(l=>l!.filter((_,k)=>k!==i));}}>Remove</button>
   </fieldset>)}
   <div className="btn-row"><Button className="sm" variant="ghost" onClick={()=>setList(l=>[...l!,blank(l!.some(x=>x.relation==='partner')?'child':'child')])}>Add someone</Button>
    <Button className="sm" variant="coral" disabled={state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Save'}</Button></div>
   {state==='saved'&&<p className="small" role="status">Saved.</p>}{state==='error'&&<p className="small" role="alert">That didn’t save. Try again.</p>}
  </>}
 </div></section>;
}
