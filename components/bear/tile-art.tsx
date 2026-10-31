import {areaArt,interestArt,needArt,strengthArt,TileImage} from './art';
// Abstract, screen-print style tile artwork in the brand palette. Replaceable by
// licensed photography later via the `art` prop on Tile.
const palettes:Record<string,[string,string,string]>={work:['#E3F1FB','#CFE7F7','#102A43'],family:['#FFE6E7','#FF9FA3','#FF5147'],home:['#FFEFC9','#FFB72B','#102A43'],money:['#D5F3F0','#18B7AA','#102A43'],health:['#FFE1DE','#FF5147','#102A43'],me:['#E4DDFB','#C9BDF5','#102A43']};
function Art({p,shape}:{p:[string,string,string];shape:number}){
 return <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="200" height="140" fill={p[0]}/>
  {shape%4===0&&<><circle cx="150" cy="40" r="46" fill={p[1]}/><path d="M0 110 C50 80 90 130 140 100 S200 80 200 95 L200 140 L0 140Z" fill={p[1]} opacity=".55"/></>}
  {shape%4===1&&<><rect x="110" y="18" width="70" height="70" rx="18" fill={p[1]} transform="rotate(12 145 53)"/><circle cx="40" cy="110" r="30" fill={p[1]} opacity=".6"/></>}
  {shape%4===2&&<><path d="M130 20 l50 60 -100 0z" fill={p[1]}/><circle cx="50" cy="50" r="22" fill={p[1]} opacity=".6"/><path d="M0 120 Q100 90 200 125 L200 140 L0 140Z" fill={p[1]} opacity=".5"/></>}
  {shape%4===3&&<><ellipse cx="60" cy="40" rx="48" ry="30" fill={p[1]} opacity=".7"/><rect x="120" y="60" width="60" height="60" rx="30" fill={p[1]}/></>}
  <circle cx="24" cy="24" r="5" fill={p[2]} opacity=".35"/>
 </svg>;
}
const hash=(s:string)=>[...s].reduce((h,c)=>h+c.charCodeAt(0),0);
export function AreaArt({area}:{area:string}){const file=areaArt[area];if(file)return <TileImage file={'area-'+file}/>;return <Art p={palettes[area]||palettes.me} shape={hash(area)}/>;}
export function NeedArt({label}:{label:string}){const file=needArt[label];if(file)return <TileImage file={'need-'+file}/>;const keys=Object.keys(palettes);const key=/bill|money/i.test(label)?'money':/school|birthday|family/i.test(label)?'family':/health|appointment/i.test(label)?'health':/work|form|admin/i.test(label)?'work':/meal|house/i.test(label)?'home':keys[hash(label)%keys.length];return <Art p={palettes[key]} shape={hash(label)}/>;}
export function InterestArt({label}:{label:string}){const file=interestArt[label];if(file)return <TileImage file={'interest-'+file}/>;const keys=Object.keys(palettes);return <Art p={palettes[keys[hash(label)%keys.length]]} shape={hash(label)+1}/>;}
export function StrengthArt({label}:{label:string}){const file=strengthArt[label];if(file)return <TileImage file={'strength-'+file}/>;const keys=Object.keys(palettes);return <Art p={palettes[keys[(hash(label)+2)%keys.length]]} shape={hash(label)+2}/>;}
