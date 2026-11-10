'use client';
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {Button} from './ui';

// Settings: connect or disconnect Outlook calendar. Shown only when it has been switched on and fully set up; otherwise renders nothing.
export function CalendarConnect(){
 const [s,setS]=useState<{available:boolean;connected:boolean}|null>(null);const [note,setNote]=useState<string|null>(()=>{if(typeof window==='undefined')return null;const q=new URLSearchParams(window.location.search).get('calendar');return q==='connected'?'Connected. Bear can now add events you approve.':q==='error'?'That didn’t connect. Nothing was changed. Try again.':null;});const [busy,setBusy]=useState(false);
 useEffect(()=>{apiGet<{available:boolean;connected:boolean}>('/api/bear/calendar/status').then(setS).catch(()=>setS(null));},[]);
 if(!s?.available)return null;
 async function off(){setBusy(true);try{await apiSend('/api/bear/calendar/account',{},'DELETE');setS({available:true,connected:false});setNote('Disconnected. Bear’s access is removed here. You can also remove it in your Microsoft account.');}catch(e){setNote((e as Error).message);}finally{setBusy(false);}}
 return <section className="section" aria-labelledby="cal"><p className="eyebrow" id="cal">Outlook calendar</p><div className="card">
  {s.connected?<>
   <p className="small">Connected. Bear adds an event only after you approve it, and it never changes or reads your other events.</p>
   <div className="btn-row"><Button className="sm" variant="quiet" disabled={busy} onClick={off}>Disconnect</Button></div>
  </>:<>
   <p className="small">Let Bear add events like school camps to your Outlook calendar, only after you approve each one. Microsoft will ask you to allow it. Bear never reads or changes your other events.</p>
   <div className="btn-row"><a className="btn primary sm" href="/api/bear/calendar/connect">Connect Outlook calendar</a></div>
  </>}
  {note&&<p className="note" role="status" style={{marginTop:10}}>{note}</p>}
 </div></section>;
}
