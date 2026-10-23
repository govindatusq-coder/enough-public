import {brand} from '@/lib/bear/domain/copy';
export function Wordmark({size=56,stacked=true}:{size?:number;stacked?:boolean}){
 return <span className="wordmark display" style={{fontSize:size,gridAutoFlow:stacked?'row':'column',gap:stacked?0:'.3em'}} aria-label="Load Bear"><span className="load" aria-hidden="true">LOAD</span><span className="bearword" aria-hidden="true">BEAR</span></span>;
}
export function Tagline({size=26}:{size?:number}){
 return <span className="hand" style={{fontSize:size,color:'var(--navy)',lineHeight:1.15}}>Your mental load is <span className="tagline-swash">ours to bear.</span></span>;
}
export function BearSays({children,size=22}:{children:React.ReactNode;size?:number}){
 return <p className="hand" style={{fontSize:size,color:'var(--navy)',lineHeight:1.2}}>{children}</p>;
}
export const copy=brand;
