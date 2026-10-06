"use client";
import {useState,type CSSProperties} from 'react';
import {Sun,Sunset,House,Users,User,VolumeX,CalendarDays,Compass,Clock,Check,Plus,Wallet,BatteryLow,HeartHandshake,ShieldCheck,CloudSun,Accessibility,Route,Briefcase,Footprints,Eye,Leaf,RefreshCw,Lightbulb,Smile,CheckCircle,Headphones,Coffee,Camera,Dog,Flower,BookOpen,Moon,Phone,Music,MapPin,Tv,Utensils} from 'lucide-react';

const sprites:Record<string,number>={
 'Markets':0,'Shopping / browsing':0,'Community activities':1,'Making things':2,'Creative hobbies':2,
 'Reading':3,'Learning':3,'Audiobooks':3,'Gaming':4,'Podcasts':5,'Listening to something':5,
 'Solving problems':6,'City streets':7,'Suburban neighbourhoods':8,'Small towns':9,'Country settings':10,'Coastal places':11,
 'Work or study':12,'Work / shifts':12,'Family or caring':13,'Caring for someone':13,'Household tasks':14,'Groceries':15,
 'I solve problems':6,'I care for others':13,'I know my neighbourhood':8,'I notice patterns':6,'I like exploring':10,
 'I enjoy learning':3,'I like getting things done':12
};
function choiceIcon(label:string){
 if(/money/i.test(label))return Wallet;
 if(/physical|pain|comfort/i.test(label))return Accessibility;
 if(/energy|tired|recovery|sleep/i.test(label))return /sleep/i.test(label)?Moon:BatteryLow;
 if(/family|caring|care for/i.test(label))return HeartHandshake;
 if(/safety/i.test(label))return ShieldCheck;
 if(/weather|heat/i.test(label))return CloudSun;
 if(/privacy/i.test(label))return Eye;
 if(/transport|walk where|public transport/i.test(label))return Route;
 if(/work|shift|study|on my feet|active at work/i.test(label))return Briefcase;
 if(/flexib|unpredict|different|varies|spontan|adapt|mix/i.test(label))return RefreshCw;
 if(/time|short|burst/i.test(label))return Clock;
 if(/routine|plan/i.test(label))return CalendarDays;
 if(/outside|outdoor|nature|garden/i.test(label))return Leaf;
 if(/indoor|seated|familiar/i.test(label))return House;
 if(/alone|independently|quiet/i.test(label))return /quiet/i.test(label)?VolumeX:User;
 if(/someone|company|friends|supportive/i.test(label))return Users;
 if(/music/i.test(label))return Music;
 if(/podcast|listen/i.test(label))return Headphones;
 if(/morning/i.test(label))return Sun;
 if(/afternoon|daytime/i.test(label))return CloudSun;
 if(/evening/i.test(label))return Sunset;
 if(/coffee/i.test(label))return Coffee;
 if(/streaming|tv/i.test(label))return Tv;
 if(/food/i.test(label))return Utensils;
 if(/photo/i.test(label))return Camera;
 if(/animal/i.test(label))return Dog;
 if(/garden/i.test(label))return Flower;
 if(/reading|learn/i.test(label))return BookOpen;
 if(/call/i.test(label))return Phone;
 if(/place|neighbour/i.test(label))return MapPin;
 if(/explor|new/i.test(label))return Compass;
 if(/walk|sport|exercise|school/i.test(label))return Footprints;
 if(/problem|pattern/i.test(label))return Lightbulb;
 if(/nothing|no regular/i.test(label))return CheckCircle;
 return Smile;
}
export function ChoiceArtwork({label}:{label:string}){
 const cell=sprites[label];
 if(cell!==undefined)return <span className="choice-art choice-art-sprite" style={{'--sprite-x':`${(cell%4)*100/3}%`,'--sprite-y':`${Math.floor(cell/4)*100/3}%`} as CSSProperties} aria-hidden="true"/>;
 const Icon=choiceIcon(label);
 return <span className="choice-art choice-art-icon" aria-hidden="true"><Icon strokeWidth={1.3}/></span>;
}
export function ChoiceTiles({options,values,onPick}:{options:readonly string[];values:string[];onPick:(value:string)=>void}){
 return <div className="choice-grid">{options.map(v=><button type="button" className="choice-tile" key={v} aria-pressed={values.includes(v)} onClick={()=>onPick(v)}><ChoiceArtwork label={v}/><span className="choice-label">{v}</span><span className="choice-check" aria-hidden="true">{values.includes(v)?<Check size={14}/>:null}</span></button>)}</div>;
}
export function PinsOptions({options,values,onChange}:{options:readonly string[];values:string[];onChange:(values:string[])=>void}){
 const prefix='Something else: ';
 const custom=values.find(v=>v.startsWith(prefix))?.slice(prefix.length)||'';
 const [otherOpen,setOtherOpen]=useState(Boolean(custom));
 const pick=(v:string)=>onChange(v==='Nothing to add'?values.includes(v)?[]:[v]:values.includes(v)?values.filter(x=>x!==v):[...values.filter(x=>x!=='Nothing to add'),v]);
 return <><ChoiceTiles options={[...options,'Nothing to add']} values={values} onPick={pick}/>
 <button type="button" className="something-else" aria-expanded={otherOpen} aria-controls="pins-custom-answer" onClick={()=>setOtherOpen(v=>!v)}><Plus size={20}/><span>Something Else</span><small>{custom?'Your answer is included':'Tell us in your own words'}</small></button>
 {otherOpen&&<label className="field custom-answer" id="pins-custom-answer">What else should we know?<textarea autoFocus rows={2} maxLength={150} value={custom} placeholder="What fits your life?" onChange={e=>{const answer=e.target.value;onChange([...values.filter(v=>!v.startsWith(prefix)&&v!=='Nothing to add'),...(answer.trim()?[prefix+answer]:[])]);}}/><span>Your answer is saved with this category.</span></label>}
 {values.filter(v=>!options.includes(v)&&v!=='Nothing to add'&&!v.startsWith(prefix)).map(v=><button type="button" className="custom-selected" key={v} onClick={()=>pick(v)} aria-label={'Remove answer '+v}><Check size={16}/>{v}</button>)}
 </>;
}
