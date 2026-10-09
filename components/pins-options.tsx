"use client";
import {useState,type CSSProperties} from 'react';
import {Check,Plus} from 'lucide-react';

// Each sheet has sixteen 3:2 photos in a 4 x 4 grid. Explicit mappings keep
// semantically different options from receiving the same generic icon.
type Scene = readonly [sheet:'preferences'|'interests'|'needs'|'strengths'|'routines',cell:number];
const sheets={
 preferences:'/images/preferences-lifestyle-v1.webp',
 interests:'/images/onboarding-interests-v1.webp',
 needs:'/images/onboarding-needs-v1.webp',
 strengths:'/images/onboarding-strengths-v1.webp',
 routines:'/images/onboarding-routines-v1.webp'
};
const preferenceScenes:Record<string,number>={
 'Outside':0,'Indoors':1,'Alone':2,'With someone':3,
 'Quiet':4,'Music':5,'Morning':6,'Afternoon':7,
 'Evening':8,'Planned':9,'Spontaneous':10,'Short bursts':11,
 'Take my time':12,'Familiar places':13,'New places':14,'Nothing to add':15
};
const scenes:Record<string,Scene>={
 'Podcasts':['interests',0],'Music':['preferences',5],'Coffee':['interests',1],
 'Family time':['interests',2],'Friends / talking':['interests',3],'Nature':['interests',4],
 'Animals':['interests',5],'Shopping / browsing':['interests',6],'Photography':['interests',7],
 'Exploring new places':['preferences',14],'Learning':['strengths',10],'Gardening':['interests',9],
 'Making things':['interests',10],'Audiobooks':['interests',11],'TV / streaming':['interests',12],
 'Sport':['interests',13],'Food':['interests',14],'Markets':['interests',6],
 'Community activities':['strengths',13],'Creative hobbies':['interests',10],'Reading':['interests',8],
 'Gaming':['interests',15],'Listening to something':['interests',0],'Solving problems':['strengths',4],
 'Not enough time':['needs',0],'Save money':['needs',1],'Low energy / tired':['needs',2],
 'Family or caring':['needs',3],'Work / shifts':['needs',4],'Need recovery':['needs',5],
 'Safety matters':['needs',6],'Weather / heat':['needs',7],'Hard to walk where I live':['needs',8],
 'Physical comfort / accessibility':['needs',9],'Need flexibility':['needs',10],
 'Already active at work':['needs',11],'Sleep matters':['needs',12],'Pain / discomfort':['needs',13],
 'Unpredictable day':['routines',3],'Transport limitations':['needs',14],'Money is tight':['needs',1],
 'Privacy matters':['needs',15],'I don’t enjoy exercise':['preferences',4],
 'I keep routines':['strengths',0],'I like getting things done':['strengths',1],
 'I walk when there’s a reason':['strengths',2],'I enjoy company':['interests',3],
 'I can do things independently':['strengths',3],'I like exploring':['preferences',14],
 'I solve problems':['strengths',4],'I care for others':['needs',3],
 'I know my neighbourhood':['strengths',5],'I use public transport':['strengths',6],
 'I’m already on my feet':['strengths',7],'I’m willing to try small changes':['strengths',8],
 'I know what works for me':['strengths',9],'I enjoy learning':['strengths',10],
 'I’m good at planning':['strengths',11],'I adapt when plans change':['strengths',12],
 'I have supportive people':['strengths',13],'I like challenges':['strengths',14],
 'I notice patterns':['strengths',15],
 'Mostly seated':['routines',0],'On my feet':['routines',1],'A mix of both':['routines',2],
 'Every day is different':['routines',3],'Work or study':['routines',0],'School run':['routines',4],
 'Calls':['routines',5],'Takeaway':['routines',6],'Groceries':['routines',7],
 'Podcasts or music':['preferences',5],'Caring for someone':['needs',3],
 'Household tasks':['routines',8],'No regular routine':['routines',3],
 'Morning':['preferences',6],'Daytime':['routines',14],'Evening':['preferences',8],
 'It varies':['routines',3],'City streets':['routines',9],
 'Suburban neighbourhoods':['routines',10],'Small towns':['routines',11],
 'Country settings':['routines',12],'Coastal places':['routines',13],'Mix it up':['routines',15],
 'Nothing to add':['preferences',15]
};
export function ChoiceArtwork({label,lifestyle=false}:{label:string;lifestyle?:boolean}){
 const preferenceCell=lifestyle?preferenceScenes[label]:undefined;
 const [sheet,cell]:Scene=preferenceCell!==undefined?['preferences',preferenceCell]:scenes[label]||['preferences',15];
 return <span className="choice-art choice-art-lifestyle" style={{'--scene-atlas':`url('${sheets[sheet]}')`,'--scene-x':`${(cell%4)*100/3}%`,'--scene-y':`${Math.floor(cell/4)*100/3}%`} as CSSProperties} aria-hidden="true"/>;
}
export function ChoiceTiles({options,values,onPick,lifestyle=false}:{options:readonly string[];values:string[];onPick:(value:string)=>void;lifestyle?:boolean}){
 return <div className="choice-grid choice-grid-lifestyle">{options.map(v=>{
   return <button type="button" className="choice-tile" key={v} aria-pressed={values.includes(v)} onClick={()=>onPick(v)}><ChoiceArtwork label={v} lifestyle={lifestyle}/><span className="choice-label">{v}</span><span className="choice-check" aria-hidden="true">{values.includes(v)?<Check size={14}/>:null}</span></button>;
 })}</div>;
}
export function PinsOptions({options,values,onChange,lifestyle=false}:{options:readonly string[];values:string[];onChange:(values:string[])=>void;lifestyle?:boolean}){
 const prefix='Something else: ';
 const custom=values.find(v=>v.startsWith(prefix))?.slice(prefix.length)||'';
 const [otherOpen,setOtherOpen]=useState(Boolean(custom));
 const pick=(v:string)=>onChange(v==='Nothing to add'?values.includes(v)?[]:[v]:values.includes(v)?values.filter(x=>x!==v):[...values.filter(x=>x!=='Nothing to add'),v]);
 return <><ChoiceTiles options={[...options,'Nothing to add']} values={values} onPick={pick} lifestyle={lifestyle}/>
 <button type="button" className="something-else" aria-expanded={otherOpen} aria-controls="pins-custom-answer" onClick={()=>setOtherOpen(v=>!v)}><Plus size={20}/><span>Something Else</span><small>{custom?'Your answer is included':'Tell us in your own words'}</small></button>
 {otherOpen&&<label className="field custom-answer" id="pins-custom-answer">What else should we know?<textarea autoFocus rows={2} maxLength={150} value={custom} placeholder="What fits your life?" onChange={e=>{const answer=e.target.value;onChange([...values.filter(v=>!v.startsWith(prefix)&&v!=='Nothing to add'),...(answer.trim()?[prefix+answer]:[])]);}}/><span>Your answer is saved with this category.</span></label>}
 {values.filter(v=>!options.includes(v)&&v!=='Nothing to add'&&!v.startsWith(prefix)).map(v=><button type="button" className="custom-selected" key={v} onClick={()=>pick(v)} aria-label={'Remove answer '+v}><Check size={16}/>{v}</button>)}
 </>;
}
