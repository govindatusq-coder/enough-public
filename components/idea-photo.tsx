"use client";
import {useCallback,useEffect,useSyncExternalStore} from 'react';
import type {Idea} from '@/lib/ideas';
import {createIdeaImageQueue,emptyImageSnapshot,imageClientKey,type ImageSnapshot} from '@/lib/idea-image-client';
import {ideaImageIdentity} from '@/lib/idea-image-spec';

export type IdeaImageContext={scope:string;ready:boolean;refresh?:number};
export type IdeaPhotoState=ImageSnapshot&{imageFailed:()=>void};
const queue=createIdeaImageQueue();
export function useIdeaPhoto(idea:Idea,context:IdeaImageContext={scope:'library',ready:false},library=true):IdeaPhotoState{
 const key=imageClientKey(idea,idea.source==='ai'?context.scope:'library');
 const subscribe=useCallback((listener:()=>void)=>queue.subscribe(key,listener),[key]);
 const snapshot=useCallback(()=>queue.snapshot(key),[key]);
 const result=useSyncExternalStore(subscribe,snapshot,()=>emptyImageSnapshot);
 const enabled=!idea.image&&(idea.source==='ai'?!!context.scope&&context.ready:library);
 useEffect(()=>{if(enabled)queue.prepare(idea,idea.source==='ai'?context.scope:'library',context.refresh);},[key,enabled,context.refresh]);
 return {...result,imageFailed:()=>queue.imageFailed(key)};
}
export function usePrepareIdeaPhotos(ideas:Idea[],context:IdeaImageContext){
 const signature=ideas.map(ideaImageIdentity).join('\n');
 useEffect(()=>{if(context.ready&&context.scope)for(const idea of ideas)if(idea.source==='ai')queue.prepare(idea,context.scope,context.refresh);},[signature,context.scope,context.ready,context.refresh]);
}
export function IdeaImageArt({idea,photo}:{idea:Idea;photo:IdeaPhotoState}){
 const credit=photo.credit;
 return credit?<><img className={credit.kind==='generated'?'generated-idea-picture':undefined} src={credit.image} alt={credit.alt||'A scene illustrating '+idea.title} onError={photo.imageFailed}/>{credit.kind==='generated'?<span className="image-note">AI-generated illustration</span>:<a className="image-note photo-credit" href={credit.sourceUrl} target="_blank" rel="noreferrer">{credit.creator} · {credit.license}</a>}</>:<div className={'idea-scene'+(idea.source==='ai'?' generated-idea-scene':'')} aria-busy={photo.status==='queued'||photo.status==='loading'}><span>{idea.category.toUpperCase()} · {idea.source==='ai'?'AI IDEA':'FROM YOUR LIBRARY'}</span><p>{idea.source==='ai'?idea.title:idea.usual}</p>{(photo.status==='queued'||photo.status==='loading')&&<span role="status">Loading picture…</span>}</div>;
}
export function IdeaPhoto({idea,photo}:{idea:Idea;photo:IdeaPhotoState}){
 return <div className="move-photo">{idea.image?<><img src={'/images/'+idea.image+'.webp'} alt={idea.alt}/><span className="image-note">Illustrative image</span></>:<IdeaImageArt idea={idea} photo={photo}/>}</div>;
}
