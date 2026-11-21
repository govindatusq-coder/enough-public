'use client';
// Talking to Bear and hearing Bear, on the phone itself (no audio leaves the device, nothing is recorded or kept).
// useSpeechInput: the phone's speech recognition fills the box for review; the person edits and sends it herself. Where the
// phone won't let the page listen (some iPhone home-screen apps, Siri and Dictation off, permission refused), the box opens
// with the keyboard, whose own microphone always works, and Bear says so plainly. Same behaviour as Drop Bear's box.
// useSpeechOutput: Bear's replies read aloud in an Australian voice where the phone has one; only when asked, one at a time,
// and stopped when the person leaves the screen.
import {useCallback,useEffect,useRef,useState} from 'react';

type Rec={continuous:boolean;interimResults:boolean;lang:string;start():void;stop():void;abort():void;
 onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null};
const KEYBOARD='Tap the microphone on your keyboard and speak. Bear will take it from there.';

export function useSpeechInput({text,setText,focus}:{text:string;setText:(t:string|((p:string)=>string))=>void;focus:()=>void}){
 const [listening,setListening]=useState(false);const [canTalk,setCanTalk]=useState(false);const [hint,setHint]=useState<string|null>(null);
 const rec=useRef<Rec|null>(null);const before=useRef('');const cancelled=useRef(false);
 useEffect(()=>{queueMicrotask(()=>{const w=window as unknown as {SpeechRecognition?:new()=>Rec;webkitSpeechRecognition?:new()=>Rec};setCanTalk(!!(w.SpeechRecognition||w.webkitSpeechRecognition));});return()=>{try{rec.current?.abort();}catch{/* gone */}};},[]);
 const keyboard=useCallback((why?:string)=>{setListening(false);setHint(why?`${why} ${KEYBOARD}`:KEYBOARD);focus();},[focus]);
 const toggle=useCallback(()=>{
  if(listening){try{rec.current?.stop();}catch{/* already stopped */}return;}
  const w=window as unknown as {SpeechRecognition?:new()=>Rec;webkitSpeechRecognition?:new()=>Rec};const R=w.SpeechRecognition||w.webkitSpeechRecognition;
  let useKeyboard=false;try{useKeyboard=localStorage.getItem('bear-speech')==='keyboard';}catch{/* no storage */}
  if(!R||useKeyboard){keyboard();return;}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let r:Rec;try{r=new R();}catch{keyboard('Bear can’t listen on this device.');return;}
  r.continuous=!ios;r.interimResults=true;r.lang='en-AU';
  before.current=text.trim()?text.replace(/\s*$/,' '):'';cancelled.current=false;let heard=false,failed=false;const began=Date.now();
  r.onresult=e=>{if(cancelled.current)return;let said='';for(let i=0;i<e.results.length;i++)said+=e.results[i][0].transcript;if(said.trim())heard=true;setText(before.current+said.replace(/^\s+/,''));};
  r.onerror=e=>{failed=true;setListening(false);
   if(e.error==='not-allowed')keyboard('Load Bear isn’t allowed to use the microphone (on iPhone: Settings › Safari › Microphone).');
   else if(e.error==='service-not-allowed'){try{localStorage.setItem('bear-speech','keyboard');}catch{/* no storage */}keyboard('Your phone doesn’t let Load Bear listen directly here.');}
   else if(e.error==='no-speech')setHint('Bear didn’t hear anything. Tap the microphone and try again.');
   else if(e.error!=='aborted')keyboard('Bear couldn’t listen just then.');};
  r.onend=()=>{setListening(false);if(!cancelled.current){setText(t=>t.trim()?t.trimEnd():'');if(!heard&&!failed&&Date.now()-began<1500)keyboard('Bear couldn’t start listening.');else if(heard)focus();}};
  try{r.start();}catch{keyboard('Bear couldn’t start listening.');return;}
  rec.current=r;setHint(null);setListening(true);
 },[listening,text,setText,keyboard,focus]);
 // Cancel: stop listening and put the box back as it was before.
 const cancel=useCallback(()=>{cancelled.current=true;try{rec.current?.abort();}catch{/* gone */}setListening(false);setText(before.current.trimEnd());setHint(null);},[setText]);
 return {listening,canTalk,hint,toggle,cancel,clearHint:()=>setHint(null)};
}

export function useSpeechOutput(){
 const [can,setCan]=useState(false);const [playing,setPlaying]=useState<string|null>(null);const [failed,setFailed]=useState<string|null>(null);
 useEffect(()=>{queueMicrotask(()=>setCan(typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined'));
  const stopAll=()=>{try{window.speechSynthesis?.cancel();}catch{/* none */}setPlaying(null);};
  const hide=()=>{if(document.visibilityState==='hidden')stopAll();};
  window.addEventListener('pagehide',stopAll);document.addEventListener('visibilitychange',hide);
  return()=>{window.removeEventListener('pagehide',stopAll);document.removeEventListener('visibilitychange',hide);stopAll();};},[]);
 const stop=useCallback(()=>{try{window.speechSynthesis.cancel();}catch{/* none */}setPlaying(null);},[]);
 const play=useCallback((id:string,text:string)=>{
  if(!can)return;try{window.speechSynthesis.cancel();}catch{/* none */}setFailed(null);
  const u=new SpeechSynthesisUtterance(text);u.lang='en-AU';u.rate=0.98;
  const voices=window.speechSynthesis.getVoices();const v=voices.find(x=>x.lang==='en-AU'&&/karen|catherine|natural|premium|enhanced/i.test(x.name))||voices.find(x=>x.lang==='en-AU')||voices.find(x=>x.lang?.startsWith('en-GB'))||null;if(v)u.voice=v;
  u.onend=()=>setPlaying(p=>p===id?null:p);u.onerror=e=>{setPlaying(p=>p===id?null:p);if((e as SpeechSynthesisErrorEvent).error!=='canceled'&&(e as SpeechSynthesisErrorEvent).error!=='interrupted')setFailed(id);};
  setPlaying(id);window.speechSynthesis.speak(u);
 },[can]);
 return {can,playing,failed,play,stop};
}
