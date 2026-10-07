"use client";
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {ArrowRight,Bookmark,Brain,Camera,Check,Clock,Footprints,Heart,Leaf,MoreHorizontal,Plus,Sparkles,Users,Wallet} from 'lucide-react';
import {byId,type Idea} from '@/lib/ideas';
import {ChoiceArtwork} from '@/components/pins-options';
import {completeProfile,localDate,receipt,type State} from '@/lib/journey';
import {ideaCover,recentMoments} from '@/lib/discovery';
import {dashboardActivity,durationLabel,momentDateLabel,previousReturns,returnCurrencies,returnPeriods,type ReturnPeriod} from '@/lib/dashboard';
import {formatMoney} from '@/lib/regions';

export type TodayChoice='Low energy'|'Got some time'|'With the kids'|'Save money'|'Want to get out'|'Something else';
type WidgetProps={
 state:State;now:number;cloud:boolean;
 onPins:()=>void;onWins:()=>void;onBrowse:()=>void;onSaved:()=>void;onPlanned:()=>void;
 onSetting:(setting:'indoors'|'outside')=>void;
 onContext:(context:TodayChoice)=>void;
 onSurprise:()=>void;
};
type ActivityPhoto={id:string;entry_id:string;caption:string;created_at:string};
type Activity=ReturnType<typeof dashboardActivity>;

function momentArtwork(idea:Idea|undefined){
 if(!idea)return 'Outside';
 if(idea.movementMode==='seated'||idea.movementMode==='stretch')return 'Physical comfort / accessibility';
 if(idea.category==='listen')return idea.key.includes('music')?'Music':idea.key.includes('audiobook')?'Audiobooks':'Podcasts';
 if(idea.key.includes('garden'))return 'Gardening';
 if(idea.key.includes('photo'))return 'Photography';
 if(idea.key.includes('dog'))return 'Animals';
 return ({call:'Calls',family:'Family time',work:'Work or study',chores:'Household tasks',think:'Solving problems',waiting:'Short bursts'} as Partial<Record<Idea['category'],string>>)[idea.category]||'Outside';
}

function PinsReadiness({state,activity,onPins,onSetting}:Pick<WidgetProps,'state'|'onPins'|'onSetting'>&{activity:Activity}){
 const ready=completeProfile(state.profile);
 return <section className="glass-panel enough-widget readiness-widget" aria-labelledby="readiness-heading">
   <div className="widget-heading"><h2 id="readiness-heading">Your Enough</h2><button className="widget-arrow" onClick={onPins} aria-label="Review My Pins"><ArrowRight size={19}/></button></div>
   <div className="readiness-body">
     <div className="readiness-ring" role="img" aria-label={`${activity.pinsAnswered} of 4 PINS categories answered`}>
       <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ring-track" cx="60" cy="60" r="51"/><circle className="ring-answer" cx="60" cy="60" r="51" pathLength="100" strokeDasharray={`${activity.pinsAnswered*25} 100`}/></svg>
       <div><strong>{activity.pinsAnswered}<small>/4</small></strong><span>PINS answered</span></div>
     </div>
     <div className="readiness-copy"><p>{ready?'A starting point that can change with you.':'A few answers help us find ideas that fit your life.'}</p>
       <p className="readiness-routines">{activity.routinesAnswered} of 3 life routine answers saved.</p>
       {ready?<><h3>What sounds better right now?</h3><div className="readiness-choices"><button onClick={()=>onSetting('outside')}><Leaf size={18}/>A little fresh air<ArrowRight size={16}/></button><button onClick={()=>onSetting('indoors')}><Heart size={18}/>Something indoors<ArrowRight size={16}/></button></div><small>Just for this view. Your PINS needs still apply.</small></>:<button className="secondary" onClick={onPins}>Continue my setup</button>}
     </div>
   </div>
 </section>;
}

function TodayProgress({activity,onWins,onPlanned}:{activity:Activity;onWins:()=>void;onPlanned:()=>void}){
 return <section className="glass-panel enough-widget progress-widget" aria-labelledby="today-progress-heading">
   <div className="widget-heading"><h2 id="today-progress-heading">Today’s progress</h2><button className="widget-link" onClick={onWins}>See all<ArrowRight size={16}/></button></div>
   <div className="today-stats"><div><span className={'today-stat-icon'+(activity.today?' has-progress':'')}><Check size={23}/></span><strong>{activity.today}</strong><span>Confirmed today</span></div><div><span className="today-stat-icon"><Footprints size={23}/></span><strong>{durationLabel(activity.todayMinutes)}</strong><span>Movement reported</span></div><button onClick={onPlanned}><span className="today-stat-icon"><Clock size={23}/></span><strong>{activity.planned}</strong><span>Open plans</span></button></div>
   <p className="widget-note">{activity.today?'A little of your day, confirmed by you.':activity.planned?'Your plans are here whenever something fits.':'Your day is open. Explore an idea when it suits you.'}</p>
 </section>;
}

function RecentLife({state,now,cloud,activity,onWins,onBrowse,onPlanned}:Pick<WidgetProps,'state'|'now'|'cloud'|'onWins'|'onBrowse'|'onPlanned'>&{activity:Activity}){
 const [photos,setPhotos]=useState<ActivityPhoto[]>([]),[photoError,setPhotoError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
   if(!cloud)return;
   const controller=new AbortController();
   void fetch('/api/photos',{cache:'no-store',signal:controller.signal}).then(async r=>{
     if(!r.ok)throw Error('Photos unavailable');
     const data=await r.json() as {photos:ActivityPhoto[]};
     if(!Array.isArray(data.photos))throw Error('Photos unavailable');
     if(!controller.signal.aborted){setPhotos(data.photos);setPhotoError(false)}
   }).catch(()=>{if(!controller.signal.aborted)setPhotoError(true)});
   return()=>controller.abort();
 },[cloud,retry]);
 const recent=recentMoments(state.entries,3,new Date(now));
 return <section className="glass-panel enough-widget life-widget" aria-labelledby="recent-life-heading">
   <div className="widget-heading"><h2 id="recent-life-heading">Your life lately</h2><button className="widget-link" onClick={onWins}>See all<ArrowRight size={16}/></button></div>
   <p className="widget-intro">{activity.month?<>You’ve confirmed <strong>{activity.month} {activity.month===1?'moment':'moments'}</strong> this month.</>:'Your real moments, and what they gave you.'}</p>
   <div className="life-moments">
     {recent.map(entry=>{
       const idea=byId(entry.ideaId,state.generated),photo=cloud?photos.find(p=>p.entry_id===entry.id):undefined;
       return <button className="life-moment" key={entry.id} onClick={onWins} aria-label={`See your moment: ${idea?.title||'Confirmed move'}`}>
         <span className="life-moment-photo">{photo?<img src={'/api/photos?id='+encodeURIComponent(photo.id)} alt={photo.caption||'Your private activity photo'} loading="lazy"/>:<>{idea?.image?<Image src={ideaCover(idea)} alt="" fill sizes="(max-width: 560px) 160px, 200px"/>:<ChoiceArtwork label={momentArtwork(idea)}/>}<span className="illustration-label">Illustration</span></>}</span>
         <span className="life-moment-title">{idea?.title||'Your confirmed move'}{entry.worthwhile&&<Heart size={17} fill="currentColor" aria-label="You said this was worthwhile"/>}</span><small>{momentDateLabel(entry.completedAt!,new Date(now))}</small>
       </button>;
     })}
     {!recent.length&&<div className="life-empty"><Camera size={29}/><h3>Little moments. Yours to keep.</h3><p>Confirm a move to start your story. Your photos stay private in My Wins.</p></div>}
     <button className="life-add" onClick={activity.planned?onPlanned:onBrowse}><Plus size={27}/><span>Add a moment</span><small>{activity.planned?'Check in on a planned move':'Find a move to try'}</small></button>
   </div>
   {photoError&&<p className="sample-note" role="status">Your private photos couldn’t load. <button className="text-button" onClick={()=>{setPhotoError(false);setRetry(n=>n+1)}}>Try again</button></p>}
 </section>;
}

function GivenBack({state,now}:Pick<WidgetProps,'state'|'now'>){
 const [period,setPeriod]=useState<ReturnPeriod>('This month'),[selectedCurrency,setSelectedCurrency]=useState<string|null>(null);
 const date=new Date(now),currencies=returnCurrencies(state,date),currency=selectedCurrency&&currencies.includes(selectedCurrency)?selectedCurrency:state.profile.currency;
 const report=receipt(state.entries,period,currency,date),previous=previousReturns(state.entries,period,currency,date);
 const moneyRows=report.rows.filter(e=>e.currency===currency);
 const metrics=[{label:'Moving',value:durationLabel(report.rows.reduce((n,e)=>n+(e.minutes||0),0)),Icon:Footprints},{label:'Time combined',value:durationLabel(report.rows.reduce((n,e)=>n+(e.timeCombined||0),0)),Icon:Clock},{label:'Worthwhile',value:report.worthwhile,Icon:Heart},{label:'Confirmed moments',value:report.rows.length,Icon:Check}];
 return <section className="glass-panel enough-widget given-back-widget" aria-labelledby="given-back-heading">
   <div className="widget-heading"><h2 id="given-back-heading">Enough has given back</h2><label className="widget-select"><span className="sr-only">Return period</span><select value={period} onChange={e=>setPeriod(e.target.value as ReturnPeriod)}>{returnPeriods.map(p=><option key={p}>{p}</option>)}</select></label></div>
   {currencies.length>1&&<label className="widget-currency">Money currency<select value={currency} onChange={e=>setSelectedCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label>}
   <div className="given-back-money" aria-label={`Confirmed money kept in ${currency}`}><strong>{formatMoney(report.money,currency,state.profile.country)}</strong><span><Wallet size={17}/>Money kept · confirmed</span></div>
   {previous&&<p className="previous-return">{previous.label}: {formatMoney(previous.money,currency,state.profile.country)} confirmed</p>}
   <div className="given-back-metrics">{metrics.map(({label,value,Icon})=><div key={label}><Icon size={21}/><strong>{value}</strong><span>{label}</span></div>)}</div>
   <p className="widget-note">{!report.rows.length?'Confirm an outcome to see what came back.':!moneyRows.length?`No confirmed money entries in ${currency} for this period. Movement and moments include all currencies.`:currencies.length>1?'Money currencies stay separate. Movement and moments include all currencies.':'Only outcomes you confirmed. Time combined overlaps with moving time.'}</p>
 </section>;
}

function WeekActivity({activity,onWins}:{activity:Activity;onWins:()=>void}){
 return <section className="glass-panel enough-widget week-widget" aria-labelledby="week-activity-heading">
   <div className="widget-heading"><h2 id="week-activity-heading">Your week, at your pace</h2><button className="widget-arrow" onClick={onWins} aria-label="See activity history"><ArrowRight size={19}/></button></div>
   <div className="week-body"><div className="week-count"><Leaf size={29}/><strong>{activity.activeDays}</strong><span>{activity.activeDays===1?'day':'days'} with a<br/>confirmed moment</span></div><div className="activity-days" aria-label="Confirmed moments this week">{activity.days.map(d=><div key={d.date} className={(d.today?'is-today ':'')+(d.future?'is-future':'')} aria-label={`${d.label}: ${d.count} confirmed ${d.count===1?'moment':'moments'}${d.today?', today':''}`}><span className={d.count?'day-has-moment':''}>{d.count?<Check size={18}/>:<span className="day-dot"/>}</span><small>{d.label}</small></div>)}</div></div>
   <p className="widget-note">Each check marks a move you confirmed. You decide what enough looks like.</p>
 </section>;
}

function SavedForYou({state,onSaved}:Pick<WidgetProps,'state'|'onSaved'>){
 const saved=[...new Set(state.saved)].map(id=>byId(id,state.generated)).filter(i=>i!==undefined);
 return <section className="glass-panel enough-widget saved-widget" aria-labelledby="saved-widget-heading">
   <div className="widget-heading"><h2 id="saved-widget-heading">Kept for another day</h2><Bookmark size={20}/></div>
   <h3>{saved.length?<>{saved.length} {saved.length===1?'idea':'ideas'} you liked the look of.</>:'A place for your possibilities.'}</h3>
   {saved.length>0&&<div className="saved-peek" aria-hidden="true">{saved.slice(0,3).map(i=><span key={i.id}><Image src={ideaCover(i)} alt="" fill sizes="70px"/></span>)}</div>}
   <p>{saved.length?'Your Saved ideas are here when the day has room. Your current needs are checked when you open them.':'Save an idea in My Moves to find it here later.'}</p><button className="widget-link" onClick={onSaved}>See Saved<ArrowRight size={16}/></button>
 </section>;
}

function Learning({state,activity,onPins}:Pick<WidgetProps,'state'|'onPins'>&{activity:Activity}){
 const [acknowledged,setAcknowledged]=useState('');
 const pinsKey=JSON.stringify([state.profile.preferences,state.profile.interests,state.profile.needs,state.profile.strengths]);
 const interests=state.profile.interests.filter(i=>i!=='Nothing to add').slice(0,3).map(i=>i.replace(/^Something else: /,''));
 return <section className="glass-panel enough-widget learning-widget" aria-labelledby="learning-heading">
   <div className="widget-heading"><h2 id="learning-heading"><Brain size={21}/>Enough is learning</h2></div>
   <p>{interests.length?<>You’ve told us you enjoy <strong>{interests.join(', ')}</strong>.</>:'Your PINS help us start with what matters to you.'}</p>
   {activity.confirmed>0&&<p className="learning-feedback">You said {activity.worthwhile} of {activity.confirmed} confirmed {activity.confirmed===1?'move was':'moves were'} worthwhile.{activity.worthwhileOutside>0&&<> {activity.worthwhileOutside} included time outside.</>}{activity.worthwhileTogether>0&&<> {activity.worthwhileTogether} included connection.</>}</p>}
   <p className="learning-question">Does your profile still fit?</p><div className="learning-actions"><button className="secondary" onClick={()=>setAcknowledged(pinsKey)}>Yes, still right</button><button className="secondary" onClick={onPins}>Not quite</button></div>
   {acknowledged===pinsKey&&<p className="learning-ack" role="status"><Check size={16}/>Your current PINS will keep shaping your ideas.</p>}
   <button className="widget-link" onClick={onPins}>Update My Pins<ArrowRight size={16}/></button>
 </section>;
}

const contexts=[{label:'Low energy',Icon:Heart},{label:'Got some time',Icon:Clock},{label:'With the kids',Icon:Users},{label:'Save money',Icon:Wallet},{label:'Want to get out',Icon:Leaf},{label:'Something else',Icon:MoreHorizontal}] as const;
function TodayContext({state,now,onContext}:Pick<WidgetProps,'state'|'now'|'onContext'>){
 const note=state.today.date===localDate(new Date(now))?state.today.context:'';
 return <section className="glass-panel enough-widget today-context-widget" aria-labelledby="today-context-heading"><div className="widget-heading"><h2 id="today-context-heading">Anything different today?</h2></div><div className="today-context-tiles">{contexts.map(({label,Icon})=><button key={label} onClick={()=>onContext(label)}><Icon size={19}/><span>{label}</span></button>)}</div><p className="widget-note">{note?<>Today’s note: <strong>{note}</strong></>:'Pick what fits right now. Your PINS needs always apply.'}</p></section>;
}

export function EnoughWidgets(props:WidgetProps){
 const activity=dashboardActivity(props.state,new Date(props.now));
 return <div className="enough-widgets" aria-label="Your Enough at a glance">
   <div className="enough-widget-grid">
     <PinsReadiness state={props.state} activity={activity} onPins={props.onPins} onSetting={props.onSetting}/>
     <TodayProgress activity={activity} onWins={props.onWins} onPlanned={props.onPlanned}/>
     <RecentLife state={props.state} now={props.now} cloud={props.cloud} activity={activity} onWins={props.onWins} onBrowse={props.onBrowse} onPlanned={props.onPlanned}/>
     <GivenBack state={props.state} now={props.now}/>
     <WeekActivity activity={activity} onWins={props.onWins}/>
     <SavedForYou state={props.state} onSaved={props.onSaved}/>
   </div>
   <div className="enough-widget-bottom"><Learning state={props.state} activity={activity} onPins={props.onPins}/><TodayContext state={props.state} now={props.now} onContext={props.onContext}/><button className="surprise-widget" onClick={props.onSurprise}><Image src="/images/welcome-coast.webp" alt="" fill sizes="(max-width: 760px) 90vw, 300px"/><span className="surprise-content"><Sparkles size={27}/><strong>Find me something I’d never think of.</strong><small>A free idea that fits your PINS.</small><span className="surprise-arrow"><ArrowRight size={24}/></span></span></button></div>
 </div>;
}
