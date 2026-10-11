"use client";
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import type {State} from '@/lib/journey';
import type {Idea} from '@/lib/ideas';
import {mergeIdeas} from '@/lib/suggestion-history';
type Page={ideas:Idea[];hasMore:boolean;nextCursor:string|null;error?:string};
export function useSuggestionHistory(owner:string,enabled:boolean,setState:Dispatch<SetStateAction<State>>){
 const [cursor,setCursor]=useState<string|null>(null),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const busy=useRef(false),scope=useRef(enabled?owner:'');scope.current=enabled?owner:'';
 const read=async(before:string|null,signal?:AbortSignal)=>{
  const res=await fetch('/api/ideas/history'+(before?'?before='+encodeURIComponent(before):''),{cache:'no-store',signal});
  const page=await res.json() as Page;if(!res.ok)throw Error(page.error||'Earlier suggestions could not be loaded.');return page;
 };
 const apply=(page:Page)=>{setState(s=>({...s,generated:mergeIdeas(page.ideas,s.generated||[])}));setCursor(page.nextCursor);setHasMore(page.hasMore);setError('');};
 useEffect(()=>{
  setCursor(null);setHasMore(false);setError('');busy.current=false;setLoading(false);
  if(!enabled||!owner)return;
  const abort=new AbortController();busy.current=true;setLoading(true);
  void read(null,abort.signal).then(page=>{if(!abort.signal.aborted)apply(page)}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Earlier suggestions could not be loaded.')}).finally(()=>{if(!abort.signal.aborted){busy.current=false;setLoading(false)}});
  return()=>abort.abort();
 },[owner,enabled]);
 const loadMore=async()=>{
  if(busy.current||!enabled)return;
  const requestedOwner=owner;busy.current=true;setLoading(true);setError('');
  try{const page=await read(cursor);if(scope.current===requestedOwner)apply(page);}
  catch(e){if(scope.current===requestedOwner)setError(e instanceof Error?e.message:'Earlier suggestions could not be loaded.');}
  finally{if(scope.current===requestedOwner){busy.current=false;setLoading(false)}}
 };
 return {hasMore,loading,error,loadMore};
}
