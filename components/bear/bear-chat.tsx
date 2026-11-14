'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,type ApiError} from '@/lib/bear/client';
import {Art} from './art';
import {QuickCapture} from './quick-capture';
// The first screen: tell Bear something, get a one-line answer, add another or leave. Nothing is asked of the person here.
export function BearChat(){
 const router=useRouter();const [name,setName]=useState<string|null>(null);
 useEffect(()=>{let live=true;
  apiGet<{profile:{name?:string;onboardingComplete?:boolean}}>('/api/bear/profile').then(r=>{if(!live)return;if(r.profile&&r.profile.onboardingComplete===false){router.replace('/bear/onboarding');return;}setName((r.profile?.name||'').trim().split(/\s+/)[0]||'');})
   .catch(e=>{if(!live)return;if((e as ApiError).status===401){router.replace('/bear/welcome');return;}setName('');});
  return()=>{live=false;};},[router]);
 return <main id="main" className="bear-screen home-screen home-hero">
  <header className="hh">
   <div className="hh-art" aria-hidden="true"><span className="hh-circle"/><Art file="hero-bear-cut" className="hh-bear"/></div>
   <h1 className="hh-welcome hand hero-greeting">Welcome{name?`, ${name}`:''}!</h1>
   <p className="hh-sub">I’ve got you. What do you need me to take care of today?</p>
  </header>
  <QuickCapture onChanged={()=>{}}/>
  <nav className="hh-links" aria-label="More">
   <Link href="/bear/capture/more?more=1" prefetch={false}>Add a photo or file</Link>
   <Link href="/bear/home">Everything Bear’s holding <span aria-hidden="true">›</span></Link>
  </nav>
 </main>;
}
