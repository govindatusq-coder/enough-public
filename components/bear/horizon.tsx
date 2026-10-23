// Soft sunrise horizon used at the foot of onboarding screens (echoes the brand board).
export function Horizon({height=180,tint='warm'}:{height?:number;tint?:'warm'|'cool'}){
 const a=tint==='warm'?'#FFD9CF':'#CFE7F7',b=tint==='warm'?'#FFEFC9':'#E4DDFB';
 return (
  <svg className="horizon" viewBox="0 0 400 180" preserveAspectRatio="none" style={{height}} aria-hidden="true">
   <defs><linearGradient id={`h-${tint}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} stopOpacity="0"/><stop offset="1" stopColor={a} stopOpacity=".9"/></linearGradient></defs>
   <rect width="400" height="180" fill={`url(#h-${tint})`}/>
   <path d="M0 120 C60 90 110 140 170 112 C230 84 270 126 330 104 C360 94 380 96 400 90 L400 180 L0 180 Z" fill={b} opacity=".85"/>
   <path d="M0 150 C70 130 120 160 190 142 C250 128 300 156 400 136 L400 180 L0 180 Z" fill="#fff" opacity=".55"/>
  </svg>
 );
}
