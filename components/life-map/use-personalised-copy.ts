"use client";
import {useEffect,useState} from 'react';
import {cardCopy,personaliseWithFallback,type CardCopy} from '@/lib/opportunity-copy';
import type {Ranked} from '@/lib/opportunity-engine';
import type {Situation} from '@/lib/opportunity-log';
import {localDay} from '@/lib/life-map';

/**
 * Template copy immediately; AI wording swaps in only if it arrives and passes
 * validation. Cached for the day so one card costs at most one request.
 */
export function usePersonalisedCopy(r:Ranked|null,enabled:boolean,situation?:Situation,extraAllowance?:number):CardCopy|null{
 const base=r?cardCopy(r):null;
 const key=r?`enough.copy.v1:${localDay()}:${r.opportunity.id}:${r.minutes}:${situation||''}`:'';
 const [copy,setCopy]=useState<CardCopy|null>(null);
 useEffect(()=>{
  setCopy(null);
  if(!r||!enabled)return;
  try{const cached=sessionStorage.getItem(key);if(cached){setCopy(JSON.parse(cached));return;}}catch{}
  let live=true;
  void personaliseWithFallback(r,async()=>{
   const res=await fetch('/api/personalise',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({opportunityId:r.opportunity.id,...(situation?{situation}:{}),...(extraAllowance!==undefined?{extraAllowance}:{})})});
   if(!res.ok)throw Error('unavailable');
   const data=await res.json() as {copy?:{title:string;body:string;why:string;minutes:number}|null};
   if(!data.copy)throw Error('no copy');
   return {headline:data.copy.title,body:data.copy.body,why:data.copy.why,minutes:data.copy.minutes};
  }).then(result=>{if(!live||result.source!=='ai')return;setCopy(result);try{sessionStorage.setItem(key,JSON.stringify(result))}catch{}});
  return()=>{live=false};
 },[key,enabled]);
 return copy||base;
}
