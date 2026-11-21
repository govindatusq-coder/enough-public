'use client';
// Share Bear by text: ask someone for help with this task. Choose who, see exactly what they'll get, send. Then Bear
// keeps her posted and handles the follow-up; the panel shows where it stands and what she can do.
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {normalisePhone,requestText,type DStatus,type Delegation} from '@/lib/bear/sharebear/core';
import {Sheet} from './ui';

export interface OwnerRequest{id:string;taskId:string;status:DStatus;label:string;to:string;phone:string;title:string;due:string|null;dueTime:string|null;message:string|null;createdAt:string;lastUpdate:string;sentBy:string|null;changedSince:boolean;lastError:string|null;history:{at:string;text:string}[]}
export interface ShareBearState{requests:OwnerRequest[];contacts:{name:string;phone:string}[];sms:'twilio'|'mock'|'none';ownerName:string}
const DEFAULT='Could you please take care of this?';
const dueText=(due:string|null,time:string|null)=>due?`${formatAU(due,'weekday')} ${formatAU(due,'short')}${time?`, ${time}`:''}`:'No date';
const ago=(iso:string)=>new Date(iso).toLocaleString('en-AU',{weekday:'short',hour:'numeric',minute:'2-digit'});
const newKey=()=>`sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
type ContactsApi={select(props:string[],o:{multiple:boolean}):Promise<{name?:string[];tel?:string[]}[]>};

export function useShareBear(){
 const [state,setState]=useState<ShareBearState|null>(null);
 const load=()=>apiGet<ShareBearState>('/api/bear/share-bear').then(setState).catch(()=>setState(s=>s));
 // (Loading also brings her tasks up to date with what people answered.)
 useEffect(()=>{load();},[]);
 return {state,reload:load};
}

export function ShareBearSheet({task,state,onClose,onDone,preset}:{task:{id:string;title:string;due:string|null;dueTime:string|null};state:ShareBearState|null;onClose:()=>void;onDone:()=>void;preset?:{name:string;phone:string}|null}){
 // Asking the same person again: their saved number if Bear has it, otherwise their name is filled in for her to add it.
 const known=preset&&!preset.phone?state?.contacts.find(c=>c.name.toLowerCase()===preset.name.toLowerCase())||null:null;
 const startPhone=preset?.phone||known?.phone||'';
 const [step,setStep]=useState<'who'|'enter'|'preview'|'result'>(preset?(startPhone?'preview':'enter'):'who');
 const [name,setName]=useState(preset?.name||'');const [phone,setPhone]=useState(startPhone);const [message,setMessage]=useState(DEFAULT);
 const [err,setErr]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [key]=useState(newKey);
 const [res,setRes]=useState<{result:'sent'|'mock'|'failed'|'own_phone';delegation:OwnerRequest;smsHref?:string;testLink?:string;error?:string}|null>(null);
 const picker=typeof navigator!=='undefined'&&'contacts' in navigator&&typeof window!=='undefined'&&'ContactsManager' in window;
 const check=normalisePhone(phone);
 async function pick(){try{const [c]=await (navigator as unknown as {contacts:ContactsApi}).contacts.select(['name','tel'],{multiple:false});if(!c)return;setName((c.name?.[0]||'').split(/\s+/)[0]||'');setPhone(c.tel?.[0]||'');setStep('enter');}catch{/* she closed the picker */}}
 function toPreview(){setErr(null);if(!name.trim()){setErr('Add their name, so they know who it’s for.');return;}if(!check.ok){setErr(check.reason);return;}setStep('preview');}
 async function send(){setBusy(true);setErr(null);try{const r=await apiSend<typeof res>('/api/bear/share-bear',{taskId:task.id,name:name.trim(),phone,message:message.trim()||null,idempotencyKey:key});setRes(r);setStep('result');}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 async function act(action:string){if(!res)return;setBusy(true);setErr(null);try{const d=await apiSend<OwnerRequest>(`/api/bear/share-bear/${res.delegation.id}`,{action});setRes({...res,delegation:d,result:action==='sent_myself'?'sent':d.status==='SENT'?'sent':res.result});if(action==='sent_myself')onDone();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 // Exactly what they will get, built the same way the server builds it (the link is added when it's sent).
 const preview=check.ok?requestText({ownerName:state?.ownerName||'You',snapshot:{title:task.title,due:task.due,dueTime:task.dueTime,message:message.trim()&&message.trim()!==DEFAULT?message.trim():null}} as Delegation,'[a link to say yes or no]'):'';
 const who=name.trim()||'them';
 return <Sheet label="Share Bear" onClose={onClose}><div className="sb-sheet">
  {step==='who'&&<>
   <h2 className="sb-h">Who can help with this?</h2>
   {!!state?.contacts.length&&<ul className="sb-people">{state.contacts.map(c=><li key={c.phone}><button type="button" onClick={()=>{setName(c.name);setPhone(c.phone);setStep('preview');}}><strong>{c.name}</strong><span>{normalisePhone(c.phone).ok?(normalisePhone(c.phone) as {display:string}).display:c.phone}</span></button></li>)}</ul>}
   <div className="sb-ways">
    {picker&&<button type="button" className="btn ghost wide" onClick={pick}>Choose from contacts</button>}
    <button type="button" className="btn ghost wide" onClick={()=>{setName('');setPhone('');setStep('enter');}}>Enter mobile number</button>
   </div>
  </>}
  {step==='enter'&&<>
   <h2 className="sb-h">Who can help with this?</h2>
   <label className="sb-field">Their name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="off" maxLength={40} placeholder="Daniel"/></label>
   <label className="sb-field">Mobile number<input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" autoComplete="off" maxLength={24} placeholder="0412 345 678"/></label>
   {phone&&check.ok&&<p className="sb-note">Bear will text {check.display}. Check it’s {who}’s number.</p>}
   {err&&<p className="note coral" role="alert">{err}</p>}
   <div className="sb-actions"><button type="button" className="btn coral wide" onClick={toPreview}>Next</button><button type="button" className="btn quiet wide" onClick={()=>setStep('who')}>Back</button></div>
  </>}
  {step==='preview'&&check.ok&&<>
   <h2 className="sb-h">Ask {who} for help?</h2>
   <dl className="sb-facts"><div><dt>Task</dt><dd>{task.title}</dd></div><div><dt>Due</dt><dd>{dueText(task.due,task.dueTime)}</dd></div><div><dt>To</dt><dd>{who} · {check.display}</dd></div></dl>
   <label className="sb-field">Message (optional)<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={2} maxLength={240}/></label>
   <details className="sb-exact"><summary>What {who} will get</summary><p>{preview}</p><p className="sb-note">Only this is shared: never your notes, your other tasks or anything else in Load Bear.</p></details>
   {state?.sms==='mock'&&<p className="note" role="note">Test mode: no real text will be sent.</p>}
   {state?.sms==='none'&&<p className="note" role="note">Texting from Load Bear isn’t set up yet, so Bear will open your Messages app with the text ready for you to send.</p>}
   {err&&<p className="note coral" role="alert">{err}</p>}
   <div className="sb-actions"><button type="button" className="btn coral wide" disabled={busy} onClick={send}>{busy?'Sending…':'Send request'}</button><button type="button" className="btn quiet wide" disabled={busy} onClick={onClose}>Cancel</button></div>
  </>}
  {step==='result'&&res&&<>
   {res.result==='sent'&&<div className="sb-done" role="status"><h2 className="sb-h">🐻 Request sent!</h2><p>Bear has asked {res.delegation.to} to help.</p><p className="sb-wait">Waiting for {res.delegation.to}</p></div>}
   {res.result==='mock'&&<div className="sb-done" role="status"><h2 className="sb-h">🐻 Request made (test mode)</h2><p>No real text was sent. In test mode, {res.delegation.to}’s page is here:</p>{res.testLink&&<p><a href={res.testLink} target="_blank" rel="noopener noreferrer" className="link-btn sb-testlink">{res.testLink}</a></p>}</div>}
   {res.result==='own_phone'&&<div className="sb-done" role="status"><h2 className="sb-h">Send it from your phone</h2><p>Your Messages app opens with the text ready. Send it, then come back and tap “I’ve sent it”.</p>
    <div className="sb-actions"><a className="btn coral wide" href={res.smsHref}>Open Messages</a><button type="button" className="btn ghost wide" disabled={busy} onClick={()=>act('sent_myself')}>I’ve sent it</button></div></div>}
   {res.result==='failed'&&<div className="sb-done" role="alert"><h2 className="sb-h">Bear couldn’t send that request.</h2><p>Nothing was sent to {res.delegation.to}.</p>
    <div className="sb-actions"><button type="button" className="btn coral wide" disabled={busy} onClick={()=>act('retry')}>Try again</button><button type="button" className="btn ghost wide" disabled={busy} onClick={async()=>{await act('cancel');setStep('enter');}}>Check number</button></div></div>}
   {err&&<p className="note coral" role="alert">{err}</p>}
   {res.result!=='own_phone'&&res.result!=='failed'&&<div className="sb-actions"><button type="button" className="btn ghost wide" onClick={()=>{onDone();onClose();}}>Done</button></div>}
  </>}
 </div></Sheet>;
}

// On the task: who's helping and where it stands. Only the actions that make sense right now.
export function DelegationPanel({r,onChanged,askAgain}:{r:OwnerRequest;onChanged:()=>void;askAgain:(preset:{name:string;phone:string}|null)=>void}){
 const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 async function act(action:string){setBusy(true);setErr(null);try{await apiSend(`/api/bear/share-bear/${r.id}`,{action});onChanged();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 const s=r.status;const ended=['DECLINED','UNABLE_TO_COMPLETE','EXPIRED','CANCELLED','SEND_FAILED'].includes(s);
 const line:Record<string,string>={SENT:`Waiting for ${r.to} to answer.`,PENDING_SEND:`Waiting for you to send the text to ${r.to}.`,ACCEPTED:`${r.to} said yes. Bear will remind them on the day and tell you if it isn’t done.`,DECLINED:`${r.to} can’t take this one. It’s back with you.`,UNABLE_TO_COMPLETE:`${r.to} can’t do it any more. It’s back with you.`,EXPIRED:`${r.to} didn’t answer. It’s back with you.`,CANCELLED:'You cancelled this request.',SEND_FAILED:`The text to ${r.to} didn’t send.`,COMPLETED:`${r.to} said it’s done. Bear hasn’t checked it.`};
 return <section className="v2-card v2-sec sb-panel" aria-labelledby="sb-h">
  <h2 id="sb-h" className="v2-h3">🐻 With {r.to} · <span className={`sb-status st-${s.toLowerCase()}`}>{r.label}</span></h2>
  <p>{line[s]||r.label}</p>
  <p className="tiny muted">Last update {ago(r.lastUpdate)}{r.sentBy==='mock'?' · test mode, no real text':r.sentBy==='own_phone'?' · you sent the text yourself':''}</p>
  {r.changedSince&&s==='ACCEPTED'&&<p className="note" role="note">You’ve changed this since {r.to} said yes, so they agreed to the earlier version. <button type="button" className="link-btn" disabled={busy} onClick={async()=>{await act('cancel');askAgain({name:r.to,phone:''});}}>Ask {r.to} again</button></p>}
  {err&&<p className="note coral" role="alert">{err}</p>}
  <div className="btn-row">
   {['SENT','ACCEPTED','PENDING_SEND'].includes(s)&&<button type="button" className="btn ghost sm" disabled={busy} onClick={()=>act('cancel')}>Cancel request</button>}
   {s==='SEND_FAILED'&&<button type="button" className="btn coral sm" disabled={busy} onClick={()=>act('retry')}>Try again</button>}
   {ended&&<button type="button" className="btn coral sm" disabled={busy} onClick={()=>askAgain(null)}>Ask someone else</button>}
   {ended&&<button type="button" className="btn ghost sm" disabled={busy} onClick={()=>act('take_back')}>Take it back</button>}
  </div>
  {r.history.length>0&&<details className="sb-history"><summary className="tiny">What’s happened</summary><ul className="v2-lines">{[...r.history].reverse().map((h,i)=><li key={i} className="small">{ago(h.at)}: {h.text}</li>)}</ul></details>}
 </section>;
}
