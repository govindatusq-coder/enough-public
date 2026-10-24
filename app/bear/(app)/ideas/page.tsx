'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import type {Suggestion} from '@/lib/bear/domain/types';
import {EmptyArt} from '@/components/bear/art';
import {Button,ErrorCard,Skeleton,Toast} from '@/components/bear/ui';
export default function Ideas(){
 const router=useRouter();const [items,setItems]=useState<Suggestion[]|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [leaving,setLeaving]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<{suggestions:Suggestion[]}>('/api/bear/suggestions').then(r=>{setItems(r.suggestions);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[router]);
 useEffect(()=>{load();},[load]);
 async function respond(s:Suggestion,response:'accept'|'reject'){setLeaving(s.id);try{await apiSend('/api/bear/suggestions/respond',{suggestionId:s.id,response});
  if(response==='accept'&&s.kind==='missing_expected'){router.push('/bear/capture');return;}
  if(response==='accept'&&s.kind==='add_related_areas'){router.push('/bear/capture');return;}
  if(response==='accept'&&s.kind==='bill_increased'){router.push(`/bear/bills/${s.payload.billId}`);return;}
  setToast(response==='accept'?"Added. Bear's got it.":"Noted. Bear will suggest less of that.");setTimeout(()=>{setItems(list=>list?list.filter(x=>x.id!==s.id):list);setLeaving(null);},450);}
  catch(e){setError((e as Error).message);setLeaving(null);}}
 return (
  <main id="main" className="bear-screen">
   <h1>{brand.ideasHeading}</h1><p className="muted" style={{marginTop:6}}>Things Bear spotted that might save you a thought. Nothing happens unless you say so.</p>
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   <div className="section">
    {!items&&!error&&<Skeleton/>}
    {items&&items.length===0&&<div className="card" style={{textAlign:'center'}}><EmptyArt file="empty-ideas"/><p style={{fontWeight:700,fontSize:19}}>Nothing to suggest right now.</p><p className="muted small" style={{marginTop:4}}>When Bear notices a pattern worth acting on, it&rsquo;ll show up here.</p></div>}
    {items?.map(s=><div key={s.id} className={`card ${leaving===s.id?'collapse-out':''}`}><p style={{fontWeight:700,fontSize:18}}>{s.title}</p><p className="muted small" style={{marginTop:6}}>{s.body}</p><div className="btn-row"><Button className="sm" variant="primary" disabled={leaving===s.id} onClick={()=>respond(s,'accept')}>{s.actionLabel}</Button><Button className="sm" variant="quiet" disabled={leaving===s.id} onClick={()=>respond(s,'reject')}>Not relevant</Button></div></div>)}
   </div>
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
