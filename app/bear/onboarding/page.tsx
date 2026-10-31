'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {PersonRole,Preferences,Profile} from '@/lib/bear/domain/types';
import type {LoadDomain,LoadMap} from '@/lib/bear/load/types';
import {areasFromDomains,cognitiveProfileFrom,domainOptions,handoverOptions,struggleOptions} from '@/lib/bear/load/loadmap';
import {CaptureBear,Art,prefArt,TileImage} from '@/components/bear/art';
import {Horizon} from '@/components/bear/horizon';
import {Button,Chip,Progress,Tile,Toast,TopBar} from '@/components/bear/ui';
import {NeedArt} from '@/components/bear/tile-art';

// Onboarding builds the Load Map: short, progressive and skippable at every step. It ends by
// giving Bear one real thing, processed by the real Load Pattern Engine, not a demo.
const steps=['carry','glance','struggles','handover','behave','first'] as const;
type Step=typeof steps[number];
const struggleArt:Record<string,string>={forget_until_urgent:'Things I just forget',wrong_time:'Family calendar',too_many_steps:'Forms & admin',putting_off:'Housework',lost_in_messages:'Appointments',too_much:'Work deadlines',following_up:'Bills & money',coordinating:'Activities & sport'};
const tints=['#E3F1FB','#FFE6E7','#FFEFC9','#D5F3F0','#FFE1DE','#E4DDFB'];
const household=[{key:'just_me',label:'Just me',icon:undefined},{key:'partner',label:'Partner or other adult',icon:'ob-who-partner'},{key:'children',label:'Children',icon:'ob-who-children'},{key:'dependants',label:'Other dependants',icon:'ob-who-support'}] as const;
const ages=['0-4','5-11','12-17','18+'] as const;
const work=[{key:'full_time',label:'Full-time'},{key:'part_time',label:'Part-time'},{key:'shift',label:'Shift or irregular'},{key:'study',label:'Study'},{key:'not_working',label:'Not working right now'},{key:'other',label:'Other'}] as const;
const caring=[{key:'children',label:'Children',icon:'ob-who-children'},{key:'older_family',label:'Older family',icon:'ob-who-older'},{key:'support_needs',label:'Someone with support needs',icon:'ob-who-support'},{key:'pets',label:'Pets',icon:'ob-who-pets'},{key:'none',label:'None',icon:undefined}] as const;
const regions:Record<string,string[]>={Australia:['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'],'New Zealand':[],'United Kingdom':[],'United States':[],Other:[]};
const behave:{key:'canWait'|'urgent'|'ignored';q:string;art:string;options:{value:string;label:string}[]}[]=[
 {key:'canWait',q:'If something can wait',art:prefArt.nudgeTolerance,options:[{value:'leave',label:'Leave it alone'},{value:'gentle',label:'Gentle reminder'},{value:'visible',label:'Keep it visible'}]},
 {key:'urgent',q:'If something becomes urgent',art:prefArt.reminderLeadTime,options:[{value:'tell',label:'Let me know'},{value:'persistent',label:'Be persistent'},{value:'help',label:'Help me deal with it'}]},
 {key:'ignored',q:'If I keep ignoring something',art:prefArt.proactiveSuggestions,options:[{value:'keep',label:'Keep reminding me'},{value:'ask',label:'Ask what’s getting in the way'},{value:'back_off',label:'Back off'}]},
];

export default function Onboarding(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);const [step,setStep]=useState<Step>('carry');const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const [map,setMap]=useState<LoadMap>({domains:{}});
 useEffect(()=>{apiGet<{profile:Profile}>('/api/bear/profile').then(({profile})=>{setProfile(profile);setMap(profile.loadMap||{domains:{}});setStep(steps[Math.min(profile.onboardingStep,steps.length-1)]);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);});},[router]);
 const index=steps.indexOf(step);
 const save=useCallback(async(patch:Record<string,unknown>,next:Step)=>{if(!profile)return;setBusy(true);setError(null);
  try{const {profile:p}=await apiSend<{profile:Profile}>('/api/bear/profile',{...patch,onboardingStep:steps.indexOf(next)},'PUT');setProfile(p);setStep(next);window.scrollTo({top:0});}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}},[profile]);
 const back=()=>setStep(steps[Math.max(0,index-1)]);
 const toggle=<T,>(list:T[]|undefined,v:T)=>(list||[]).includes(v)?(list||[]).filter(x=>x!==v):[...(list||[]),v];
 if(!profile)return <main id="main" className="bear-screen flow">{error?<p className="note coral" role="alert">{error}</p>:<div className="skeleton" style={{minHeight:200}}/>}</main>;
 const shape=map.household?.shape||[];
 const peopleFromHousehold=():{role:PersonRole;name:string}[]=>[{role:'me',name:profile.name},...(shape.includes('partner')?[{role:'partner' as PersonRole,name:''}]:[]),...(map.household?.children||[]).map(()=>({role:'child' as PersonRole,name:''})),...(shape.includes('dependants')?[{role:'family' as PersonRole,name:''}]:[])];
 const prefsFrom=(m:LoadMap):Preferences=>({...profile.pins.preferences,nudgeTolerance:m.preferences?.canWait==='leave'?'minimal':m.preferences?.canWait==='visible'?'keen':'gentle',planningDetail:m.handover?.length&&!m.handover.some(h=>h==='steps'||h==='all')?'just_the_task':profile.pins.preferences.planningDetail,reminderLeadTime:m.struggles?.includes('forget_until_urgent')?'few_days':profile.pins.preferences.reminderLeadTime});
 const finish=(m:LoadMap)=>save({loadMap:m,pins:{...profile.pins,preferences:prefsFrom(m)},onboardingComplete:true},'first');
 return (
  <main id="main" className="bear-screen flow" style={{position:'relative',overflow:'hidden'}}>
   <Horizon height={140} tint={index%2?'cool':'warm'}/>
   <div style={{position:'relative',zIndex:1}}>
   <TopBar back={index>0?{onClick:back}:{href:'/bear/welcome'}} right={<span className="faint">{index+1} of {steps.length}</span>}/><Progress step={index} total={steps.length}/>
   {step!=='first'&&<div style={{textAlign:'right',marginTop:6}}><button type="button" className="btn quiet sm" disabled={busy} onClick={()=>finish(map)}>Skip the rest for now</button></div>}
   {step==='carry'&&<section>
    <h1>What&rsquo;s yours to carry?</h1><p className="muted" style={{marginTop:8}}>Pick everything you look after. Just the broad strokes.</p>
    <div className="tiles section">{domainOptions.map((d,i)=><Tile key={d.key} photo tint={tints[i%tints.length]} label={d.label} sub={d.sub} selected={!!map.domains[d.key]} onToggle={()=>setMap(m=>({...m,domains:{...m.domains,[d.key]:!m.domains[d.key]}}))} art={<TileImage file={`ob-domain-${d.key}`}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy||!Object.values(map.domains).some(Boolean)} onClick={()=>save({loadMap:map,areas:areasFromDomains(map.domains)},'glance')}>Next</Button></div>
   </section>}
   {step==='glance'&&<section>
    <h1>Your life at a glance</h1><p className="muted" style={{marginTop:8}}>A few broad strokes so Bear asks fewer questions later. Skip anything.</p>
    <div className="field"><label htmlFor="myname">What should Bear call you?</label><input id="myname" placeholder="Your first name" value={profile.name} maxLength={40} onChange={e=>setProfile({...profile,name:e.target.value})}/></div>
    <div className="card pref-card" style={{marginTop:14}}><Art file="people-header"/><div><h3>Who&rsquo;s at home?</h3>
     <div className="chips" style={{marginTop:10}} role="group" aria-label="Who's at home">{household.map(h=><Chip key={h.key} icon={h.icon} label={h.label} selected={shape.includes(h.key)} onToggle={()=>setMap(m=>{const next=h.key==='just_me'?(shape.includes('just_me')?[]:['just_me' as const]):toggle(shape.filter(x=>x!=='just_me'),h.key);return {...m,household:{...m.household,shape:next,children:next.includes('children')?(m.household?.children||[]):[]}};})}/>)}</div>
     {shape.includes('children')&&<><p className="small muted" style={{marginTop:12}}>Ages, if you like (tap once per child)</p><div className="chips" style={{marginTop:6}}>{ages.map(a=>{const n=(map.household?.children||[]).filter(c=>c.ageBand===a).length;return <Chip key={a} label={n?`${a} ×${n}`:a} selected={n>0} onToggle={()=>setMap(m=>({...m,household:{...m.household,children:[...(m.household?.children||[]),{ageBand:a}]}}))}/>;})}{(map.household?.children||[]).length>0&&<button type="button" className="chip" onClick={()=>setMap(m=>({...m,household:{...m.household,children:[]}}))}>Clear ages</button>}</div></>}
    </div></div>
    <div className="card pref-card" style={{marginTop:14}}><Art file={prefArt.planningDetail}/><div><h3>Work</h3><div className="chips" style={{marginTop:10}} role="group" aria-label="Work">{work.map(w=><Chip key={w.key} label={w.label} selected={map.workPattern?.type===w.key} onToggle={()=>setMap(m=>({...m,workPattern:{...m.workPattern,type:m.workPattern?.type===w.key?undefined:w.key}}))}/>)}</div></div></div>
    <div className="card pref-card" style={{marginTop:14}}><Art file={prefArt.tone}/><div><h3>Anyone you care for?</h3><div className="chips" style={{marginTop:10}} role="group" aria-label="Caring">{caring.map(c=><Chip key={c.key} icon={c.icon} label={c.label} selected={!!map.caringResponsibilities?.includes(c.key)} onToggle={()=>setMap(m=>({...m,caringResponsibilities:c.key==='none'?(m.caringResponsibilities?.includes('none')?[]:['none']):toggle((m.caringResponsibilities||[]).filter(x=>x!=='none'),c.key)}))}/>)}</div></div></div>
    <div className="card pref-card" style={{marginTop:14}}><Art file={map.locationContext?.country==='Australia'?'ob-loc-au':map.locationContext?.country&&map.locationContext.country!=='Other'?'ob-loc-other':'ob-loc-custom'}/><div><h3>Where are you?</h3><p className="small muted">Country and state only. Bear uses it for the right terms and systems, never your exact location.</p>
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:8}}>
      <div className="field" style={{marginTop:0}}><label htmlFor="country">Country</label><select id="country" value={map.locationContext?.country||''} onChange={e=>setMap(m=>({...m,locationContext:{...m.locationContext,country:e.target.value||undefined,region:undefined}}))}><option value="">Skip</option>{Object.keys(regions).map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="field" style={{marginTop:0}}><label htmlFor="region">State</label><select id="region" value={map.locationContext?.region||''} disabled={!regions[map.locationContext?.country||'']?.length} onChange={e=>setMap(m=>({...m,locationContext:{...m.locationContext,region:e.target.value||undefined}}))}><option value="">Skip</option>{(regions[map.locationContext?.country||'']||[]).map(r=><option key={r}>{r}</option>)}</select></div>
     </div></div></div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({loadMap:map,people:peopleFromHousehold(),name:profile.name},'struggles')}>Next</Button><Button variant="quiet" disabled={busy} onClick={()=>save({name:profile.name},'struggles')}>Skip for now</Button></div>
   </section>}
   {step==='struggles'&&<section>
    <h1>What tends to get you?</h1><p className="muted" style={{marginTop:8}}>No judgement. Pick as many as you like.</p>
    <div className="tiles section">{struggleOptions.map((o,i)=><Tile key={o.key} compact side tint={tints[i%tints.length]} label={o.label} selected={!!map.struggles?.includes(o.key)} onToggle={()=>setMap(m=>{const struggles=toggle(m.struggles,o.key as string);return {...m,struggles,cognitiveProfile:cognitiveProfileFrom(struggles)};})} art={<NeedArt label={struggleArt[o.key]}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({loadMap:map},'handover')}>Next</Button></div>
   </section>}
   {step==='handover'&&<section>
    <h1>What would you happily hand over to Bear?</h1><p className="muted" style={{marginTop:8}}>Bear only takes what it can genuinely carry. You can change this any time.</p>
    <div className="tiles section hand-tiles" role="group" aria-label="Hand over">{handoverOptions.map(o=><Tile key={o.key} compact side tint="#FFFDF8" label={o.label} selected={!!map.handover?.includes(o.key)} onToggle={()=>setMap(m=>({...m,handover:o.key==='all'?(m.handover?.includes('all')?[]:['all']):toggle((m.handover||[]).filter(x=>x!=='all'),o.key as string)}))} art={<TileImage file={`ob-hand-${o.key}`}/>}/>)}</div>
    <div className="btn-stack"><Button disabled={busy} onClick={()=>save({loadMap:map},'behave')}>Next</Button></div>
   </section>}
   {step==='behave'&&<section>
    <h1>How should Bear behave?</h1>
    {behave.map(b=><div key={b.key} className="card pref-card" style={{marginTop:14}}><Art file={b.art}/><div><h3>{b.q}</h3><div className="chips" style={{marginTop:10}} role="group" aria-label={b.q}>{b.options.map(o=><Chip key={o.value} label={o.label} selected={map.preferences?.[b.key]===o.value} onToggle={()=>setMap(m=>({...m,preferences:{...m.preferences,[b.key]:o.value}}))}/>)}</div></div></div>)}
    <div className="btn-stack"><Button disabled={busy} onClick={()=>finish(map)}>Next</Button></div>
   </section>}
   {step==='first'&&<section style={{textAlign:'center',paddingTop:12}}>
    <CaptureBear width={200}/>
    <h1 style={{marginTop:12}}>Let&rsquo;s get something out of your head.</h1>
    <p className="muted" style={{marginTop:10}}>Give Bear one real thing from your life: a bill, a school note, an appointment, a message, a thought. Type it, say it, or snap it.</p>
    <div className="btn-stack"><Button variant="coral" onClick={()=>router.replace('/bear/capture?first=1')}>Give Bear one real thing</Button><Button variant="quiet" onClick={()=>router.replace('/bear/home')}>Not right now</Button></div>
   </section>}
   </div>
   <Toast message={error} kind="error" onDone={()=>setError(null)}/>
   <span className="sr-only" aria-live="polite">{busy?'Saving':''}</span>
  </main>
 );
}
