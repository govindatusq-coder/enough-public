// Mama Bear — abstract navy bear, coral polka-dot bandana, mustard chest, flexed arm.
// Flat screen-print rendering in four inks. `pose` changes only the arm and expression.
export type BearPose='hero'|'calm'|'wave';
export function MamaBear({size=240,pose='hero',animate=false,className='',title='Mama Bear'}:{size?:number;pose?:BearPose;animate?:boolean;className?:string;title?:string}){
 const navy='#102A43',coral='#FF5147',mustard='#FFB72B',cream='#FFF7E8';
 return (
  <svg className={`mama ${animate?'animate':''} ${className}`} width={size} height={size*1.1} viewBox="0 0 400 440" role="img" aria-label={title}>
   {/* energy ticks */}
   {pose==='hero'&&<g className="ticks" stroke={mustard} strokeWidth="9" strokeLinecap="round" fill="none"><path d="M318 84 l22 -26"/><path d="M332 118 l30 -8"/><path d="M296 62 l6 -32"/></g>}
   {/* body */}
   <path d="M74 440 C70 330 120 270 200 268 C280 270 330 330 326 440 Z" fill={navy}/>
   {/* mustard top */}
   <path d="M112 440 C110 356 150 312 200 312 C250 312 290 356 288 440 Z" fill={mustard}/>
   <path d="M150 440 C150 390 175 366 200 366 C225 366 250 390 250 440 Z" fill={navy} opacity=".92"/>
   {/* flexed arm (viewer's right) */}
   {pose!=='calm'&&<g>
    <path d="M296 330 C330 300 352 262 344 208 C340 180 356 160 376 162 C396 164 400 186 394 212 C386 258 356 318 318 350 Z" fill={navy}/>
    <path d="M262 352 C286 312 300 300 318 330 C324 346 318 360 300 372 L262 372 Z" fill={navy}/>
    <ellipse cx="376" cy="178" rx="22" ry="20" fill={navy}/>
    <path d="M344 212 C352 232 352 252 346 272 L322 262 C328 244 330 226 328 212 Z" fill={mustard}/>
   </g>}
   {pose==='calm'&&<path d="M296 330 C330 318 346 300 346 282 C346 266 332 262 322 276 C312 292 300 306 286 316 Z" fill={navy}/>}
   {/* left arm (viewer's left), resting */}
   <path d="M98 338 C72 320 56 296 56 278 C56 262 70 258 80 272 C90 288 102 304 118 316 Z" fill={navy}/>
   {/* head */}
   <circle cx="200" cy="170" r="108" fill={navy}/>
   {/* ears */}
   <circle cx="112" cy="92" r="30" fill={navy}/><circle cx="288" cy="92" r="30" fill={navy}/>
   <circle cx="116" cy="96" r="13" fill={cream} opacity=".85"/><circle cx="284" cy="96" r="13" fill={cream} opacity=".85"/>
   {/* brow + muzzle marks */}
   <path d="M200 110 C220 100 246 104 256 116 C244 112 224 112 200 120 C176 112 156 112 144 116 C154 104 180 100 200 110 Z" fill={cream} opacity=".9"/>
   <path d="M200 182 C236 182 262 200 262 226 C262 256 234 276 200 276 C166 276 138 256 138 226 C138 200 164 182 200 182 Z" fill={cream}/>
   {/* eyes */}
   <g>
    <path d="M150 150 C158 140 176 140 184 150 C176 160 158 160 150 150 Z" fill={cream}/>
    <path d="M216 150 C224 140 242 140 250 150 C242 160 224 160 216 150 Z" fill={cream}/>
    <circle cx="168" cy="151" r="5.5" fill={navy}/><circle cx="234" cy="151" r="5.5" fill={navy}/>
    {/* confident brows */}
    <path d="M146 134 L186 128" stroke={cream} strokeWidth="6" strokeLinecap="round" opacity=".95"/>
    <path d="M254 134 L214 128" stroke={cream} strokeWidth="6" strokeLinecap="round" opacity=".95"/>
   </g>
   {/* nose + mouth */}
   <path d="M200 208 C214 208 222 216 222 224 C222 234 210 240 200 240 C190 240 178 234 178 224 C178 216 186 208 200 208 Z" fill={navy}/>
   <path d="M200 240 L200 252 M200 252 C190 262 180 258 176 252 M200 252 C210 262 220 258 224 252" stroke={navy} strokeWidth="5" strokeLinecap="round" fill="none"/>
   {/* bandana band */}
   <path d="M98 108 C120 70 160 56 200 56 C240 56 280 70 302 108 C280 94 240 86 200 86 C160 86 120 94 98 108 Z" fill={coral}/>
   <g fill="#fff" opacity=".95"><circle cx="150" cy="80" r="4"/><circle cx="190" cy="70" r="4"/><circle cx="230" cy="72" r="4"/><circle cx="268" cy="86" r="4"/><circle cx="124" cy="96" r="3.5"/></g>
   {/* knot + tails */}
   <g className="bandana-tails">
    <path d="M118 86 C96 60 60 48 38 58 C56 62 70 74 80 90 C62 92 44 104 34 122 C58 110 86 108 118 104 Z" fill={coral}/>
    <g fill="#fff" opacity=".95"><circle cx="60" cy="66" r="3.5"/><circle cx="64" cy="108" r="3.5"/><circle cx="88" cy="96" r="3"/></g>
   </g>
   <ellipse cx="122" cy="92" rx="16" ry="13" fill={coral}/>
   <circle cx="122" cy="92" r="4" fill="#fff" opacity=".9"/>
  </svg>
 );
}
