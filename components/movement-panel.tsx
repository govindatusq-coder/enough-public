"use client";
import {useEffect,useRef,useState} from 'react';
import {Activity} from 'lucide-react';
type SensorConstructor=typeof DeviceMotionEvent & {requestPermission?:()=>Promise<string>};
export function LiveMotionPanel(){
 const [status,setStatus]=useState('idle'),[reading,setReading]=useState<number|null>(null);
 const attempt=useRef(0);
 const cleanup=useRef<(()=>void)|null>(null),last=useRef(0),lastRender=useRef(0);
 const stop=()=>{attempt.current++;cleanup.current?.();cleanup.current=null;setReading(null);setStatus('stopped')};
 useEffect(()=>{const hide=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hide);return()=>{attempt.current++;cleanup.current?.();document.removeEventListener('visibilitychange',hide)}},[]);
 const connect=async()=>{
  const request=++attempt.current;cleanup.current?.();setReading(null);
  if(!window.isSecureContext||!('DeviceMotionEvent' in window)){setStatus('unsupported');return;}
  setStatus('requesting');
  try{const sensor=window.DeviceMotionEvent as SensorConstructor;const permission=sensor.requestPermission?await sensor.requestPermission():'granted';if(request!==attempt.current)return;if(permission!=='granted'){setStatus('denied');return;}
   last.current=0;lastRender.current=0;const started=Date.now();setStatus('waiting');
   const listener=(e:DeviceMotionEvent)=>{const a=e.acceleration;if(!a||![a.x,a.y,a.z].every(v=>typeof v==='number'&&Number.isFinite(v)))return;last.current=Date.now();if(last.current-lastRender.current<500)return;lastRender.current=last.current;setReading(Math.hypot(a.x!,a.y!,a.z!));setStatus('live')};
   window.addEventListener('devicemotion',listener);
   const interval=window.setInterval(()=>{if(Date.now()-(last.current||started)>8000){cleanup.current?.();cleanup.current=null;setReading(null);setStatus('unavailable')}else if(last.current&&Date.now()-last.current>3000){setReading(null);setStatus('waiting')}},1000);
   cleanup.current=()=>{window.removeEventListener('devicemotion',listener);clearInterval(interval)};
  }catch{setStatus('denied')}
 };
 const running=['live','waiting','requesting'].includes(status);
 const message=status==='live'?'Receiving your phone’s motion signal.':status==='requesting'?'Waiting for your permission…':status==='waiting'?'Waiting for a motion signal…':status==='denied'?'Motion access wasn’t allowed. You can still confirm moves yourself.':status==='unsupported'?'Live motion isn’t available in this browser. You can still confirm moves yourself.':status==='unavailable'?'No usable motion signal arrived. Try opening this page directly in your phone’s browser.':status==='stopped'?'Motion reading stopped.':'Connect your phone’s motion sensor when you’re ready.';
 return <section className="movement-panel" aria-labelledby="movement-title"><div className="movement-title"><Activity size={22} strokeWidth={1.5}/><h2 id="movement-title">Your movement today</h2></div><div className="movement-metrics"><div><strong>—</strong><span>Daily steps</span></div><div><strong>—</strong><span>Active minutes</span></div></div><p className="sensor-note">Daily totals aren’t connected yet. They will come from Apple or Android health data in the native app.</p><div className="live-motion"><div><span className="small-label">LIVE PHONE MOTION</span><p role="status">{message}</p>{reading!==null&&<p className="sensor-reading"><strong>{reading.toFixed(2)}</strong> m/s² <span>acceleration, excluding gravity</span></p>}</div>{running?<button className="secondary" onClick={stop}>Stop reading</button>:<button className="secondary" onClick={connect}>{status==='idle'?'Connect motion':'Try motion again'}</button>}</div><p className="sensor-note">Live signal only while this page is visible. Not a step count or activity confirmation. Sensor readings are not stored.</p></section>
}
