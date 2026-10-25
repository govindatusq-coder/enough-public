'use client';
import {Suspense,useEffect} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {sharedText} from '@/lib/bear/domain/share';

// Where another app lands when something is shared to Load Bear (Android share sheet, or any link that
// opens Bear with text). It hands the text to the capture box, ready for one tap.
function Share(){
 const router=useRouter();const p=useSearchParams();
 useEffect(()=>{
  const text=sharedText({title:p.get('title'),text:p.get('text'),url:p.get('url')});
  router.replace(text?`/bear/capture?text=${encodeURIComponent(text)}&shared=1`:'/bear/capture');
 },[p,router]);
 return <main id="main" className="bear-screen"><p className="muted" role="status">Opening Bear…</p></main>;
}
export default function SharePage(){return <Suspense fallback={null}><Share/></Suspense>;}
