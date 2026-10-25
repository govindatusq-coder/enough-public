'use client';
import {useEffect,useState} from 'react';
import {HeroVertical} from '@/components/bear/art';
// Opening screen: the Load Bear lockup for a moment each time the app is opened, then My Bear.
// Shown once per app session; tap to skip. Skipped under automated browsers so tests are not held up.
export function Splash(){
 const [phase,setPhase]=useState<'show'|'leaving'|'gone'>('gone');
 useEffect(()=>{
  let seen=false;try{seen=!!sessionStorage.getItem('bear-splash');sessionStorage.setItem('bear-splash','1');}catch{/* no storage */}
  if(seen||navigator.webdriver)return;
  const show=setTimeout(()=>setPhase('show'),0);const leave=setTimeout(()=>setPhase('leaving'),1600);const gone=setTimeout(()=>setPhase('gone'),2050);
  return ()=>{clearTimeout(show);clearTimeout(leave);clearTimeout(gone);};
 },[]);
 if(phase==='gone')return null;
 return <div className={`bear-splash${phase==='leaving'?' leaving':''}`} role="presentation" onClick={()=>setPhase('gone')}><div className="bear-splash-art"><HeroVertical/></div></div>;
}
