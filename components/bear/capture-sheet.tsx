'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiForm,apiGet,apiSend,ApiError} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import {formatAUD} from '@/lib/bear/domain/money';
import {formatAU} from '@/lib/bear/domain/dates';
import type {Capture,ExtractedEntity} from '@/lib/bear/domain/types';
import {MamaBear} from './mama-bear';
import {BearThinking} from './bear-thinking';
import {Button,ErrorCard,TopBar,useOnline} from './ui';

type Mode='menu'|'text'|'manual'|'thinking';
const options=[
 {key:'photo',label:'Snap a photo',sub:'Paper bill on the bench',icon:'M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',file:true,accept:'image/*',capture:'environment'},
 {key:'screenshot',label:'Screenshot or image',sub:'From your photos',icon:'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4',file:true,accept:'image/*'},
 {key:'upload',label:'Upload a PDF',sub:'Email attachment or download',icon:'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',file:true,accept:'application/pdf,image/*'},
 {key:'text',label:'Paste the bill text',sub:'From an email or SMS',icon:'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',file:false},
 {key:'manual',label:'Type it in',sub:'Just the basics',icon:'M4 20h4l10-10-4-4L4 16zM13 7l4 4',file:false},
 {key:'voice',label:'Say it',sub:'Coming soon',icon:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',file:false,unavailable:true},
] as const;

export function CaptureSheet(){
 const router=useRouter();const params=useSearchParams();const online=useOnline();
 const [mode,setMode]=useState<Mode>('menu');const [text,setText]=useState('');const [error,setError]=useState<string|null>(null);const [aiAvailable,setAiAvailable]=useState<boolean|null>(null);
 const [preview,setPreview]=useState<{kind:'image';url:string}|{kind:'text';text:string}|null>(null);const [fields,setFields]=useState<{label:string;value:string}[]>([]);
 const [manual,setManual]=useState({biller:'',amount:'',due:'',category:''});
 const fileRef=useRef<HTMLInputElement>(null);const [pending,setPending]=useState<{method:string;accept:string;capture?:string}|null>(null);
 const first=params.get('first')==='1';
 useEffect(()=>{apiGet<{aiAvailable:boolean}>('/api/bear/profile').then(p=>setAiAvailable(p.aiAvailable)).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setAiAvailable(false);});},[router]);
 const close=useCallback(()=>router.push(first?'/bear/home':'/bear/home'),[router,first]);
 const finish=useCallback((result:{capture:Capture;extraction:ExtractedEntity})=>{
  const f=result.extraction.fields;const out:{label:string;value:string}[]=[];
  if(f.biller.value)out.push({label:'Biller',value:f.biller.value.toUpperCase()});if(f.amountDueCents.value!==null)out.push({label:'Amount',value:formatAUD(f.amountDueCents.value)});if(f.dueDate.value)out.push({label:'Due',value:formatAU(f.dueDate.value,'long').toUpperCase()});if(f.category.value)out.push({label:'Category',value:f.category.value.replace('_',' ').toUpperCase()});if(f.paymentMethods.value?.length)out.push({label:'Pay by',value:f.paymentMethods.value[0].toUpperCase()});
  setFields(out);
  setTimeout(()=>router.replace(`/bear/verify/${result.capture.id}`),Math.min(2600,700+out.length*400));
 },[router]);
 async function submitText(method:'text'|'manual',body:string){if(!online){setError(brand.name&&"You're offline. Bear will be here when you're back.");return;}setMode('thinking');setError(null);setPreview({kind:'text',text:body});
  try{finish(await apiSend<{capture:Capture;extraction:ExtractedEntity}>('/api/bear/captures',{method,text:body}));}catch(e){setMode(method);setError((e as ApiError).message);setPreview(null);}}
 async function submitFile(file:File,method:string){if(!online){setError("You're offline. Bear will be here when you're back.");return;}setMode('thinking');setError(null);
  const url=file.type.startsWith('image/')?URL.createObjectURL(file):null;setPreview(url?{kind:'image',url}:null);
  const form=new FormData();form.append('file',file);form.append('method',method);
  try{finish(await apiForm<{capture:Capture;extraction:ExtractedEntity}>('/api/bear/captures',form));}catch(e){setMode('menu');setError((e as ApiError).message);setPreview(null);}}
 const pick=(o:typeof options[number])=>{if('unavailable' in o&&o.unavailable)return;if(!o.file){setMode(o.key as Mode);return;}setPending({method:o.key,accept:o.accept,capture:'capture' in o?o.capture:undefined});setTimeout(()=>fileRef.current?.click(),0);};
 const manualText=()=>`${manual.biller}\n${manual.category?manual.category+' bill\n':''}Total amount due: ${manual.amount.startsWith('$')?manual.amount:'$'+manual.amount}\nDue date: ${manual.due}`;
 return (
  <main id="main" className="bear-screen flow">
   <TopBar back={{onClick:close,label:mode==='menu'?'Close':'Back'}}/>
   {mode==='thinking'?<BearThinking preview={preview} fields={fields}/>:<>
    <div style={{display:'flex',gap:14,alignItems:'flex-end'}}><MamaBear size={84} pose="calm"/><div><h1>{brand.captureHeading}</h1><p className="muted" style={{marginTop:6}}>{brand.captureSub}</p></div></div>
    {first&&<p className="note teal" style={{marginTop:14}}>Start with a bill. A screenshot of an email, a photo of the paper one, or just paste the text.</p>}
    {error&&<div style={{marginTop:14}}><ErrorCard message={error}/></div>}
    {!online&&<p className="note" style={{marginTop:14}} role="status">You&rsquo;re offline. Bear will be here when you&rsquo;re back.</p>}
    {mode==='menu'&&<div className="glass-strong" style={{padding:'8px 16px',marginTop:18}}>
     {options.map(o=>{const off=('unavailable' in o&&o.unavailable)||(o.file&&aiAvailable===false);return <button key={o.key} type="button" className="row" style={{width:'100%',textAlign:'left',opacity:off?.55:1}} onClick={()=>pick(o)} aria-disabled={off} disabled={off}>
      <span className={`icon-dot ${o.key==='photo'?'coral':o.key==='screenshot'?'sky':o.key==='upload'?'mustard':o.key==='text'?'teal':o.key==='manual'?'lavender':'blush'}`}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={o.icon}/></svg></span>
      <span className="grow"><span className="title">{o.label}</span><br/><span className="faint">{off?(o.file?'Needs the AI service connected':'Coming soon'):o.sub}</span></span>
      {!off&&<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{color:'var(--ink-3)'}}><path d="M9 6l6 6-6 6"/></svg>}
     </button>;})}
     <input ref={fileRef} type="file" className="sr-only" accept={pending?.accept||'image/*'} {...(pending?.capture?{capture:pending.capture as 'environment'}:{})} aria-label="Choose a file" onChange={e=>{const f=e.target.files?.[0];if(f&&pending)submitFile(f,pending.method);e.target.value='';}}/>
    </div>}
    {aiAvailable===false&&mode==='menu'&&<p className="faint" style={{marginTop:12}}>Pictures and PDFs need the AI service connected. Pasted text and typed bills work now.</p>}
    {mode==='text'&&<form onSubmit={e=>{e.preventDefault();submitText('text',text);}} style={{marginTop:14}}>
     <div className="field"><label htmlFor="billtext">Paste the bill</label><textarea id="billtext" value={text} onChange={e=>setText(e.target.value)} placeholder={"Energy Australia\nTotal amount due $184.60\nDue 28 November…"} required maxLength={20000}/><span className="hint">Bear reads the biller, amount, due date and payment details. Nothing is paid without you.</span></div>
     <div className="btn-stack"><Button variant="coral" type="submit" disabled={!text.trim()}>{brand.giveIt}</Button><Button variant="quiet" onClick={()=>setMode('menu')}>Back</Button></div>
    </form>}
    {mode==='manual'&&<form onSubmit={e=>{e.preventDefault();submitText('manual',manualText());}} style={{marginTop:14}}>
     <div className="field"><label htmlFor="m-biller">Who is it from?</label><input id="m-biller" required value={manual.biller} onChange={e=>setManual({...manual,biller:e.target.value})} placeholder="Energy Australia"/></div>
     <div className="field"><label htmlFor="m-cat">What kind of bill?</label><input id="m-cat" value={manual.category} onChange={e=>setManual({...manual,category:e.target.value})} placeholder="Electricity"/></div>
     <div className="field"><label htmlFor="m-amount">Amount due</label><input id="m-amount" required inputMode="decimal" value={manual.amount} onChange={e=>setManual({...manual,amount:e.target.value})} placeholder="184.60"/></div>
     <div className="field"><label htmlFor="m-due">Due date</label><input id="m-due" required type="date" value={manual.due} onChange={e=>setManual({...manual,due:e.target.value})}/></div>
     <div className="btn-stack"><Button variant="coral" type="submit">{brand.giveIt}</Button><Button variant="quiet" onClick={()=>setMode('menu')}>Back</Button></div>
    </form>}
   </>}
  </main>
 );
}
