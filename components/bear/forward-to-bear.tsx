'use client';
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {Button} from './ui';

// Forward to Bear: the person's own address for forwarding school emails and notices. Shown only when
// forwarding is switched on and fully set up on the server; otherwise this renders nothing.
export function ForwardToBear(){
 const [s,setS]=useState<{enabled:boolean;address:string|null}|null>(null);const [busy,setBusy]=useState(false);const [note,setNote]=useState<string|null>(null);
 useEffect(()=>{apiGet<{enabled:boolean;address:string|null}>('/api/bear/inbound/address').then(setS).catch(()=>setS(null));},[]);
 if(!s?.enabled)return null;
 async function run(method:'POST'|'DELETE'){setBusy(true);setNote(null);try{setS(await apiSend('/api/bear/inbound/address',{},method));setNote(method==='DELETE'?'Forwarding is off. That address no longer works.':'Done. Only this address works now.');}catch(e){setNote((e as Error).message);}finally{setBusy(false);}}
 async function copy(){if(!s?.address)return;try{await navigator.clipboard.writeText(s.address);setNote('Address copied.');}catch{setNote(s.address);}}
 return <section className="section" aria-labelledby="fwd"><p className="eyebrow" id="fwd">Forward to Bear</p><div className="card">
  {s.address?<>
   <p className="small">Forward school emails and notices here. Bear reads them and sorts out what needs you.</p>
   <p className="fwd-address" style={{marginTop:8,fontWeight:700,wordBreak:'break-all'}}>{s.address}</p>
   <p className="small muted" style={{marginTop:6}}>Bear only sees what you forward. It doesn’t read your inbox. Keep this address private.</p>
   <div className="btn-row"><Button className="sm" variant="primary" onClick={copy}>Copy address</Button><Button className="sm" variant="quiet" disabled={busy} onClick={()=>run('POST')}>New address</Button><Button className="sm" variant="quiet" disabled={busy} onClick={()=>run('DELETE')}>Turn off</Button></div>
  </>:<>
   <p className="small">Get your own address to forward school emails to Bear. Bear only sees what you forward.</p>
   <div className="btn-row"><Button className="sm" variant="primary" disabled={busy} onClick={()=>run('POST')}>Get my address</Button></div>
  </>}
  {note&&<p className="small" role="status" style={{marginTop:8}}>{note}</p>}
 </div></section>;
}
