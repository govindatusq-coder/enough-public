'use client';
// A small, quick burst of confetti when she finishes a whole task: about a second, from where she tapped, then gone.
// Nothing to dismiss, no sound, no streaks. Skipped entirely when the phone asks for reduced motion.
const COLOURS=['#FF5147','#FFC845','#3FA77A','#5B8DEF','#F7A1C4','#102A43'];
export const reducedMotion=()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};

export function confetti(from?:{x:number;y:number}|Element|null){
 if(typeof window==='undefined'||reducedMotion())return;
 const r=from instanceof Element?from.getBoundingClientRect():null;
 const ox=r?r.left+r.width/2:from&&'x' in from?from.x:window.innerWidth/2;
 const oy=r?r.top+r.height/2:from&&'y' in from?from.y:window.innerHeight/3;
 const c=document.createElement('canvas');const dpr=Math.min(window.devicePixelRatio||1,2);
 c.width=window.innerWidth*dpr;c.height=window.innerHeight*dpr;c.setAttribute('aria-hidden','true');c.className='bear-confetti';
 Object.assign(c.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'9999'});
 document.body.appendChild(c);const ctx=c.getContext('2d');if(!ctx){c.remove();return;}ctx.scale(dpr,dpr);
 const bits=Array.from({length:42},(_,i)=>{const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.1;const v=5+Math.random()*6;
  return {x:ox,y:oy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,w:5+Math.random()*5,h:8+Math.random()*6,rot:Math.random()*6,spin:(Math.random()-.5)*.4,col:COLOURS[i%COLOURS.length]};});
 const start=performance.now();const LIFE=1100;
 const frame=(t:number)=>{const k=(t-start)/LIFE;ctx.clearRect(0,0,c.width,c.height);
  for(const b of bits){b.vy+=.28;b.vx*=.985;b.x+=b.vx;b.y+=b.vy;b.rot+=b.spin;
   ctx.save();ctx.globalAlpha=Math.max(0,1-k*k);ctx.translate(b.x,b.y);ctx.rotate(b.rot);ctx.fillStyle=b.col;ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);ctx.restore();}
  if(k<1)requestAnimationFrame(frame);else c.remove();};
 requestAnimationFrame(frame);
}
