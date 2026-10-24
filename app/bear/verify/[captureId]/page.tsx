'use client';
import {use,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend,ApiError} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import {formatAUD} from '@/lib/bear/domain/money';
import {formatAU} from '@/lib/bear/domain/dates';
import {billCategories,recurrences,type Bill,type BillFieldKey,type Capture,type ExtractedEntity} from '@/lib/bear/domain/types';
import {categoryLabels} from '@/lib/bear/domain/labels';
import {BearHead} from '@/components/bear/art';
import {Button,ErrorCard,Skeleton,Toast,TopBar} from '@/components/bear/ui';

type Loaded={capture:Capture;extraction:ExtractedEntity|null;document:{id:string;name:string;mime:string;url:string}|null;duplicate:{id:string;biller:string;dueAt:string|null;amountCents:number;status:string}|null};
const editable:{key:BillFieldKey;label:string;type:'text'|'money'|'date'|'category'|'recurrence'|'bool'}[]=[
 {key:'biller',label:'Biller',type:'text'},{key:'category',label:'Type of bill',type:'category'},{key:'amountDueCents',label:'Amount due',type:'money'},{key:'dueDate',label:'Due date',type:'date'},
 {key:'accountReference',label:'Account / reference',type:'text'},{key:'isRecurring',label:'Happens regularly',type:'bool'},{key:'expectedRecurrence',label:'How often',type:'recurrence'},
 {key:'bpayBillerCode',label:'BPAY biller code',type:'text'},{key:'bpayReference',label:'BPAY reference',type:'text'},{key:'paymentUrl',label:'Payment page',type:'text'},
 {key:'lateFeeCents',label:'Late fee',type:'money'},{key:'earlyDiscountCents',label:'Early payment discount',type:'money'},{key:'discountDeadline',label:'Discount deadline',type:'date'},{key:'directDebitActive',label:'Direct debit set up',type:'bool'},
];
export default function VerifyPage({params}:{params:Promise<{captureId:string}>}){
 const {captureId}=use(params);const router=useRouter();
 const [data,setData]=useState<Loaded|null>(null);const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [toast,setToast]=useState<string|null>(null);
 const [values,setValues]=useState<Record<string,string|boolean|null>>({});const [confirmed,setConfirmed]=useState<Set<string>>(new Set());const [answered,setAnswered]=useState<Set<string>>(new Set());const [showAll,setShowAll]=useState(false);const [allowDuplicate,setAllowDuplicate]=useState(false);
 useEffect(()=>{apiGet<Loaded>(`/api/bear/captures/${captureId}`).then(d=>{setData(d);const f=d.extraction?.fields;if(f){const v:Record<string,string|boolean|null>={};for(const e of editable){const t=f[e.key] as {value:unknown};v[e.key]=e.type==='money'?(t.value===null?'':((t.value as number)/100).toFixed(2)):e.type==='bool'?(t.value as boolean|null):(t.value as string|null)??'';}setValues(v);}}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);});},[captureId,router]);
 if(error&&!data)return <main id="main" className="bear-screen flow"><TopBar back={{href:'/bear/home'}}/><ErrorCard message={error}/></main>;
 if(!data)return <main id="main" className="bear-screen flow"><TopBar back={{href:'/bear/home'}}/><Skeleton/></main>;
 const ex=data.extraction;
 if(!ex||data.capture.status==='failed')return <main id="main" className="bear-screen flow"><TopBar back={{href:'/bear/capture'}}/><h1>Bear couldn&rsquo;t read that one.</h1><p className="muted" style={{marginTop:8}}>{data.capture.error||'Nothing has been saved as a bill.'}</p><div className="btn-stack"><Button href="/bear/capture">Try another way</Button></div></main>;
 if(ex.status==='verified')return <main id="main" className="bear-screen flow"><TopBar back={{href:'/bear/home'}}/><h1>Bear&rsquo;s already got this one.</h1><div className="btn-stack"><Button href="/bear/home">Back to My Bear</Button></div></main>;
 const f=ex.fields;const cat=f.category.value;
 const notBill=f.documentType==='not_a_bill';
 const questions=ex.questions.filter(q=>!answered.has(q.field));
 const unsure=(key:string)=>{const t=(f as unknown as Record<string,{confidence:number;value:unknown}>)[key];return t&&t.value!==null&&t.confidence<0.75&&!confirmed.has(key)&&values[key]===(t.value as string);};
 const setValue=(key:string,v:string|boolean|null)=>{setValues(x=>({...x,[key]:v}));setConfirmed(c=>{const n=new Set(c);n.add(key);return n;});};
 const answer=(field:string,value:unknown)=>{setAnswered(a=>new Set(a).add(field));if(value===null){setShowAll(true);setTimeout(()=>document.getElementById('f-'+field)?.focus(),50);return;}setValue(field,field==='amountDueCents'?((value as number)/100).toFixed(2):value as string|boolean);};
 async function confirm(){if(!ex)return;setBusy(true);setError(null);
  const corrections:Record<string,unknown>={};
  for(const e of editable){const original=(f[e.key] as {value:unknown}).value;const v=values[e.key];
   if(e.type==='money'){const cents=v===''||v===null?null:Math.round(parseFloat(String(v))*100);if(cents!==original&&!(cents===null&&original===null)){if(cents!==null&&Number.isFinite(cents))corrections[e.key]=cents;else if(e.key!=='amountDueCents')corrections[e.key]=null;}}
   else if(e.type==='bool'){if(v!==original&&typeof v==='boolean')corrections[e.key]=v;}
   else{const s=v===''?null:v;if(s!==original){if(s!==null||e.key!=='biller'&&e.key!=='dueDate'&&e.key!=='category'&&e.key!=='expectedRecurrence')corrections[e.key]=s;}}
  }
  const confirmedFields=[...new Set([...confirmed,...editable.map(e=>e.key)])].filter(k=>!(k in corrections));
  try{const res=await apiSend<{bill:Bill}>('/api/bear/bills/confirm',{extractionId:ex.id,corrections,confirmedFields,allowDuplicate});router.replace(`/bear/bills/${res.bill.id}?plan=1`);}
  catch(e){const err=e as ApiError;if(err.body?.code==='duplicate'){setError(err.message);setAllowDuplicate(true);}else setError(err.message);setBusy(false);}
 }
 async function reject(){setBusy(true);try{await apiSend(`/api/bear/captures/${captureId}/reject`,{});router.replace('/bear/capture');}catch(e){setError((e as Error).message);setBusy(false);}}
 return (
  <main id="main" className="bear-screen flow">
   <TopBar back={{href:'/bear/capture',label:'Start over'}} right={data.capture.isDemo?<span className="demo-tag">Example data</span>:null}/>
   <h1>{brand.verifyHeading}</h1>
   {notBill&&<p className="note" style={{marginTop:12}}>This doesn&rsquo;t look like a bill to Bear. You can still fill in the details below, or start over.</p>}
   <div className="card" style={{marginTop:16}}>
    <p className="eyebrow">{cat?categoryLabels[cat]:'Bill'}{f.category.value?' bill':''}</p>
    <h2>{values.biller||'Unknown biller'}</h2>
    <div className="amount" style={{marginTop:10}}>{values.amountDueCents?formatAUD(Math.round(parseFloat(String(values.amountDueCents))*100)):'—'}</div>
    <p className="muted" style={{marginTop:6}}>{values.dueDate?'Due '+formatAU(String(values.dueDate)):'No due date yet'}</p>
    {data.document&&<a href={data.document.url} target="_blank" rel="noreferrer" className="pill" style={{marginTop:12}}>View original</a>}
   </div>
   {data.duplicate&&<p className="note" style={{marginTop:12}}>Bear is already watching a {data.duplicate.biller} bill for {formatAU(data.duplicate.dueAt)} ({formatAUD(data.duplicate.amountCents)}). If this is a different bill, you can keep going.</p>}
   {questions.length>0&&<div className="glass" style={{padding:18,marginTop:14}}>
    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}><BearHead size={56}/><div style={{flex:1}}>
     <p className="hand" style={{fontSize:20}}>{questions.length===1?"One thing I'm not sure about:":"A couple of things I'm not sure about:"}</p>
     {questions.slice(0,1).map(q=><div key={q.field} style={{marginTop:8}}><p style={{fontWeight:600}}>{q.question}</p><div className="btn-row">{q.options.map((o,i)=><Button key={i} variant={i===0&&o.value!==null?'primary':'ghost'} className="sm" onClick={()=>answer(q.field,o.value)}>{o.label}</Button>)}</div></div>)}
    </div></div>
   </div>}
   <div className="section">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><p className="eyebrow" style={{margin:0}}>The details</p><button type="button" className="btn quiet sm" onClick={()=>setShowAll(s=>!s)} aria-expanded={showAll}>{showAll?'Fewer fields':'All fields'}</button></div>
    {editable.filter(e=>showAll||['biller','category','amountDueCents','dueDate'].includes(e.key)||(f[e.key] as {value:unknown}).value!==null).map(e=>{const t=f[e.key] as {value:unknown;confidence:number;source:string};const cls=unsure(e.key)?'unsure':confirmed.has(e.key)||t.confidence>=0.75?'ok':'';
     return <div key={e.key} className={`field ${cls}`}><label htmlFor={'f-'+e.key}>{e.label}{unsure(e.key)&&['biller','amountDueCents','dueDate'].includes(e.key)&&<span className="pill mustard" style={{marginLeft:8}}>Not sure</span>}</label>
      {e.type==='category'?<select id={'f-'+e.key} value={String(values[e.key]||'')} onChange={ev=>setValue(e.key,ev.target.value||null)}><option value="">Choose…</option>{billCategories.map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}</select>
      :e.type==='recurrence'?<select id={'f-'+e.key} value={String(values[e.key]||'')} onChange={ev=>setValue(e.key,ev.target.value||null)}><option value="">Not sure</option>{recurrences.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}</select>
      :e.type==='bool'?<select id={'f-'+e.key} value={values[e.key]===true?'yes':values[e.key]===false?'no':''} onChange={ev=>setValue(e.key,ev.target.value===''?null:ev.target.value==='yes')}><option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select>
      :<input id={'f-'+e.key} type={e.type==='date'?'date':'text'} inputMode={e.type==='money'?'decimal':undefined} value={String(values[e.key]??'')} onChange={ev=>setValue(e.key,ev.target.value)} placeholder={e.type==='money'?'0.00':e.type==='date'?'yyyy-mm-dd':''}/>}
      {t.source!=='user'&&t.value!==null&&<span className="hint">{t.source==='rules'?'Read from the text':t.source==='demo'?'Example':'Read by Bear'}{t.confidence<0.75?' · please check':''}</span>}
     </div>;})}
   </div>
   {error&&<div style={{marginTop:14}}><ErrorCard message={error}/></div>}
   <div className="btn-stack"><Button variant="coral" disabled={busy||!values.biller||!values.amountDueCents||!values.dueDate} onClick={confirm}>{busy?'One moment…':allowDuplicate?"It's a different bill, Bear's got it":brand.verifyCta}</Button><Button variant="quiet" disabled={busy} onClick={reject}>That&rsquo;s not right, start over</Button></div>
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
