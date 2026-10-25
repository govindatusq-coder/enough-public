'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {AreaKey,EmptyMoment,PersonRole,Preferences,Profile,RhythmBlock,Weekday} from '@/lib/bear/domain/types';
import {interestOptions,needsOptions,strengthOptions,weekdays} from '@/lib/bear/domain/types';
import {rhythmPresets} from '@/lib/bear/domain/labels';
import {HeroBear} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Horizon} from '@/components/bear/horizon';
import {Button,Chip,Progress,Tile,Toast,TopBar} from '@/components/bear/ui';
import {AreaArt,NeedArt,InterestArt,StrengthArt} from '@/components/bear/tile-art';
import {areaArt,Art,CapacityArt,EmptyArt,interestArt,needArt,PeopleHeader,prefArt,strengthArt} from '@/components/bear/art';

const steps=['areas','people','needs','interests','strengths','preferences','rhythm','capacity','done'] as const;
type Step=typeof steps[number];
const areaTiles:{key:AreaKey;label:string;sub:string}[]=[{key:'work',label:'Work',sub:'Deadlines, meetings, the lot'},{key:'family',label:'Family',sub:'Kids, partner, parents'},{key:'home',label:'Home',sub:'The house and everything in it'},{key:'money',label:'Money',sub:'Bills, fees, subscriptions'},{key:'health',label:'Health',sub:'Appointments and care'},{key:'me',label:'Me',sub:'The person carrying it all'}];
const peopleOptions:{role:PersonRole;label:string;named:boolean}[]=[{role:'me',label:'Me',named:false},{role:'partner',label:'Partner',named:true},{role:'child',label:'Children',named:true},{role:'parent',label:'Parents',named:true},{role:'family',label:'Other family',named:true},{role:'pet',label:'Pets',named:true},{role:'other',label:'Someone else',named:true}];
const emptyOptions:{key:EmptyMoment;label:string}[]=[{key:'morning_scramble',label:'Morning scramble'},{key:'mid_afternoon',label:'Mid-afternoon slump'},{key:'after_work',label:'After work'},{key:'dinner_bedtime',label:'Dinner / bedtime'},{key:'sunday_night',label:'Sunday night'},{key:'it_changes',label:'It changes'},{key:'none',label:'None of these'}];
const prefQuestions:{key:keyof Preferences;q:string;options:{value:string;label:string}[]}[]=[
 {key:'reminderLeadTime',q:'How much notice do you like before something is due?',options:[{value:'same_day',label:'Same day'},{value:'day_before',label:'The day before'},{value:'few_days',label:'A few days'},{value:'week',label:'About a week'}]},
 {key:'nudgeTolerance',q:'How much nudging is okay?',options:[{value:'minimal',label:'As little as possible'},{value:'gentle',label:'A gentle amount'},{value:'keen',label:'Keep me on track'}]},
 {key:'planningDetail',q:'How much detail helps?',options:[{value:'just_the_task',label:'Just the task'},{value:'a_few_steps',label:'A few steps'},{value:'full_plan',label:'The full plan'}]},
 {key:'proactiveSuggestions',q:'Should Bear suggest things it notices?',options:[{value:'often',label:'Yes, often'},{value:'sometimes',label:'Sometimes'},{value:'rarely',label:'Rarely'}]},
 {key:'tone',q:'How should Bear talk to you?',options:[{value:'warm',label:'Warm & encouraging'},{value:'direct',label:'Straight to the point'},{value:'cheeky',label:'A little cheeky'}]},
];
const dayLabel:Record<Weekday,string>={mon:'M',tue:'T',wed:'W',thu:'T',fri:'F',sat:'S',sun:'S'};
const hhmm=(m:number)=>{const h=Math.floor(m/60),mm=m%60;const ap=h>=12&&h<24?'pm':'am';return `${((h+11)%12)+1}${mm?':'+String(mm).padStart(2,'0'):''}${ap}`;};

export default function Onboarding(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);const [step,setStep]=useState<Step>('areas');const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const [people,setPeople]=useState<{role:PersonRole;name:string}[]>([]);
 const [names,setNames]=useState<Partial<Record<PersonRole,string>>>({});
 const [rhythmDay,setRhythmDay]=useState<Weekday>('tue');const [editing,setEditing]=useState<string|null>(null);const [customLabel,setCustomLabel]=useState('');
 useEffect(()=>{apiGet<{profile:Profile}>('/api/bear/profile').then(({profile})=>{setProfile(profile);setPeople(profile.people);setStep(steps[Math.min(profile.onboardingStep,steps.length-2)]);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);});},[router]);
 const index=steps.indexOf(step);
 const save=useCallback(async(patch:Record<string,unknown>,next:Step)=>{if(!profile)return;setBusy(true);setError(null);
  try{const {profile:p}=await apiSend<{profile:Profile}>('/api/bear/profile',{...patch,onboardingStep:steps.indexOf(next)},'PUT');setProfile(p);setStep(next);window.scrollTo({top:0});}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}},[profile]);
 const back=()=>setStep(steps[Math.max(0,index-1)]);
 const update=(patch:Partial<Profile>)=>setProfile(p=>p?{...p,...patch}:p);
 const toggle=<T,>(list:T[],v:T)=>list.includes(v)?list.filter(x=>x!==v):[...list,v];
 const blocks=useMemo(()=>profile?.lifeRhythm.blocks||[],[profile]);
 const setBlocks=(b:RhythmBlock[])=>update({lifeRhythm:{timezone:profile?.lifeRhythm.timezone||'Australia/Sydney',blocks:b}});
 const dayBlocks=useMemo(()=>blocks.filter(b=>b.days.includes(rhythmDay)&&b.kind!=='sleep'),[blocks,rhythmDay]);
 const editingBlock=blocks.find(b=>b.id===editing)||null;
 if(!profile)return <main id="main" className="bear-screen flow">{error?<p className="note coral" role="alert">{error}</p>:<div className="skeleton" style={{minHeight:200}}/>}</main>;
 const pins=profile.pins;
 return (
  <main id="main" className="bear-screen flow" style={{position:'relative',overflow:'hidden'}}>
   {step!=='done'&&<Horizon height={140} tint={index%2?'cool':'warm'}/>}
   <div style={{position:'relative',zIndex:1}}>
   {step!=='done'&&<><TopBar back={index>0?{onClick:back}:{href:'/bear/welcome'}} right={<span className="faint">{index+1} of {steps.length-1}</span>}/><Progress step={index} total={steps.length-1}/><div style={{textAlign:'right',marginTop:6}}><button type="button" className="btn quiet sm" disabled={busy} onClick={()=>save({onboardingComplete:true},'done')}>Skip the rest for now</button></div></>}
   {step==='areas'&&<section>
    <h1>What&rsquo;s in your life?</h1><p className="muted" style={{marginTop:8}}>Pick everything you regularly have to think about.</p>
    <div className="tiles section">{areaTiles.map((t,i)=><Tile key={t.key} photo={!!areaArt[t.key]} tint={['#E3F1FB','#FFE6E7','#FFEFC9','#D5F3F0','#FFE1DE','#FFEFC9'][i]} label={t.label} sub={t.sub} selected={profile.areas.includes(t.key)} onToggle={()=>update({areas:toggle(profile.areas,t.key)})} art={<AreaArt area={t.key}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy||profile.areas.length===0} onClick={()=>save({areas:profile.areas},'people')}>Next</Button></div>
   </section>}
   {step==='people'&&<section>
    <div className="people-head"><div><h1>Who do you carry things for?</h1><p className="muted" style={{marginTop:8}}>Bear can remember people as well as tasks.</p></div><PeopleHeader/></div>
    <div className="chips section">{peopleOptions.map(o=>{const on=people.some(p=>p.role===o.role);return <Chip key={o.role} label={o.label} selected={on} onToggle={()=>setPeople(on?people.filter(p=>p.role!==o.role):[...people,{role:o.role,name:o.role==='me'?(profile.name||''):(names[o.role]||'')}])}/>;})}</div>
    {peopleOptions.filter(o=>o.named&&people.some(p=>p.role===o.role)).map(o=><div key={o.role} className="field"><label htmlFor={'n-'+o.role}>{o.label} — names (optional)</label><input id={'n-'+o.role} placeholder={o.role==='child'?'Ava, Max':'Name'} value={names[o.role]||''} onChange={e=>setNames({...names,[o.role]:e.target.value})}/></div>)}
    <div className="field"><label htmlFor="myname">And you?</label><input id="myname" placeholder="Your first name" value={profile.name} maxLength={40} onChange={e=>update({name:e.target.value})}/></div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>{const list:{role:PersonRole;name:string}[]=[];for(const p of people){if(p.role==='me')list.push({role:'me',name:profile.name});else{const ns=(names[p.role]||'').split(',').map(s=>s.trim()).filter(Boolean);if(ns.length)ns.forEach(n=>list.push({role:p.role,name:n}));else list.push({role:p.role,name:''});}}save({people:list,name:profile.name},'needs');}}>Next</Button><Button variant="quiet" onClick={()=>save({name:profile.name},'needs')}>Skip for now</Button></div>
   </section>}
   {step==='needs'&&<section>
    <h1>Where would another brain help?</h1><p className="muted" style={{marginTop:8}}>Pick as many as you like.</p>
    <div className="tiles section">{needsOptions.map((n,i)=><Tile key={n} compact side={!!needArt[n]} tint={['#FFE6E7','#E3F1FB','#D5F3F0','#FFEFC9','#E4DDFB'][i%5]} label={n} selected={pins.needs.includes(n)} onToggle={()=>update({pins:{...pins,needs:toggle(pins.needs,n)}})} art={<NeedArt label={n}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({pins},'interests')}>Next</Button></div>
   </section>}
   {step==='interests'&&<section>
    <h1>What do you want more room for?</h1><p className="muted" style={{marginTop:8}}>Bear protects time for these when it can.</p>
    <div className="tiles section three">{interestOptions.map((n,i)=><Tile key={n} compact photo={!!interestArt[n]} tint={['#E4DDFB','#FFE6E7','#D5F3F0','#FFE1DE','#FFEFC9','#E3F1FB'][i%6]} label={n} selected={pins.interests.includes(n)} onToggle={()=>update({pins:{...pins,interests:toggle(pins.interests,n)}})} art={<InterestArt label={n}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({pins},'strengths')}>Next</Button></div>
   </section>}
   {step==='strengths'&&<section>
    <h1>You&rsquo;ve already got a lot working.</h1><p className="muted" style={{marginTop:8}}>Pick what you&rsquo;re already good at. Bear works around it.</p>
    <div className="tiles section three">{strengthOptions.map((n,i)=><Tile key={n} compact photo={!!strengthArt[n]} tint={['#E3F1FB','#D5F3F0','#FFEFC9','#FFE6E7','#E4DDFB'][i%5]} label={n} selected={pins.strengths.includes(n)} onToggle={()=>update({pins:{...pins,strengths:toggle(pins.strengths,n)}})} art={<StrengthArt label={n}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({pins},'preferences')}>Next</Button></div>
   </section>}
   {step==='preferences'&&<section>
    <h1>How do you like to get things done?</h1>
    {prefQuestions.map(p=><div key={p.key} className="card pref-card" style={{marginTop:14}}><Art file={prefArt[p.key]}/><div><h3>{p.q}</h3><div className="chips" style={{marginTop:10}} role="group" aria-label={p.q}>{p.options.map(o=><Chip key={o.value} label={o.label} selected={pins.preferences[p.key]===o.value} onToggle={()=>update({pins:{...pins,preferences:{...pins.preferences,[p.key]:o.value}}})}/>)}</div></div></div>)}
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({pins},'rhythm')}>Next</Button></div>
   </section>}
   {step==='rhythm'&&<section>
    <h1>What&rsquo;s a normal week like?</h1><p className="muted" style={{marginTop:8}}>Tap the parts of your week that usually happen. Bear uses this to pick good moments, and to leave you alone in the bad ones.</p>
    <div className="chips section">{rhythmPresets.map(p=>{const on=blocks.some(b=>b.kind===p.kind&&b.label===p.label);return <Chip key={p.kind+p.label} label={p.label} selected={on} onToggle={()=>setBlocks(on?blocks.filter(b=>!(b.kind===p.kind&&b.label===p.label)):[...blocks,{...p,id:p.kind+'-'+Math.random().toString(36).slice(2,8)}])}/>;})}</div>
    <div className="chips" style={{marginTop:10}}><input aria-label="Custom routine name" className="chip" style={{minWidth:160}} placeholder="Add custom routine" value={customLabel} onChange={e=>setCustomLabel(e.target.value)} maxLength={30}/><Button variant="ghost" className="sm" disabled={!customLabel.trim()} onClick={()=>{const id='custom-'+Math.random().toString(36).slice(2,8);setBlocks([...blocks,{id,kind:'custom',label:customLabel.trim(),days:['mon','tue','wed','thu','fri'],startMinute:18*60,endMinute:19*60,capacity:'low'}]);setCustomLabel('');setEditing(id);}}>Add</Button></div>
    <div className="section">
     <div className="daybar" role="tablist" aria-label="Day of the week">{weekdays.map(d=><button key={d} role="tab" aria-selected={rhythmDay===d} onClick={()=>setRhythmDay(d)}>{dayLabel[d]}</button>)}</div>
     <div className="rhythm" aria-label={`Timeline for ${rhythmDay}`}>
      <div className="hours">{Array.from({length:18},(_,i)=><span key={i}>{hhmm((6+i)*60)}</span>)}</div>
      <div className="track">{dayBlocks.map(b=>{const start=Math.max(6*60,b.startMinute),end=b.endMinute<b.startMinute?24*60:Math.min(24*60,b.endMinute);const top=(start-6*60)/60*22,h=Math.max(20,(end-start)/60*22-2);return <button key={b.id} className={`block ${b.capacity}`} style={{top,height:h}} onClick={()=>setEditing(b.id)} aria-label={`${b.label} ${hhmm(b.startMinute)} to ${hhmm(b.endMinute)}, tap to adjust`}>{b.label}</button>;})}
       {dayBlocks.length===0&&<div style={{padding:14}}><p className="faint">Nothing yet for this day. Tap routines above to add them.</p><div style={{marginTop:40}}><EmptyArt file="empty-rhythm"/></div></div>}
      </div>
     </div>
     <p className="tiny faint" style={{marginTop:8}}>Coral: no room · Mustard: a little · Teal: good time for admin</p>
    </div>
    {editingBlock&&<div className="glass" style={{padding:16,marginTop:14}} role="group" aria-label={`Adjust ${editingBlock.label}`}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>{editingBlock.label}</strong><Button variant="quiet" className="sm" onClick={()=>setEditing(null)}>Done</Button></div>
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
      <div className="field" style={{marginTop:0}}><label>Starts</label><select value={editingBlock.startMinute} onChange={e=>setBlocks(blocks.map(b=>b.id===editingBlock.id?{...b,startMinute:+e.target.value}:b))}>{Array.from({length:48},(_,i)=><option key={i} value={i*30}>{hhmm(i*30)}</option>)}</select></div>
      <div className="field" style={{marginTop:0}}><label>Ends</label><select value={editingBlock.endMinute} onChange={e=>setBlocks(blocks.map(b=>b.id===editingBlock.id?{...b,endMinute:+e.target.value}:b))}>{Array.from({length:48},(_,i)=><option key={i} value={i*30}>{hhmm(i*30)}</option>)}</select></div>
     </div>
     <div className="daybar">{weekdays.map(d=><button key={d} aria-pressed={editingBlock.days.includes(d)} onClick={()=>setBlocks(blocks.map(b=>b.id===editingBlock.id?{...b,days:toggle(b.days,d)}:b))}>{dayLabel[d]}</button>)}</div>
     <div className="chips">{(['none','low','some','good'] as const).map(c=><Chip key={c} label={{none:'No room',low:'A little room',some:'Some room',good:'Good for admin'}[c]} selected={editingBlock.capacity===c} onToggle={()=>setBlocks(blocks.map(b=>b.id===editingBlock.id?{...b,capacity:c}:b))}/>)}</div>
     <Button variant="quiet" className="sm" style={{marginTop:8}} onClick={()=>{setBlocks(blocks.filter(b=>b.id!==editingBlock.id));setEditing(null);}}>Remove</Button>
    </div>}
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({lifeRhythm:profile.lifeRhythm},'capacity')}>Next</Button></div>
   </section>}
   {step==='capacity'&&<section>
    <h1>When are you usually running on empty?</h1><p className="muted" style={{marginTop:8}}>Bear uses this to know when to leave you alone.</p>
    <div className="chips section">{emptyOptions.map(o=><Chip key={o.key} label={o.label} selected={profile.emptyMoments.includes(o.key)} onToggle={()=>{const none=o.key==='none';update({emptyMoments:none?(profile.emptyMoments.includes('none')?[]:['none']):toggle(profile.emptyMoments.filter(m=>m!=='none'),o.key)});}}/>)}</div>
    <p className="faint" style={{marginTop:16}}>These are only estimates. Bear never assumes it knows how you feel, and an empty calendar doesn&rsquo;t mean an empty tank.</p>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({emptyMoments:profile.emptyMoments,onboardingComplete:true},'done')}>That&rsquo;s me</Button></div>
    <CapacityArt/>
   </section>}
   {step==='done'&&<section style={{textAlign:'center',paddingTop:24}}>
    <HeroBear width={280}/>
    <h1 style={{marginTop:12}}>You&rsquo;re all set{profile.name?`, ${profile.name}`:''}.</h1>
    <BearSays size={26}>Mama Bear&rsquo;s got you.</BearSays>
    <p className="muted" style={{marginTop:14}}>Give Bear anything: a bill, a school note, an appointment, a thought. Check what it reads, then forget about it.</p>
    <div className="btn-stack"><Button variant="coral" onClick={()=>router.replace('/bear/capture?first=1')}>Give it to Bear</Button><Button variant="quiet" onClick={()=>router.replace('/bear/home')}>Have a look around first</Button></div>
   </section>}
   </div>
   <Toast message={error} kind="error" onDone={()=>setError(null)}/>
   <span className="sr-only" aria-live="polite">{busy?'Saving':''}</span>
  </main>
 );
}
