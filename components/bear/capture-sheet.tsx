'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {shrinkImage} from '@/lib/bear/client-image';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiForm,apiGet,apiSend,ApiError} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import {formatAUD} from '@/lib/bear/domain/money';
import {formatAU} from '@/lib/bear/domain/dates';
import type {Capture,ExtractedEntity} from '@/lib/bear/domain/types';
import {CaptureBear} from './art';
import {BearThinking} from './bear-thinking';
import {Button,ErrorCard,TopBar,useOnline} from './ui';

type Mode='menu'|'text'|'manual'|'voice'|'thinking';
type Recognition={start:()=>void;stop:()=>void;abort:()=>void;lang:string;continuous:boolean;interimResults:boolean;onresult:((e:{resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>&{isFinal:boolean}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null};
const recognitionCtor=():(new()=>Recognition)|null=>{if(typeof window==='undefined')return null;const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};return w.SpeechRecognition||w.webkitSpeechRecognition||null;};
const options=[
 {key:'photo',label:'Snap a photo',sub:'A bill, a school note, a letter, a list',icon:'M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',file:true,accept:'image/*',capture:'environment'},
 {key:'screenshot',label:'Screenshot or image',sub:'A message, an email, an invite',icon:'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4',file:true,accept:'image/*'},
 {key:'upload',label:'Upload a PDF',sub:'Attachment or download',icon:'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',file:true,accept:'application/pdf,image/*'},
 {key:'voice',label:'Say it',sub:'Bear listens, then shows you the words',icon:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',file:false},
] as const;

export function CaptureSheet(){
 const router=useRouter();const params=useSearchParams();const online=useOnline();
 const [mode,setMode]=useState<Mode>('menu');const [text,setText]=useState(params.get('text')||'');const [error,setError]=useState<string|null>(null);const [aiAvailable,setAiAvailable]=useState<boolean|null>(null);
 const [preview,setPreview]=useState<{kind:'image';url:string}|{kind:'text';text:string}|null>(null);const [fields,setFields]=useState<{label:string;value:string}[]>([]);
 const [manual,setManual]=useState({what:'',when:'',who:'',amount:''});
 const [listening,setListening]=useState(false);const [transcript,setTranscript]=useState('');const [interim,setInterim]=useState('');const recRef=useRef<Recognition|null>(null);const voiceSupported=recognitionCtor()!==null;
 const fileRef=useRef<HTMLInputElement>(null);const [pending,setPending]=useState<{method:string;accept:string;capture?:string}|null>(null);
 const first=params.get('first')==='1';
 useEffect(()=>{apiGet<{aiAvailable:boolean}>('/api/bear/profile').then(p=>setAiAvailable(p.aiAvailable)).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setAiAvailable(false);});},[router]);
 const close=useCallback(()=>router.push(first?'/bear/home':'/bear/home'),[router,first]);
const finish=useCallback((result:{capture:Capture;extraction:ExtractedEntity;auto?:{taskId:string}})=>{
  const f=result.extraction.fields;const g=result.extraction.general;const out:{label:string;value:string}[]=[];
  if(result.extraction.kind!=='bill'){if(g.title.value)out.push({label:'Task',value:g.title.value.toUpperCase()});if(g.when.value)out.push({label:'When',value:formatAU(g.when.value,'long').toUpperCase()});if(g.area.value)out.push({label:'Area',value:g.area.value.toUpperCase()});if(g.person.value)out.push({label:'For',value:g.person.value.toUpperCase()});}
  else if(f.biller.value)out.push({label:'Biller',value:f.biller.value.toUpperCase()});if(f.amountDueCents.value!==null)out.push({label:'Amount',value:formatAUD(f.amountDueCents.value)});if(f.dueDate.value)out.push({label:'Due',value:formatAU(f.dueDate.value,'long').toUpperCase()});if(f.category.value)out.push({label:'Category',value:f.category.value.replace('_',' ').toUpperCase()});if(f.paymentMethods.value?.length)out.push({label:'Pay by',value:f.paymentMethods.value[0].toUpperCase()});
  setFields(out);
  setTimeout(()=>router.replace(result.auto?`/bear/tasks/${result.auto.taskId}?auto=1`:`/bear/verify/${result.capture.id}`),Math.min(2600,700+out.length*400));
 },[router]);
 async function pasteFromClipboard(){setError(null);try{const t=await navigator.clipboard.readText();if(!t.trim()){setError('Your clipboard is empty. Copy a message first, then tap Paste.');return;}setText(x=>x.trim()?x.trimEnd()+'\n'+t:t);document.getElementById('quick-text')?.focus();}catch{setError("Bear couldn't read your clipboard. Press and hold in the box and choose Paste instead.");}}
 async function submitText(method:'text'|'manual'|'voice',body:string){if(!online){setError("You're offline. Bear will be here when you're back.");return;}setMode('thinking');setError(null);setPreview({kind:'text',text:body});
  try{finish(await apiSend<{capture:Capture;extraction:ExtractedEntity;auto?:{taskId:string}}>('/api/bear/captures',{method,text:body}));}catch(e){setMode(method);setError((e as ApiError).message);setPreview(null);}}
 async function submitFile(file:File,method:string,extraText?:string|null){if(!online){setError("You're offline. Bear will be here when you're back.");return;}setMode('thinking');setError(null);
  const url=file.type.startsWith('image/')?URL.createObjectURL(file):null;setPreview(url?{kind:'image',url}:null);
  const upload=await shrinkImage(file);
  const form=new FormData();form.append('file',upload);form.append('method',method);if(extraText)form.append('text',extraText);
  try{finish(await apiForm<{capture:Capture;extraction:ExtractedEntity;auto?:{taskId:string}}>('/api/bear/captures',form));}catch(e){setMode('menu');setError((e as ApiError).message);setPreview(null);}}
 // Something was shared to Load Bear from another app on the iPhone: give it straight to Bear, no extra tap.
 useEffect(()=>{
  const take=()=>{const inbox=window.__bearInbox;if(!inbox)return;window.__bearInbox=undefined;setTimeout(()=>{if(inbox.files[0])void submitFile(inbox.files[0],'upload',inbox.text);else if(inbox.text)void submitText('text',inbox.text);},0);};
  take();window.addEventListener('bear-share',take);return()=>window.removeEventListener('bear-share',take);
 });
 const pick=(o:typeof options[number])=>{if('unavailable' in o&&o.unavailable)return;if(o.key==='voice'){setMode('voice');return;}setPending({method:o.key,accept:o.accept,capture:'capture' in o?o.capture:undefined});setTimeout(()=>fileRef.current?.click(),0);};
 const manualText=()=>[manual.what,manual.who?`For ${manual.who}`:'',manual.when?`Due date: ${manual.when}`:'',manual.amount?`Total amount due: ${manual.amount.startsWith('$')?manual.amount:'$'+manual.amount}`:''].filter(Boolean).join('\n');
 function startListening(){const Ctor=recognitionCtor();if(!Ctor)return;const r=new Ctor();r.lang='en-AU';r.continuous=true;r.interimResults=true;
  r.onresult=e=>{let finalText='',interimText='';for(let i=0;i<e.results.length;i++){const res=e.results[i];const t=res[0].transcript;if(res.isFinal)finalText+=t+' ';else interimText+=t;}if(finalText)setTranscript(x=>(x+' '+finalText).replace(/\s+/g,' ').trim());setInterim(interimText);};
  r.onend=()=>{setListening(false);setInterim('');};r.onerror=e=>{setListening(false);setInterim('');if(e.error==='not-allowed')setError('The microphone is blocked. Allow it in your browser settings, or type it instead.');else if(e.error!=='aborted'&&e.error!=='no-speech')setError("Bear couldn't hear that. Try again or type it.");};
  recRef.current=r;setError(null);setListening(true);try{r.start();}catch{setListening(false);}}
 function stopListening(){recRef.current?.stop();setListening(false);}
 return (
  <main id="main" className="bear-screen flow">
   <TopBar back={{onClick:close,label:mode==='menu'?'Close':'Back'}}/>
   {mode==='thinking'?<BearThinking preview={preview} fields={fields}/>:<>
    <div style={{display:'flex',gap:10,alignItems:'center'}}><CaptureBear width={120}/><div><h1>{brand.captureHeading}</h1><p className="muted" style={{marginTop:6}}>{brand.captureSub}</p></div></div>
    {first&&<p className="note teal" style={{marginTop:14}}>Anything goes: a bill, a school note, an appointment, a message, or just say it.</p>}
    {error&&<div style={{marginTop:14}}><ErrorCard message={error}/></div>}
    {!online&&<p className="note" style={{marginTop:14}} role="status">You&rsquo;re offline. Bear will be here when you&rsquo;re back.</p>}
    {mode==='menu'&&<form className="quick-box glass-strong" onSubmit={e=>{e.preventDefault();if(text.trim())submitText('text',text);}}>
     <label htmlFor="quick-text" className="sr-only">What&rsquo;s on your mind?</label>
     <textarea id="quick-text" value={text} onChange={e=>setText(e.target.value)} placeholder="What&rsquo;s on your mind? Type, paste or dictate. A bill, a school note, a to-do, anything." maxLength={20000} rows={4}/>
     {params.get('shared')==='1'&&<p className="small" role="status" style={{margin:'0 0 6px',color:'var(--teal)',fontWeight:600}}>Shared with Bear. Check it, then give it over.</p>}
     <div className="quick-tools"><Button variant="ghost" className="sm" type="button" onClick={pasteFromClipboard}>Paste from clipboard</Button><span className="faint">Copied a message in Messenger or WhatsApp? Paste it here.</span></div>
     <div className="quick-actions"><span className="faint">No dates or times needed. Bear works the rest out.</span><Button variant="coral" type="submit" disabled={!text.trim()}>{brand.giveIt}</Button></div>
    </form>}
    {mode==='menu'&&<p className="eyebrow" style={{marginTop:18}}>Or give it another way</p>}
    {mode==='menu'&&<div className="glass-strong" style={{padding:'8px 16px',marginTop:8}}>
     {[...options].sort((a,b)=>Number(('unavailable' in a&&a.unavailable)||(a.file&&aiAvailable===false))-Number(('unavailable' in b&&b.unavailable)||(b.file&&aiAvailable===false))).map(o=>{const off=Boolean(('unavailable' in o&&o.unavailable)||(o.file&&aiAvailable===false));return <button key={o.key} type="button" className="row" style={{width:'100%',textAlign:'left',opacity:off?.55:1}} onClick={()=>pick(o)} aria-disabled={off} disabled={off}>
      <span className={`icon-dot ${o.key==='photo'?'coral':o.key==='screenshot'?'sky':o.key==='upload'?'mustard':'blush'}`}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={o.icon}/></svg></span>
      <span className="grow"><span className="title">{o.label}</span><br/><span className="faint">{off?(o.file?'Needs the AI service connected':'Coming soon'):o.sub}</span></span>
      {!off&&<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{color:'var(--ink-3)'}}><path d="M9 6l6 6-6 6"/></svg>}
     </button>;})}
     <input ref={fileRef} type="file" className="sr-only" accept={pending?.accept||'image/*'} {...(pending?.capture?{capture:pending.capture as 'environment'}:{})} aria-label="Choose a file" onChange={e=>{const f=e.target.files?.[0];if(f&&pending)submitFile(f,pending.method);e.target.value='';}}/>
    </div>}
    {aiAvailable===false&&mode==='menu'&&<p className="faint" style={{marginTop:12}}>Pictures and PDFs need the AI service connected. Typed, pasted and spoken things work now.</p>}
    {mode==='text'&&<form onSubmit={e=>{e.preventDefault();submitText('text',text);}} style={{marginTop:14}}>
     <div className="field"><label htmlFor="billtext">Paste it here</label><textarea id="billtext" value={text} onChange={e=>setText(e.target.value)} placeholder={"Hi parents, the Year 2 excursion is on Friday 14 November. Please return the permission form by…"} required maxLength={20000}/><span className="hint">Bear works out what it is, when it matters and who it&rsquo;s for. Nothing is paid without you.</span></div>
     <div className="btn-stack"><Button variant="coral" type="submit" disabled={!text.trim()}>{brand.giveIt}</Button><Button variant="quiet" onClick={()=>setMode('menu')}>Back</Button></div>
    </form>}
    {mode==='voice'&&<div style={{marginTop:14}}>
     {!voiceSupported&&<p className="note">Voice isn&rsquo;t available in this browser. On iPhone, open Bear in Safari, or tap the microphone on your keyboard in &ldquo;Type it in&rdquo;.</p>}
     {voiceSupported&&<div style={{textAlign:'center'}}>
      <button type="button" onClick={listening?stopListening:startListening} aria-pressed={listening} aria-label={listening?'Stop listening':'Start listening'} className="btn coral" style={{width:96,height:96,borderRadius:'50%',padding:0,animation:listening?'pulse 1.4s ease-in-out infinite':undefined}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
      <p className="muted small" style={{marginTop:10}}>{listening?'Listening… tap to stop.':transcript?'Tap to add more, or send it to Bear.':'Tap and say what&rsquo;s on your mind.'}</p>
      {interim&&<p className="faint" style={{marginTop:6}}>{interim}</p>}
     </div>}
     <div className="field"><label htmlFor="voicetext">What Bear heard</label><textarea id="voicetext" value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Book Ava's dentist for next Tuesday afternoon…" maxLength={20000} style={{minHeight:110}}/><span className="hint">Fix anything it misheard before sending.</span></div>
     <div className="btn-stack"><Button variant="coral" disabled={!transcript.trim()||listening} onClick={()=>submitText('voice',transcript.trim())}>{brand.giveIt}</Button><Button variant="quiet" onClick={()=>{stopListening();setMode('menu');}}>Back</Button></div>
    </div>}
    {mode==='manual'&&<form onSubmit={e=>{e.preventDefault();submitText('manual',manualText());}} style={{marginTop:14}}>
     <div className="field"><label htmlFor="m-what">What is it?</label><input id="m-what" required value={manual.what} onChange={e=>setManual({...manual,what:e.target.value})} placeholder="Return Ava's excursion form" maxLength={200}/></div>
     <div className="field"><label htmlFor="m-when">When (optional)</label><input id="m-when" type="date" value={manual.when} onChange={e=>setManual({...manual,when:e.target.value})}/></div>
     <div className="field"><label htmlFor="m-who">Who it&rsquo;s for (optional)</label><input id="m-who" value={manual.who} onChange={e=>setManual({...manual,who:e.target.value})} placeholder="Ava" maxLength={40}/></div>
     <div className="field"><label htmlFor="m-amount">Amount, if it&rsquo;s a bill (optional)</label><input id="m-amount" inputMode="decimal" value={manual.amount} onChange={e=>setManual({...manual,amount:e.target.value})} placeholder="184.60"/></div>
     <div className="btn-stack"><Button variant="coral" type="submit">{brand.giveIt}</Button><Button variant="quiet" onClick={()=>setMode('menu')}>Back</Button></div>
    </form>}
   </>}
  </main>
 );
}
