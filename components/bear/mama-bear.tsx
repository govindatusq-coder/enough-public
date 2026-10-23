// Mama Bear — abstract navy bear, coral polka-dot bandana, mustard rolled-sleeve top and the
// flexed-bicep Rosie pose. Flat screen-print rendering in four inks; never outlined, never a cub.
export type BearPose='hero'|'calm'|'wave';
export function MamaBear({size=240,pose='hero',animate=false,className='',title='Mama Bear'}:{size?:number;pose?:BearPose;animate?:boolean;className?:string;title?:string}){
 const navy='#102A43',coral='#FF5147',mustard='#FFB72B',cream='#FFF7E8';
 const flex=pose!=='calm';
 return (
  <svg className={`mama ${animate?'animate':''} ${className}`} width={size} height={size*1.1} viewBox="0 0 400 440" role="img" aria-label={title}>
   {pose==='hero'&&<g className="ticks" stroke={mustard} strokeWidth="9" strokeLinecap="round" fill="none"><path d="M352 112 l26 -22"/><path d="M362 146 l32 -4"/><path d="M336 90 l10 -32"/></g>}
   {/* torso */}
   <path d="M62 440 C60 352 110 300 190 298 C270 300 322 352 320 440 Z" fill={navy}/>
   {/* mustard top with a soft neckline */}
   <path d="M70 440 L72 376 C84 356 118 348 148 348 C166 348 180 358 190 370 C200 358 214 348 232 348 C262 348 298 356 310 376 L312 440 Z" fill={mustard}/>
   {/* resting arm (viewer's left) */}
   <path d="M92 346 C66 332 50 306 52 284 C54 266 70 262 80 278 C90 296 104 314 124 328 Z" fill={navy}/>
   {/* flexed arm (viewer's right): upper arm out, forearm up, fist beside the head */}
   {flex&&<g>
    <path d="M282 332 C312 322 336 298 348 270 C356 250 362 232 356 214 L326 206 C322 232 312 258 296 282 C286 296 274 306 262 312 Z" fill={navy}/>
    <path d="M326 206 C318 184 318 164 326 150 C332 138 346 132 358 138 C372 146 376 164 372 182 C370 194 364 206 356 214 Z" fill={navy}/>
    <ellipse cx="350" cy="140" rx="24" ry="22" fill={navy}/>
    {/* rolled mustard sleeve on the upper arm */}
    <path d="M276 326 C290 318 302 306 310 292 L336 306 C326 324 310 338 292 346 Z" fill={mustard}/>
   </g>}
   {!flex&&<path d="M288 346 C314 332 330 306 328 284 C326 266 310 262 300 278 C290 296 276 314 256 328 Z" fill={navy}/>}
   {/* head */}
   <circle cx="190" cy="178" r="104" fill={navy}/>
   <circle cx="104" cy="104" r="32" fill={navy}/><circle cx="276" cy="104" r="32" fill={navy}/>
   <circle cx="108" cy="108" r="14" fill={cream} opacity=".85"/><circle cx="272" cy="108" r="14" fill={cream} opacity=".85"/>
   {/* muzzle */}
   <path d="M190 196 C226 196 250 214 250 236 C250 262 224 280 190 280 C156 280 130 262 130 236 C130 214 154 196 190 196 Z" fill={cream}/>
   {/* eyes: calm, confident */}
   <path d="M136 160 C146 148 166 148 176 160 C166 170 146 170 136 160 Z" fill={cream}/>
   <path d="M204 160 C214 148 234 148 244 160 C234 170 214 170 204 160 Z" fill={cream}/>
   <circle cx="157" cy="160" r="6" fill={navy}/><circle cx="223" cy="160" r="6" fill={navy}/>
   <circle cx="159" cy="157" r="2" fill={cream}/><circle cx="225" cy="157" r="2" fill={cream}/>
   {/* brows: outer ends lifted, inner ends set */}
   <path d="M132 140 C146 132 162 134 176 142" stroke={cream} strokeWidth="7" strokeLinecap="round" fill="none"/>
   <path d="M248 140 C234 132 218 134 204 142" stroke={cream} strokeWidth="7" strokeLinecap="round" fill="none"/>
   {/* nose + smile */}
   <path d="M190 214 C204 214 212 222 212 230 C212 240 200 246 190 246 C180 246 168 240 168 230 C168 222 176 214 190 214 Z" fill={navy}/>
   <path d="M190 246 L190 256 M176 258 C182 266 198 266 204 258" stroke={navy} strokeWidth="5" strokeLinecap="round" fill="none"/>
   {/* bandana */}
   <path d="M90 124 C112 84 150 66 190 66 C230 66 268 84 290 124 C266 108 230 100 190 100 C150 100 114 108 90 124 Z" fill={coral}/>
   <g fill="#fff" opacity=".95"><circle cx="140" cy="94" r="4"/><circle cx="178" cy="82" r="4"/><circle cx="218" cy="84" r="4"/><circle cx="256" cy="100" r="4"/><circle cx="116" cy="112" r="3.5"/></g>
   <g className="bandana-tails">
    <path d="M110 100 C84 72 50 60 26 70 C46 74 62 86 72 104 C52 106 34 118 24 136 C50 124 80 120 112 118 Z" fill={coral}/>
    <g fill="#fff" opacity=".95"><circle cx="48" cy="76" r="3.5"/><circle cx="52" cy="122" r="3.5"/><circle cx="80" cy="108" r="3"/></g>
   </g>
   <ellipse cx="114" cy="108" rx="17" ry="14" fill={coral}/><circle cx="114" cy="108" r="4" fill="#fff" opacity=".9"/>
  </svg>
 );
}
