"use client";
import {illustrationFor} from '@/lib/illustrations';

/** A library painting. A planned painting that isn't uploaded yet falls back to the borrowed one, so nothing ever shows broken. */
export function Illustration({category,variant,eager=false}:{category:string;variant?:string|number;eager?:boolean}){
 const art=illustrationFor(category,variant);
 return <img src={art.src} alt="" loading={eager?'eager':'lazy'} decoding="async" onError={e=>{const img=e.currentTarget;if(art.fallback&&!img.src.endsWith(art.fallback))img.src=art.fallback;}}/>;
}
