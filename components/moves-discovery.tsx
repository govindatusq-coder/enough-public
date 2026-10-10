"use client";
import Image from 'next/image';
import {useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Bike,Bookmark,Check,Clock,Footprints,Headphones,Heart,LayoutGrid,Leaf,MapPin,PanelsTopLeft,Search,SlidersHorizontal,Sparkles,Video,Volleyball,Wallet} from 'lucide-react';
import {ChoiceArtwork} from '@/components/pins-options';
import {IdeaImageArt,useIdeaPhoto,type IdeaImageContext,type IdeaPhotoState} from '@/components/idea-photo';
import {NearbyIdeas} from '@/components/discovery';
import {type Idea} from '@/lib/ideas';
import {completeProfile,type State} from '@/lib/journey';
import {dashboardActivity} from '@/lib/dashboard';
import {isFreeMove,surpriseIdeaId} from '@/lib/discovery';
import {moneyValue} from '@/lib/recommendations';
import {formatMoney} from '@/lib/regions';
import {defaultMoveOptions,favouriteCollections,moveCollections,moveFeedback,moveFilters,movesIdeas,moveVisual,type MoveFilter,type MoveOptions} from '@/lib/moves';

type Props={state:State;ideas:Idea[];now:number;onOpen:(id:number)=>void;onSave:(id:number)=>void;onSaved:()=>void;onPlanned:()=>void;onPins:()=>void;onWins:()=>void;onTune:()=>void;imageContext:IdeaImageContext;aiAvailable:boolean;aiBusy:boolean;aiDisabled:boolean;aiError:string;onGenerate:()=>void};
function scrollTo(id:string){requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}))}
function MoveArt({idea,art,photo}:{idea?:Idea;art?:string;photo?:IdeaPhotoState}){
 if(idea?.source==='ai'&&photo)return <IdeaImageArt idea={idea} photo={photo}/>;
 const visual=idea?moveVisual(idea):{art:art||'Outside'};
 const Icon=visual.art==='Cycling'?Bike:visual.art==='Video call'?Video:visual.art==='Active play'?Volleyball:null;
 return visual.image?<Image src={visual.image} alt="" fill sizes="(max-width: 560px) 80vw, (max-width: 1000px) 45vw, 320px"/>:Icon?<span className="choice-art choice-art-icon" aria-hidden="true"><Icon strokeWidth={1.3}/></span>:visual.art==='Garden + Podcast'?<><ChoiceArtwork label="Household tasks"/><span className="move-art-companion" aria-hidden="true"><Headphones size={27}/></span></>:<ChoiceArtwork label={visual.art}/>;
}
function MoveCard({idea,state,now,onOpen,onSave,surprise,imageContext}:{idea:Idea;state:State;now:number;onOpen:(id:number)=>void;onSave:(id:number)=>void;surprise:boolean;imageContext:IdeaImageContext}){
 const photo=useIdeaPhoto(idea,imageContext,false);
 const saving=moneyValue(idea,state),feedback=moveFeedback(idea.id,state,new Date(now)),saved=state.saved.includes(idea.id);
 return <article className={'discovery-card move-idea-card'+(surprise?' move-surprise-card':'')}>
   <div className="move-card-art"><button className="move-card-cover" onClick={()=>onOpen(idea.id)} aria-label={'Explore '+idea.title}><MoveArt idea={idea} photo={photo}/>{idea.source!=='ai'&&<span className="move-art-label">Illustrative scene</span>}</button>
     <span className="move-source-badge">{surprise?<><Sparkles size={13}/>Something different</>:isFreeMove(idea)?<><Leaf size={13}/>Free activity</>:idea.source==='ai'?'AI idea':'Everyday idea'}</span>
     <button className="move-quick-save" aria-label={(saved?'Remove saved idea: ':'Save idea: ')+idea.title} aria-pressed={saved} onClick={()=>onSave(idea.id)}><Bookmark size={20} fill={saved?'currentColor':'none'}/></button>
   </div>
   <div className="move-card-copy"><button className="tile-title" onClick={()=>onOpen(idea.id)}><h3>{idea.title}</h3></button><p>{idea.body}</p>
     {idea.source==='ai'&&photo.status==='error'&&<div className="move-picture-retry"><p>{photo.error}</p><button className="text-button" onClick={photo.retry}>Retry picture</button></div>}
     <div className="move-card-returns"><div><Footprints size={19}/><span><strong>{idea.minutes} min</strong><small>Movement · estimate</small></span></div><div><Wallet size={19}/><span><strong>{formatMoney(saving?.cents||0,saving?.currency||state.profile.currency,state.profile.country)}</strong><small>MONEY SAVED · estimate</small></span></div></div>
     <div className="move-card-time"><Clock size={15}/>{idea.extraMin>0?`${idea.extraMin} extra min`:idea.extraMin<0?`${-idea.extraMin} min reclaimed`:'No extra time'}</div>
     <div className="move-card-feedback">{feedback.tries?<><Heart size={15}/><span>{feedback.worthwhile} of your {feedback.tries} {feedback.tries===1?'try':'tries'} felt worthwhile</span></>:<><Leaf size={15}/><span>{idea.effort==='gentle'?'A gentle idea to explore.':'Choose a pace that suits you.'}</span></>}</div>
     <button className="widget-link" onClick={()=>onOpen(idea.id)}>See this idea<ArrowRight size={16}/></button>
   </div>
 </article>;
}

export function MovesDiscovery({state,ideas,now,onOpen,onSave,onSaved,onPlanned,onPins,onWins,onTune,imageContext,aiAvailable,aiBusy,aiDisabled,aiError,onGenerate}:Props){
 const [filter,setFilter]=useState<MoveFilter>('For you'),[options,setOptions]=useState<MoveOptions>(defaultMoveOptions),[filtersOpen,setFiltersOpen]=useState(false);
 const [layout,setLayout]=useState<'row'|'grid'>('row'),[limit,setLimit]=useState(8),[surpriseId,setSurpriseId]=useState<number|null>(null),[collection,setCollection]=useState<string|null>(null),[savedOnly,setSavedOnly]=useState(false);
 const rail=useRef<HTMLDivElement>(null),personal=completeProfile(state.profile),activity=dashboardActivity(state,new Date(now));
 const collections=moveCollections(ideas,state,new Date(now)),favourites=favouriteCollections(ideas,state);
 const pool=movesIdeas(ideas,filter,state,options),selected=collection?collections.find(t=>t.key===collection):undefined;
 const narrowed=selected?pool.filter(i=>selected.ideas.some(p=>p.id===i.id)&&(!savedOnly||state.saved.includes(i.id))):collection?[]:pool;
 const featured=narrowed.find(i=>i.id===surpriseId)||narrowed[0];
 const shown=filter==='Surprise me'&&featured?[featured,...narrowed.filter(i=>i.id!==featured.id)]:narrowed;
 const free=pool.filter(isFreeMove),planned=activity.planned;
 const clear=()=>{setFilter('For you');setOptions(defaultMoveOptions);setCollection(null);setSavedOnly(false);setSurpriseId(null);setLimit(8)};
 const chooseFilter=(value:MoveFilter)=>{setFilter(value);setCollection(null);setSavedOnly(false);setLimit(8);setSurpriseId(value==='Surprise me'?surpriseIdeaId(movesIdeas(ideas,value,state,options),featured?.id??null):null);if(value==='Near me')scrollTo('moves-nearby');else if(rail.current)rail.current.scrollLeft=0};
 const surprise=()=>{chooseFilter('Surprise me');scrollTo('moves-idea-results')};
 const chooseCollection=(key:string,saved=false)=>{setFilter('For you');setOptions(defaultMoveOptions);setCollection(key);setSavedOnly(saved);setSurpriseId(null);setLimit(8);scrollTo('moves-idea-results')};
 const pageRail=(direction:number)=>rail.current?.scrollBy({left:direction*(rail.current.clientWidth*.85),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <div className="moves-discovery">
   <section className="moves-hero" aria-labelledby="moves-hero-heading">
     <div className="moves-hero-copy"><span className="eyebrow">MY MOVES · LIFE FIRST</span><h1 id="moves-hero-heading">What could you do<br/>with the time you have?</h1><p>Ideas for more movement inside an ordinary day. Choose what fits.</p>{!personal&&<><p className="moves-example-note">These are examples. Your PINS and routines make them personal.</p><button className="secondary" onClick={onPins}>Set up My Pins</button></>}</div>
     <div className="moves-hero-tools"><label className="idea-search moves-search"><Search size={20}/><span className="sr-only">Search ideas</span><input type="search" value={options.query} onChange={e=>{setOptions(p=>({...p,query:e.target.value}));setLimit(8)}} placeholder="Search calls, family, music…"/></label>
       <button className="moves-opportunity" onClick={()=>{chooseFilter('Free');scrollTo('moves-idea-results')}}><span className="moves-opportunity-icon"><Leaf size={28}/></span><span><strong>Today’s opportunities</strong><span>{free.length} free {free.length===1?'idea':'ideas'} {personal?'within your current needs':'to explore'}</span><small>A little possibility, at your pace.</small></span><ArrowRight size={21}/></button>
     </div>
     <div className="moves-filter-row" role="toolbar" aria-label="Discover My Moves"><div className="discovery-filters">{moveFilters.map(f=><button key={f} aria-pressed={filter===f&&!collection} onClick={()=>chooseFilter(f)}>{f==='Near me'&&<MapPin size={15}/>} {f==='Surprise me'&&<Sparkles size={15}/>} {f}</button>)}</div><button className="moves-all-filters" aria-expanded={filtersOpen} aria-controls="moves-all-filters" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={18}/>All filters</button></div>
   </section>

   {filtersOpen&&<section id="moves-all-filters" className="glass-panel moves-filter-panel" aria-label="All movement idea filters"><div className="wins-section-heading"><h2>What fits right now?</h2><button className="text-button" onClick={clear}>Clear filters</button></div><div className="moves-filter-fields">
     <label className="field">Activity length<select value={options.maxMinutes} onChange={e=>setOptions(p=>({...p,maxMinutes:Number(e.target.value)}))}><option value={0}>Any length</option>{[5,10,15,30,60].map(n=><option key={n} value={n}>Up to {n} minutes</option>)}</select></label>
     <label className="field">Setting<select value={options.setting} onChange={e=>setOptions(p=>({...p,setting:e.target.value as MoveOptions['setting']}))}><option value="any">Any setting</option><option value="indoors">Indoors</option><option value="outside">Outside</option></select></label>
     <label className="field">Part of your day<select value={options.category} onChange={e=>setOptions(p=>({...p,category:e.target.value as MoveOptions['category']}))}>{[['any','Any activity'],['call','Calls'],['listen','Listening'],['family','Family time'],['chores','Household tasks'],['work','Work or study'],['waiting','Waiting'],['think','Thinking'],['errand','Errands'],['shopping','Shopping'],['travel','Travel'],['coffee','Coffee'],['other','Other activities']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label className="check-field"><input type="checkbox" checked={options.gentle} onChange={e=>setOptions(p=>({...p,gentle:e.target.checked}))}/>Gentle movement only</label><label className="check-field"><input type="checkbox" checked={options.noExtra} onChange={e=>setOptions(p=>({...p,noExtra:e.target.checked}))}/>No extra time</label>
   </div><div className="moves-filter-footnote"><p>Your PINS boundaries apply to every filter.</p><button className="text-button" onClick={onTune}>Tune my ideas and usual costs</button></div></section>}

   <section id="moves-idea-results" className="moves-results" aria-label="Find movement ideas">
     <div className="moves-results-heading"><div><span className="eyebrow">{personal?'SHAPED BY YOUR PINS':'IDEAS TO EXPLORE'}</span><h2>{selected?selected.title+(savedOnly?' · saved':''):filter==='Surprise me'?'Something you might not think of.':'A little possibility.'}</h2><p role="status">{shown.length} {shown.length===1?'idea':'ideas'}{selected?' in this collection':filter==='For you'?'':` · ${filter}`}</p></div><div className="moves-result-actions"><div className="moves-layout-control" aria-label="Idea display"><button aria-label="Card row" aria-pressed={layout==='row'} onClick={()=>setLayout('row')}><PanelsTopLeft size={18}/></button><button aria-label="Card grid" aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}><LayoutGrid size={18}/></button></div>{layout==='row'&&shown.length>1&&<div className="moves-rail-controls"><button aria-label="Previous idea cards" onClick={()=>pageRail(-1)}><ArrowLeft size={18}/></button><button aria-label="Next idea cards" onClick={()=>pageRail(1)}><ArrowRight size={18}/></button></div>}</div></div>
     {collection&&<div className="moves-collection-filter"><span>{savedOnly?'Saved ideas within your current needs.':selected?.reason||'Your collection has no ideas within these filters.'}</span><button className="text-button" onClick={()=>{setCollection(null);setSavedOnly(false)}}>Show every collection</button></div>}
     {shown.length?<><div ref={rail} className={'moves-card-list moves-card-'+layout}>{shown.slice(0,limit).map(i=><MoveCard key={i.id} idea={i} state={state} now={now} onOpen={onOpen} onSave={onSave} surprise={filter==='Surprise me'&&i.id===featured?.id} imageContext={imageContext}/>)}</div>{shown.length>limit&&<button className="secondary moves-show-more" onClick={()=>setLimit(n=>n+8)}>Show more ideas</button>}</>:<div className="glass-empty moves-empty"><Leaf size={27}/><h2>{ideas.length?'Let’s try another angle.':'Your needs come first.'}</h2><p>{state.profile.needs.some(n=>n.startsWith('Something else: '))?'Your written need is saved. Suggestions are paused because ENOUGH cannot yet assess free-text needs. Keep your answer or review the listed boundaries in My Pins.':filter==='Save money'?'No saving is recorded for these ideas in your currency. A free move can still give you movement, useful time, and enjoyment.':ideas.length?'Try another word, setting or collection. Your current needs will keep applying.':'No library idea currently clears your needs. Keep your boundaries, or revisit My Pins when something changes.'}</p><button className="secondary" onClick={ideas.length?clear:onPins}>{ideas.length?'Clear search and filters':'Review My Pins'}</button></div>}
     <div className="moves-library-note"><p>Movement, time and savings are estimates. Only confirmed outcomes enter My Wins.</p><div><button className="text-button" onClick={onTune}>Tune my ideas</button>{aiAvailable&&<button className="secondary" disabled={aiBusy||aiDisabled} onClick={onGenerate}>{aiBusy?'Preparing ideas…':'Generate fresh ideas'}</button>}</div></div>{aiError&&<p className="storage-alert" role="alert">{aiError}</p>}
   </section>

   <div className="moves-context-row">
     <button className="glass-panel moves-week" onClick={onWins}><span className="moves-context-icon"><Leaf size={27}/></span><span><strong>{activity.activeDays}</strong><span>{activity.activeDays===1?'day':'days'} with a moment this week</span></span><span className="activity-days" aria-label="Your confirmed activity this week">{activity.days.map(d=><span key={d.date} aria-label={`${d.label}: ${d.count} confirmed moments`} className={(d.today?'is-today ':'')+(d.future?'is-future':'')}><span className={d.count?'day-has-moment':''}>{d.count?<Check size={13}/>:<span className="day-dot"/>}</span><small>{d.label}</small></span>)}</span></button>
     <button className="glass-panel moves-plan-preview" onClick={onPlanned}><span className="moves-context-icon"><Clock size={26}/></span><span><strong>{planned?`${planned} ${planned===1?'move':'moves'} waiting for you`:'Room for a future move.'}</strong><span>{planned?'Your plans, for when they fit.':'An idea can wait until it fits your day.'}</span><small>Plans are intentions. Returns start after confirmation.</small></span><ArrowRight size={19}/></button>
     <button className="glass-panel moves-pins-preview" onClick={onPins}><span className="moves-context-icon"><Heart size={25}/></span><span><strong>Your life comes first.</strong><span>{personal?[...state.profile.preferences.slice(0,1),...state.profile.rhythms.slice(0,1)].join(' · ')||'Your current PINS guide these ideas.':'Your PINS help us find a closer fit.'}</span><small>{personal?'Change your PINS when life changes.':'Name and visual preferences are optional.'}</small></span><ArrowRight size={19}/></button>
   </div>

   <section className="glass-panel moves-collections" aria-labelledby="moves-collections-heading"><div className="wins-section-heading"><div><span className="eyebrow">MORE WAYS INTO YOUR DAY</span><h2 id="moves-collections-heading">{personal&&collections.some(c=>c.personal)?'Because you like…':'Collections to explore'}</h2></div><button className="text-button" onClick={()=>{clear();scrollTo('moves-idea-results')}}>See all ideas<ArrowRight size={15}/></button></div>{collections.length?<div className="move-collection-list">{collections.map(t=><button key={t.key} onClick={()=>chooseCollection(t.key)}><span className="move-collection-art"><MoveArt idea={t.ideas[0]}/></span><strong>{t.title}</strong><span>{t.ideas.length} {t.ideas.length===1?'idea':'ideas'}<ArrowRight size={14}/></span><small>{t.reason}</small></button>)}</div>:<p className="moves-collection-empty">Collections appear when an idea fits your current needs.</p>}</section>

   <div className="moves-discovery-footer">
     <section className="glass-panel moves-favourites" aria-labelledby="moves-favourites-heading"><div className="wins-section-heading"><h2 id="moves-favourites-heading">Your favourites</h2><Bookmark size={20}/></div><p>Ideas you saved for another day.</p>{favourites.length?<div className="move-favourite-list">{favourites.slice(0,4).map(t=><button key={t.key} onClick={()=>chooseCollection(t.key,true)}><span className="move-favourite-art"><MoveArt idea={t.ideas[0]}/></span><span><strong>{t.title}</strong><small>{t.ideas.length} saved {t.ideas.length===1?'idea':'ideas'} within your needs</small></span><ArrowRight size={16}/></button>)}</div>:<div className="moves-favourites-empty"><Bookmark size={24}/><p>{state.saved.length?'Your saved ideas are still kept. Review Saved to see how your current needs apply.':'Use the bookmark on an idea to keep it here.'}</p></div>}<button className="widget-link" onClick={onSaved}>See Saved{state.saved.length>0&&` (${state.saved.length})`}<ArrowRight size={16}/></button><small className="moves-topic-note">An idea can belong to more than one collection.</small></section>
     <div id="moves-nearby" className="moves-nearby"><NearbyIdeas state={state}/></div>
     <section className="moves-surprise"><Image src="/images/welcome-coast.webp" alt="" fill sizes="(max-width: 760px) 90vw, 350px"/><div><Sparkles size={30}/><span className="eyebrow">A DIFFERENT POSSIBILITY</span><h2>Surprise me.</h2><p>A free idea you might not normally think of. Your needs still come first.</p><button className="primary" onClick={surprise}>Find something different<ArrowRight size={17}/></button></div></section>
   </div>
 </div>;
}
