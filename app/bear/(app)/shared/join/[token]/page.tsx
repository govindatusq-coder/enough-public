'use client';
// Opening a Share Bear link: see what's being asked, then Accept, Discuss or Decline.
import {use,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
interface S{id:string;mode:'info'|'action'|'transfer';status:string;title:string;notes:string|null;dueAt:string|null;from:string;mine:boolean;messages:{from:string;text:string}[]}
export default function Join({params}:{params:Promise<{token:string}>}){
 const {token}=use(params);const router=useRouter();
 const [s,setS]=useState<S|null>(null);const [err,setErr]=useState<string|null>(null);const [msg,setMsg]=useState('');const [talk,setTalk]=useState(false);const [busy,setBusy]=useState(false);const [doneText,setDoneText]=useState<string|null>(null);
 useEffect(()=>{apiSend<{share:S}>('/api/bear/shares/join',{token}).then(r=>setS(r.share)).catch(e=>{const x=e as {status?:number;message:string};if(x.status===401)router.replace(`/bear/signin?next=${encodeURIComponent(`/bear/shared/join/${token}`)}`);else setErr(x.message);});},[token,router]);
 if(err)return <main id="main" className="bear-screen"><ErrorCard message={err}/><Link href="/bear/home" className="btn ghost sm" style={{marginTop:12}}>Go to Load Bear</Link></main>;
 if(!s)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const ask=s.mode==='transfer'?`${s.from} would like you to take responsibility for ${s.title.charAt(0).toLowerCase()+s.title.slice(1)}.`:s.mode==='action'?`${s.from} has asked you to do this:`:`${s.from} shared this with you, for your information.`;
 async function answer(a:'accept'|'decline'|'discuss'){setBusy(true);try{const r=await apiSend<{status:string;taskId:string|null;pushed:string}>(`/api/bear/shares/${s!.id}/respond`,{answer:a,message:msg.trim()||null});
  // Only say they were notified if the notification actually went.
  const told=r.pushed==='sent'?`${s!.from} has been notified.`:`${s!.from} will see it next time they open Load Bear.`;
  setDoneText(a==='accept'?`${r.taskId?'It’s on your list now, in My Brain Dump.':'Got it. You’ll find it under Shared.'} ${told}`:a==='decline'?`Done. ${told}`:`Your message is with ${s!.from}. ${told}`);}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 return <main id="main" className="bear-screen">
  <p className="eyebrow teal">Share Bear</p>
  {s.mine?<p className="note" style={{marginTop:10}}>This is your own link. Send it to the person you want to share with.</p>:<>
  <h1 style={{fontSize:24,marginTop:8}}>{ask}</h1>
  <div className="glass" style={{padding:16,marginTop:14}}><strong>{s.title}</strong>{s.dueAt&&<p className="small muted">By {formatAU(s.dueAt,'short')}</p>}{s.notes&&<p className="small" style={{marginTop:8,whiteSpace:'pre-wrap'}}>{s.notes}</p>}</div>
  {doneText?<><p className="note teal" style={{marginTop:14}}>{doneText}</p><Link href="/bear/home" className="btn coral sm" style={{marginTop:12}}>Go to my lists</Link></>
  :s.status==='invited'||s.status==='discussing'?<>
   {talk&&<label className="ce-field" style={{marginTop:14}}>Message to {s.from}<textarea rows={3} value={msg} onChange={e=>setMsg(e.target.value)} maxLength={500}/></label>}
   <div className="btn-row" style={{marginTop:14}}>
    <button type="button" className="btn coral sm" disabled={busy} onClick={()=>answer('accept')}>{s.mode==='info'?'Got it':'Accept'}</button>
    {s.mode!=='info'&&<button type="button" className="btn ghost sm" disabled={busy||(talk&&!msg.trim())} onClick={()=>talk?answer('discuss'):setTalk(true)}>{talk?'Send':'Discuss'}</button>}
    {s.mode!=='info'&&<button type="button" className="btn ghost sm" disabled={busy} onClick={()=>answer('decline')}>Decline</button>}
   </div></>
  :<p className="note" style={{marginTop:14}}>You’ve already answered this one. <Link href="/bear/shared" className="link-btn">See Shared</Link></p>}
  </>}
 </main>;
}
