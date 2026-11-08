'use client';
import {useEffect,useState} from 'react';
import {CompactLockup} from './art';
import {loadOffice,popupAuth,sendToPane} from '@/lib/bear/outlook/office-client';

// Sign-in for Bear in Outlook, shown in Outlook's own pop-up window. It makes a separate session just for
// the add-in (so signing out of one never signs you out of the other), passes it to the pane and closes.
// Nothing is remembered in this window.
export function OutlookConnect(){
 const [ready,setReady]=useState<boolean|null>(null);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{loadOffice().then(setReady);},[]);
 async function submit(e:React.FormEvent){e.preventDefault();const auth=popupAuth();if(!auth){setMessage('Sign-in is not connected in this environment yet.');return;}
  setBusy(true);setMessage('');
  try{const {data,error}=await auth.auth.signInWithPassword({email,password});if(error||!data.session)throw error||new Error('no session');
   if(!sendToPane({type:'bear-session',access_token:data.session.access_token,refresh_token:data.session.refresh_token}))setMessage('Signed in, but this window isn’t connected to Outlook. Close it and tap Sign in again from Outlook.');
  }catch(error){const detail=error instanceof Error&&error.message&&error.message!=='no session'?` (${error.message})`:'';setMessage('Sign-in failed.'+detail);}finally{setBusy(false);}}
 return <main id="main" className="bear-screen flow">
  <div style={{margin:'4px 0 14px'}}><CompactLockup width={220}/></div>
  <h1 style={{fontSize:24}}>Sign in to use Bear in Outlook</h1>
  <p className="small muted" style={{marginTop:6}}>Use the same email and password as your Load Bear app.</p>
  <form onSubmit={submit} style={{marginTop:10}}>
   <div className="field"><label htmlFor="ol-email">Email</label><input id="ol-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
   <div className="field"><label htmlFor="ol-password">Password</label><input id="ol-password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></div>
   {message&&<p className="note" role="status" style={{marginTop:14}}>{message}</p>}
   {ready===false&&!message&&<p className="small muted" style={{marginTop:10}}>Open this from the Load Bear pane in Outlook.</p>}
   <div className="btn-stack"><button type="submit" className="btn primary wide" disabled={busy}>{busy?'One moment…':'Sign in'}</button></div>
  </form>
  <p className="faint" style={{marginTop:18}}>No Bear yet? Create one in the Load Bear app first, then come back here.</p>
 </main>;
}
