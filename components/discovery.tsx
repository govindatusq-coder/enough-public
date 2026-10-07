"use client";
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {Bookmark,Footprints,Wallet,Clock,Search,MapPin,Leaf,Users,Heart,SlidersHorizontal,Sparkles,Check,ArrowRight} from 'lucide-react';
import {type Idea} from '@/lib/ideas';
import {receipt,completeProfile,type State} from '@/lib/journey';
import {formatMoney} from '@/lib/regions';
import {moneyValue} from '@/lib/recommendations';
import {EnoughWidgets,type TodayChoice} from '@/components/enough-widgets';
import {discoveryFilters,filterIdeas,ideaCover,isFreeMove,placeSearch,dashboardFilters,dashboardIdeas,dashboardGreeting,surpriseIdeaId,type DiscoveryFilter,type DashboardFilter,type DashboardOptions} from '@/lib/discovery';

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

type DashboardProps={state:State;ideas:Idea[];now:number;cloud:boolean;onSaved:()=>void;onIdea:(id:number)=>void;onBrowse:()=>void;onPins:()=>void;onWins:()=>void;onToday:(context?:string)=>void;onPlanned:()=>void};
const defaultDashboardOptions:DashboardOptions={query:'',maxMinutes:0,setting:'any',gentle:false};
export function EnoughDashboard({state,ideas,now,cloud,onSaved,onIdea,onBrowse,onPins,onWins,onToday,onPlanned}:DashboardProps){
 const [filter,setFilter]=useState<DashboardFilter>('For you');
 const [options,setOptions]=useState<DashboardOptions>(defaultDashboardOptions);
 const [filtersOpen,setFiltersOpen]=useState(false),[featuredId,setFeaturedId]=useState<number|null>(null);
 const hasFreeIdeas=ideas.some(isFreeMove);
 const matches=dashboardIdeas(ideas,filter,state,options);
 const featured=matches.find(i=>i.id===featuredId)||matches[0];
 const free=(featured?[featured,...matches.filter(i=>i.id!==featured.id)]:matches).slice(0,4);
 const saving=featured?moneyValue(featured,state):null;
 const personalised=completeProfile(state.profile);
 const chooseFilter=(next:DashboardFilter)=>{setFilter(next);setFeaturedId(next==='Surprise me'?surpriseIdeaId(dashboardIdeas(ideas,next,state,options),featured?.id??null):null)};
 const clearFilters=()=>{setFilter('For you');setOptions(defaultDashboardOptions);setFeaturedId(null)};
 const scrollToSection=(id='dashboard-discovery')=>requestAnimationFrame(()=>{
   document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 });
 const chooseSetting=(setting:'indoors'|'outside')=>{setFilter('For you');setOptions(p=>({...p,setting}));setFeaturedId(null);scrollToSection()};
 const chooseContext=(context:TodayChoice)=>{
   if(context==='Something else'){onToday();return}
   if(context==='Got some time'){setOptions(p=>({...p,maxMinutes:0}));setFilter('For you');setFiltersOpen(true);scrollToSection('dashboard-all-filters');return}
   if(context==='Want to get out'){chooseSetting('outside');return}
   if(context==='Low energy'){onToday('Lower energy');chooseFilter('Low energy')}
   else chooseFilter(context==='With the kids'?'With family':'Save money');
   scrollToSection();
 };
 const surprise=()=>{chooseFilter('Surprise me');scrollToSection('dashboard-featured')};
 return <div className="enough-dashboard">
 <section id="dashboard-featured" className="dashboard-hero featured-hero" aria-label="An idea for your day">
   <div className="featured-copy">
     <p className="dashboard-greeting">{dashboardGreeting(new Date(now))}{state.profile.name.trim()?`, ${state.profile.name.trim()}`:''}.</p>
     <h1>{featured?personalised?'I found something you might like.':'A little idea for the life you have.':'Your life comes first.'}</h1>
     <p className="featured-subtitle">{featured?personalised?'A small idea for a better today.':'An example to explore. Your PINS make it personal.':'We can find another way when something fits your needs.'}</p>
     {featured&&<><ul className="featured-benefits" aria-label="Estimated returns for the featured idea">
       <li><Footprints size={23}/><span><strong>{featured.minutes} min</strong><small>Movement · estimate</small></span></li>
       <li><Wallet size={23}/><span><strong>{formatMoney(saving?.cents||0,saving?.currency||state.profile.currency,state.profile.country)}</strong><small>MONEY SAVED · estimate</small></span></li>
       <li>{featured.social?<Users size={23}/>:<Clock size={23}/>}<span><strong>{featured.social?'A conversation':featured.extraMin>0?`${featured.extraMin} extra min`:featured.extraMin<0?`${-featured.extraMin} min reclaimed`:'No extra time'}</strong><small>{featured.social?'Time together':'Fits with your day'}</small></span></li>
     </ul><p className="featured-estimate-note">Idea estimates. Confirm what happened in My Wins.</p></>}
     {!personalised&&<button className="secondary" onClick={onPins}>Make it personal</button>}
   </div>
   {featured?<button className="featured-idea-card" onClick={()=>onIdea(featured.id)} aria-label={'Explore featured idea: '+featured.title}>
     <span className="featured-card-top"><Leaf size={20}/>Free activity<span className="featured-card-arrow"><ArrowRight size={22}/></span></span>
     <span className="featured-card-content"><span className="featured-card-photo"><Image src={ideaCover(featured)} alt={featured.alt||'Illustrative scene for this idea'} fill sizes="100px"/></span><span><strong>{featured.title}</strong><small>{featured.effort==='gentle'?'A gentle way to move':'Move at your own pace'} · {featured.minutes} min</small></span></span>
     <span className="featured-card-link">See this idea<ArrowRight size={17}/></span>
   </button>:<div className="featured-empty"><Leaf size={28}/><h2>{hasFreeIdeas?'A different filter might fit.':'Your needs come first.'}</h2><p>{hasFreeIdeas?'Try another filter to find a free idea.':'No free library idea currently clears your needs.'}</p><button className="secondary" onClick={hasFreeIdeas?clearFilters:onPins}>{hasFreeIdeas?'Clear filters':'Review My Pins'}</button></div>}
   <div className="dashboard-filter-row" role="toolbar" aria-label="Discover your next move">
     <div className="discovery-filters dashboard-filters">{dashboardFilters.map(f=><button key={f} aria-pressed={filter===f} aria-controls="dashboard-discovery" onClick={()=>chooseFilter(f)}>{f==='Nearby'&&<MapPin size={16}/>} {f==='Surprise me'&&<Sparkles size={16}/>} {f}</button>)}</div>
     <button className="dashboard-all-filters" aria-expanded={filtersOpen} aria-controls="dashboard-all-filters" onClick={()=>{setFiltersOpen(v=>!v);if(filter==='Nearby')setFilter('For you')}}><SlidersHorizontal size={18}/>All filters</button>
   </div>
 </section>
 {filtersOpen&&<section id="dashboard-all-filters" className="glass-panel dashboard-filter-panel" aria-label="All idea filters">
   <div className="section-heading"><h2>What would fit your day?</h2><button className="text-button" onClick={clearFilters}>Clear filters</button></div>
   <label className="idea-search"><Search size={20}/><span className="sr-only">Search today’s ideas</span><input type="search" value={options.query} onChange={e=>setOptions(p=>({...p,query:e.target.value}))} placeholder="Search calls, family, music…"/></label>
   <div className="dashboard-filter-fields"><label className="field">Activity length<select value={options.maxMinutes} onChange={e=>setOptions(p=>({...p,maxMinutes:Number(e.target.value)}))}><option value={0}>Any length</option>{[5,10,15,30].map(n=><option key={n} value={n}>Up to {n} minutes</option>)}</select></label>
     <label className="field">Setting<select value={options.setting} onChange={e=>setOptions(p=>({...p,setting:e.target.value as DashboardOptions['setting']}))}><option value="any">Any setting</option><option value="indoors">Indoors</option><option value="outside">Outside</option></select></label>
     <label className="check-field"><input type="checkbox" checked={options.gentle} onChange={e=>setOptions(p=>({...p,gentle:e.target.checked}))}/>Gentle movement only</label></div>
   <p className="sample-note">Your PINS boundaries apply to every filter.</p>
 </section>}
 <div id="dashboard-discovery">{filter==='Nearby'?<NearbyIdeas state={state}/>:<section className="opportunities"><div className="section-heading"><div><span className="eyebrow">A LITTLE POSSIBILITY</span><h2>Today’s opportunities</h2></div><button className="text-button" onClick={onBrowse}>See all ideas</button></div><p className="panel-intro">Free ways to move a little more, with what you already have.</p><p className="dashboard-result-count" role="status">{matches.length} free {matches.length===1?'idea':'ideas'}{filter==='For you'?'':` · ${filter}`}</p>{free.length?<div className="discovery-grid">{free.map(i=><IdeaTile key={i.id} idea={i} state={state} onOpen={onIdea}/>)}</div>:<div className="glass-empty"><Leaf size={26}/><h2>{hasFreeIdeas?'Let’s try another angle.':'Your needs come first.'}</h2><p>{filter==='Save money'?'No free idea in this view has a saving recorded in your currency yet. Free activities can still give you movement, time and enjoyment.':hasFreeIdeas?'No free ideas match these filters. Try another setting or search.':'No free library ideas currently clear your needs. Your boundaries still come first.'}</p><button className="secondary" onClick={hasFreeIdeas?clearFilters:onPins}>{hasFreeIdeas?'Clear filters':'Review My Pins'}</button></div>}</section>}</div>
 <EnoughWidgets state={state} now={now} cloud={cloud} onPins={onPins} onWins={onWins} onBrowse={onBrowse} onSaved={onSaved} onPlanned={onPlanned} onSetting={chooseSetting} onContext={chooseContext} onSurprise={surprise}/>
 {filter!=='Nearby'&&<NearbyIdeas state={state}/>}</div>;
}

export function WinsOverview({state,period,currency}:{state:State;period:string;currency:string}){
 const report=receipt(state.entries,period,currency);
 const known=report.rows;
 const experiences=[{label:'Time outside',value:report.outside+' min',Icon:Leaf},{label:'Time connecting',value:report.connecting+' min',Icon:Users},{label:'Tasks completed',value:String(known.filter(e=>e.gave?.includes('task_completed')).length),Icon:Check}];
 return <><ReturnMetrics state={state} period={period} currency={currency}/><div className="wins-evidence"><div className="glass-panel"><span className="eyebrow">MORE FROM YOUR EVERYDAY</span><h2>{known.length?`${known.length} confirmed ${known.length===1?'moment':'moments'}.`:'Your story starts with a moment.'}</h2><p>{known.length?'What it gave you matters as much as the movement.':'After trying an idea, tell us what happened. Your returns will appear here.'}</p></div><div className="glass-panel wins-extra">{experiences.map(({label,value,Icon})=><div key={label}><Icon size={21}/><strong>{value}</strong><span>{label}</span></div>)}</div></div></>;
}
