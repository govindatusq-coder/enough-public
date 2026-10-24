'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {browserClient} from '@/lib/supabase/client';
import {CompactLockup} from '@/components/bear/art';
import {TopBar} from '@/components/bear/ui';
export function SignInForm(){
 const params=useSearchParams();const router=useRouter();const [create,setCreate]=useState(params.get('mode')==='create');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const configured=!!process.env.NEXT_PUBLIC_SUPABASE_URL;
 const callback=()=>window.location.origin+'/auth/callback?next=%2Fbear';
 async function submit(e:React.FormEvent){e.preventDefault();if(!configured){setMessage('Sign-in is not connected in this environment yet.');return;}setBusy(true);setMessage('');
  try{const db=browserClient();
   if(create){const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:callback(),data:{name}}});if(error)throw error;if(data.session){router.push('/bear');router.refresh();}else setMessage('Check your email to confirm your account, then come back to Bear.');}
   else{const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;router.push('/bear');router.refresh();}
  }catch(error){const detail=error instanceof Error&&error.message?` (${error.message})`:'';setMessage((create?'Your Bear could not be created.':'Sign-in failed.')+detail);}finally{setBusy(false);}}
 return (
  <main id="main" className="bear-screen flow">
   <TopBar back={{href:'/bear/welcome'}}/>
   <div style={{marginBottom:18}}><CompactLockup width={320}/></div>
   <h1>{create?'Get yourself a Bear.':'Welcome back.'}</h1>
   <p className="muted" style={{marginTop:8}}>{create?"One account. Bear remembers the rest.":"Bear's been keeping everything where you left it."}</p>
   <form onSubmit={submit} style={{marginTop:10}}>
    {create&&<div className="field"><label htmlFor="name">What should Bear call you?</label><input id="name" autoComplete="given-name" value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="Sarah"/></div>}
    <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={create?'new-password':'current-password'} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/>{create&&<span className="hint">At least 8 characters.</span>}</div>
    {message&&<p className="note" role="status" style={{marginTop:14}}>{message}</p>}
    <div className="btn-stack"><button type="submit" className="btn primary wide" disabled={busy}>{busy?'One moment…':create?'Create my Bear':'Sign in'}</button>
     <button type="button" className="btn quiet wide" onClick={()=>{setCreate(!create);setMessage('');}}>{create?'Already have a Bear? Sign in':'New here? Create a Bear'}</button>
     {!create&&<Link href="/recover" className="btn quiet wide">Forgot your password?</Link>}
    </div>
   </form>
   <p className="faint" style={{marginTop:24}}>Bear keeps what you give it private: only you can see it, and nothing is paid without you.</p>
  </main>
 );
}
