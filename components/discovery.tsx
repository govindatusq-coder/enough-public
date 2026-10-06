"use client";
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {Bookmark,Footprints,Wallet,Clock,Search,MapPin,Leaf,Users,Heart,SlidersHorizontal,Sparkles,Check,Pin,Camera,Wind} from 'lucide-react';
import {byId,type Idea} from '@/lib/ideas';
import {groups,receipt,type State} from '@/lib/journey';
import {formatMoney} from '@/lib/regions';
import {moneyValue} from '@/lib/recommendations';
import {discoveryFilters,filterIdeas,ideaCover,isFreeMove,placeSearch,type DiscoveryFilter} from '@/lib/discovery';

export function IdeaTile({idea,state,onOpen}:{idea:Idea;state:State;onOpen:(id:number)=>void}){
 const saving=moneyValue(idea,state);
 return <article className="discovery-card">
   <button className="discovery-photo" onClick={()=>onOpen(idea.id)} aria-label={'Explore '+idea.title}>
     <Image src={ideaCover(idea)} alt={idea.alt||'An everyday scene illustrating this movement idea'} fill sizes="(max-width: 560px) 85vw, (max-width: 1050px) 45vw, 25vw"/>
     <span className="discovery-badge">{isFreeMove(idea)?'Free activity':idea.source==='ai'?'AI idea':'Everyday idea'}</span>
     {state.saved.includes(idea.id)&&<span className="tile-saved" aria-label="Saved"><Bookmark size={19} fill="currentColor"/></span>}
   </button>
   <div className="discovery-card-body"><button className="tile-title" onClick={()=>onOpen(idea.id)}><h3>{idea.title}</h3></button><p>{idea.body}</p>
     <div className="tile-returns"><span><Footprints size={17}/><strong>{idea.minutes} min</strong></span><span><Wallet size={17}/><strong>{formatMoney(saving?.cents||0,saving?.currency||state.profile.currency,state.profile.country)}</strong></span></div>
     <div className="tile-return-labels"><span>Exercise Minutes</span><span>Money Saved · estimate</span></div>
     <div className="tile-bottom"><span><Clock size={15}/>{idea.extraMin>0?`${idea.extraMin} extra min`:idea.extraMin<0?`${-idea.extraMin} min reclaimed`:'No extra time'}</span><button className="text-button" onClick={()=>onOpen(idea.id)}>See idea</button></div>
   </div>
 </article>;
}

export function IdeaGrid({ideas,state,onOpen,onTune}:{ideas:Idea[];state:State;onOpen:(id:number)=>void;onTune:()=>void}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<DiscoveryFilter>('For you');
 const shown=filterIdeas(ideas,filter,query,state);
 return <section className="ideas-browser" aria-label="Find movement ideas"><div className="browser-tools"><label className="idea-search"><Search size={20}/><span className="sr-only">Search ideas</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your ideas — calls, family, music…"/></label><button className="secondary" onClick={onTune}><SlidersHorizontal size={18}/>All filters</button></div>
 <div className="discovery-filters" aria-label="Filter ideas">{discoveryFilters.map(f=><button key={f} aria-pressed={f===filter} onClick={()=>setFilter(f)}>{f}</button>)}</div>
 <div className="grid-summary"><p>{shown.length} {shown.length===1?'idea':'ideas'}{filter==='Free'?' with no purchase or entry fee':''}</p><span>On your terms. At your pace.</span></div>
 {shown.length?<div className="discovery-grid">{shown.map(i=><IdeaTile key={i.id} idea={i} state={state} onOpen={onOpen}/>)}</div>:<div className="glass-empty"><Search size={28}/><h2>{ideas.length?'No ideas with those filters.':'Your needs come first.'}</h2><p>{state.profile.needs.some(n=>n.startsWith('Something else: '))?'Your written need is saved. Suggestions are paused because ENOUGH cannot yet assess free-text needs. You can keep your answer or review the listed boundaries in My Pins.':ideas.length?'Try another word or view the ideas that fit your current needs.':'No library idea currently clears your constraints. You can keep your needs or revisit My Pins when something changes.'}</p><button className="secondary" onClick={()=>{setQuery('');setFilter('For you')}}>Clear search and filters</button></div>}
 </section>;
}

const places=[
 {name:'A little green space',description:'A gentle wander, or a call outside.',query:'public parks',Icon:Leaf,image:'/images/welcome-call.webp'},
 {name:'A path near home',description:'A few minutes of fresh air on a familiar route.',query:'public walking paths',Icon:Footprints,image:'/images/welcome-coast.webp'},
 {name:'While the kids play',description:'Move nearby while keeping them in sight.',query:'free public playgrounds',Icon:Users,image:'/images/welcome-school.webp'}
];
export function NearbyIdeas({state}:{state:State}){
 const [locality,setLocality]=useState('');
 useEffect(()=>{try{setLocality(localStorage.getItem('enough.nearby.locality.v1')||'')}catch{}},[]);
 const constrained=state.profile.needs.some(n=>['Physical comfort / accessibility','Pain / discomfort','Safety matters','Weather / heat','Hard to walk where I live','Transport limitations'].includes(n)||n.startsWith('Something else: '));
 return <section className="glass-panel nearby-panel"><div className="section-heading"><div><span className="eyebrow">FREE PLACES TO MOVE</span><h2>Ideas near you</h2></div><MapPin size={24}/></div><p className="panel-intro">Start close to home. No class, ticket or purchase needed.</p>
 <label className="locality-field"><MapPin size={19}/><span className="sr-only">Your suburb or town</span><input maxLength={100} value={locality} onChange={e=>{setLocality(e.target.value);try{localStorage.setItem('enough.nearby.locality.v1',e.target.value)}catch{}}} placeholder="Your suburb or town"/></label>
 {constrained?<div className="nearby-needs"><Heart size={23}/><p>Your current needs favour familiar, comfortable spaces. Try the indoor or seated ideas in your feed; update My Pins if your circumstances change.</p></div>:<div className="nearby-grid">{places.map(({name,description,query,Icon,image})=>{const href=placeSearch(query,locality);return <article key={name}><div className="nearby-photo"><Image src={image} alt="" fill sizes="(max-width: 560px) 90vw, 25vw"/></div><div><Icon size={19}/><h3>{name}</h3><p>{description}</p>{href?<a className="text-button" href={href} target="_blank" rel="noreferrer">Search places on map</a>:<span className="sample-note">Enter a town to search</span>}</div></article>})}</div>}
 <p className="sample-note nearby-note">Map searches help you find places. Check a venue’s access, opening hours and any fees before heading out.</p></section>;
}

export function ReturnMetrics({state,period='This month',currency=state.profile.currency}:{state:State;period?:string;currency?:string}){
 const report=receipt(state.entries,period,currency);
 const metrics=[{label:'Money Saved',value:formatMoney(report.money,currency,state.profile.country),caption:'Confirmed money kept',Icon:Wallet},{label:'Movement reported',value:report.rows.reduce((n,e)=>n+(e.minutes||0),0)+' min',caption:'Your confirmed activities',Icon:Footprints},{label:'Time combined',value:report.rows.reduce((n,e)=>n+(e.timeCombined||0),0)+' min',caption:'Alongside an existing task',Icon:Clock},{label:'Worthwhile moments',value:String(report.worthwhile),caption:'Things you said were worth it',Icon:Heart}];
 return <div className="return-metrics" aria-label={'Your confirmed returns · '+period}>{metrics.map(({label,value,caption,Icon})=><div key={label}><span className="metric-icon"><Icon size={25}/></span><strong>{value}</strong><span>{label}</span><small>{caption}</small></div>)}</div>;
}

type DashboardProps={state:State;ideas:Idea[];onIdea:(id:number)=>void;onBrowse:()=>void;onPins:()=>void;onWins:()=>void;onToday:(context?:string)=>void;onPlanned:()=>void};
export function EnoughDashboard({state,ideas,onIdea,onBrowse,onPins,onWins,onToday,onPlanned}:DashboardProps){
 const freePool=ideas.filter(isFreeMove);
 const categoriesShown=new Set<string>();
 const varied=freePool.filter(i=>{if(categoriesShown.has(i.category))return false;categoriesShown.add(i.category);return true});
 const free=[...varied,...freePool.filter(i=>!varied.includes(i))].slice(0,4);
 const recent=state.entries.filter(e=>e.status==='completed').slice(-3).reverse();
 const categories=groups.filter(g=>state.profile[g.key].length>0).length;
 const planned=state.entries.filter(e=>e.status==='accepted').length;
 return <div className="enough-dashboard"><section className="dashboard-hero"><div><span className="eyebrow">{state.profile.name?`A LITTLE SPACE FOR YOU, ${state.profile.name.toUpperCase()}`:'A LITTLE SPACE FOR YOU'}</span><h1>More life.<br/><em>In the life you have.</em></h1><p>Movement inside the things you’re already doing.<br/>Something back for you.</p><div className="action-row"><button className="primary" onClick={onBrowse}>Find my next move</button><button className="secondary" onClick={()=>onToday()}>Anything different today?</button></div></div><div className="hero-note"><Wind size={28}/><p>Less sacrifice.<br/><strong>More life.</strong></p><span>No catching up. No falling behind.</span></div></section>
 <section className="opportunities"><div className="section-heading"><div><span className="eyebrow">A LITTLE POSSIBILITY</span><h2>Today’s opportunities</h2></div><button className="text-button" onClick={onBrowse}>See all ideas</button></div><p className="panel-intro">Free ways to move a little more, with what you already have.</p>{free.length?<div className="discovery-grid">{free.map(i=><IdeaTile key={i.id} idea={i} state={state} onOpen={onIdea}/>)}</div>:<div className="glass-empty"><Leaf size={26}/><p>No free library ideas currently clear your needs. Your boundaries still come first.</p><button className="secondary" onClick={onPins}>Review My Pins</button></div>}</section>
 <div className="dashboard-columns"><section className="glass-panel"><div className="section-heading"><div><span className="eyebrow">YOUR ENOUGH</span><h2>A closer fit for your life.</h2></div><Pin size={24}/></div><div className="pins-readiness"><div className="pins-count"><strong>{categories}<small>/ 4</small></strong><span>PINS answered</span></div><div><p>{categories===4?'Your preferences, interests, needs and strengths are the starting point.':'A few things about you help us find a better fit.'}</p><button className="secondary" onClick={onPins}>{categories===4?'Revisit My Pins':'Set up My Pins'}</button></div></div><p className="sample-note">{state.entries.some(e=>e.status==='completed')?'Your confirmed feedback helps refine later matches.':'I’m still learning. Your feedback after a move helps refine later matches.'}</p></section>
 <section className="glass-panel"><div className="section-heading"><div><span className="eyebrow">ON YOUR TERMS</span><h2>What fits today?</h2></div><SlidersHorizontal size={23}/></div><div className="context-tiles">{[{label:'Low energy',value:'Lower energy',Icon:Heart},{label:'A little less time',value:'Less time',Icon:Clock},{label:'Plans changed',value:'Plans changed',Icon:CalendarIcon},{label:'Something else',value:undefined,Icon:Sparkles}].map(({label,value,Icon})=><button key={label} onClick={()=>onToday(value)}><Icon size={20}/>{label}</button>)}</div>{planned>0?<button className="text-button planned-link" onClick={onPlanned}>Check in on {planned===1?'your planned move':`your ${planned} planned moves`}</button>:<p className="sample-note">Take what fits. There’s nothing to make up.</p>}</section></div>
 <section className="glass-panel recent-panel"><div className="section-heading"><div><span className="eyebrow">YOUR LIFE LATELY</span><h2>Little moments. Yours to keep.</h2></div><button className="text-button" onClick={onWins}>My Wins</button></div>{recent.length?<div className="recent-moments">{recent.map(e=>{const i=byId(e.ideaId,state.generated);return <button key={e.id} onClick={onWins}><div className="recent-photo"><Image src={i?ideaCover(i):'/images/welcome-coast.webp'} alt="Illustrative activity scene" fill sizes="(max-width: 600px) 80vw, 30vw"/></div><span>{i?.title||'Your confirmed move'}</span><small>{e.minutes||0} min · {e.worthwhile?'Worthwhile for you':'Your experience'} · {new Date(e.completedAt!).toLocaleDateString()}</small></button>})}</div>:<div className="moments-empty"><Camera size={30}/><p>A walk, a conversation, a useful pause.<br/>Your confirmed moments will appear here.</p><button className="secondary" onClick={onBrowse}>Find an idea</button></div>}</section>
 <section className="glass-panel"><div className="section-heading"><div><span className="eyebrow">WHAT CAME BACK</span><h2>Your returns this month.</h2></div><button className="text-button" onClick={onWins}>See My Wins</button></div><ReturnMetrics state={state}/><p className="sample-note">Only outcomes confirmed by you. Money totals stay in {state.profile.currency}; different currencies stay separate.</p></section>
 <NearbyIdeas state={state}/></div>;
}
function CalendarIcon(){return <Clock size={20}/>;}

export function WinsOverview({state,period,currency}:{state:State;period:string;currency:string}){
 const report=receipt(state.entries,period,currency);
 const known=report.rows;
 const experiences=[{label:'Time outside',value:report.outside+' min',Icon:Leaf},{label:'Time connecting',value:report.connecting+' min',Icon:Users},{label:'Tasks completed',value:String(known.filter(e=>e.gave?.includes('task_completed')).length),Icon:Check}];
 return <><ReturnMetrics state={state} period={period} currency={currency}/><div className="wins-evidence"><div className="glass-panel"><span className="eyebrow">MORE FROM YOUR EVERYDAY</span><h2>{known.length?`${known.length} confirmed ${known.length===1?'moment':'moments'}.`:'Your story starts with a moment.'}</h2><p>{known.length?'What it gave you matters as much as the movement.':'After trying an idea, tell us what happened. Your returns will appear here.'}</p></div><div className="glass-panel wins-extra">{experiences.map(({label,value,Icon})=><div key={label}><Icon size={21}/><strong>{value}</strong><span>{label}</span></div>)}</div></div></>;
}
