/* eslint-disable @next/next/no-img-element -- local brand artwork served from /public */
// Supplied Load Bear artwork. These replace the drawn SVG wherever the character appears.
const base='/bear/art/';
export function BearHead({size=64,className='',alt='Mama Bear'}:{size?:number;className?:string;alt?:string}){
 return <img src={base+'head.webp'} width={size} height={size} alt={alt} className={className} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flex:'none',boxShadow:'0 6px 16px -10px rgba(16,42,67,.6)'}}/>;
}
export function HeroLockup({width='100%'}:{width?:number|string}){
 return <img src={base+'hero-lockup.webp'} alt="Load Bear. Your mental load is ours to bear." style={{width,height:'auto',display:'block',mixBlendMode:'multiply'}} fetchPriority="high"/>;
}
export function HeroBear({width=260}:{width?:number}){
 return <img src={base+'hero-bear.webp'} alt="Mama Bear flexing" style={{width,height:'auto',display:'block',margin:'0 auto',mixBlendMode:'multiply'}}/>;
}
export function RoundBadge({size=140}:{size?:number}){
 return <img src={base+'badge-round.webp'} alt="Load Bear. Your mental load is ours to bear." width={size} height={size} style={{width:size,height:size,display:'block',margin:'0 auto'}}/>;
}
export const needArt:Record<string,string>={'School & childcare':'school-childcare','Appointments':'appointments','Work deadlines':'work-deadlines','Meals & groceries':'meals-groceries','Bills & money':'bills-money','Birthdays & presents':'birthdays-presents','Housework':'housework','Family calendar':'family-calendar','Health':'health','Activities & sport':'activities-sport','Forms & admin':'forms-admin','Things I just forget':'things-i-forget'};
export function EmptyArt({file,alt=''}:{file:string;alt?:string}){return <img src={base+file+'.webp'} alt={alt} className="empty-art" loading="lazy"/>;}
export function CompactLockup({width=300}:{width?:number}){return <img src={base+'lockup-compact.webp'} alt="Load Bear" style={{width,maxWidth:'100%',height:'auto',display:'block',mixBlendMode:'multiply'}}/>;}
export function CaptureBear({width=120}:{width?:number}){return <img src={base+'capture-bear.webp'} alt="Mama Bear" style={{width,height:'auto',display:'block',mixBlendMode:'multiply',flex:'none'}}/>;}
export const areaArt:Record<string,string>={work:'work',family:'family',home:'home',money:'money',health:'health',me:'me'};
export const interestArt:Record<string,string>={'Family time':'family-time','Friends':'friends','Movement':'movement','Quiet':'quiet','Creativity':'creativity','Travel':'travel','Learning':'learning','Career':'career','Outdoors':'outdoors','Date time':'date-time','Community':'community','Doing absolutely nothing':'doing-nothing'};
export function Avatar({size=80}:{size?:number}){return <img src={base+'avatar.webp'} alt="Your Bear" width={size} height={size} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flex:'none'}}/>;}
export function PeopleHeader(){return <img src={base+'people-header.webp'} alt="" aria-hidden="true"/>;}
export function CapacityArt(){return <img src={base+'capacity-rest.webp'} alt="Mama Bear resting in an armchair with a cup of tea" className="capacity-art" loading="lazy"/>;}
export function Art({file,width,height,alt='',className='art-inline',style}:{file:string;width?:number;height?:number;alt?:string;className?:string;style?:React.CSSProperties}){return <img src={base+file+'.webp'} alt={alt} aria-hidden={alt?undefined:true} width={width} height={height} className={className} style={{width,height,...style}} loading="lazy"/>;}
export function HeroVertical(){return <img src={base+'hero-vertical.webp'} alt="Load Bear. Your mental load is ours to bear." style={{width:'100%',maxWidth:360,height:'auto',display:'block',margin:'0 auto',mixBlendMode:'multiply'}} fetchPriority="high"/>;}
export const prefArt:Record<string,string>={reminderLeadTime:'pref-lead',nudgeTolerance:'pref-nudge',planningDetail:'pref-detail',proactiveSuggestions:'pref-suggest',tone:'pref-tone'};
export const strengthArt:Record<string,string>={'Planning ahead':'planning-ahead','Getting things done':'getting-things-done','Looking after people':'looking-after-people','Money':'money','Work':'work','Routines':'routines','Cooking':'cooking','Staying active':'staying-active','Problem solving':'problem-solving','Asking for help':'asking-for-help','Keeping calm in chaos':'keeping-calm'};
export function TileImage({file,alt=''}:{file:string;alt?:string}){return <img src={base+file+'.webp'} alt={alt} style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',display:'block',padding:'6px 8px 2px',boxSizing:'border-box',mixBlendMode:'multiply'}} loading="lazy"/>;}
