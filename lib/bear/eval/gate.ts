// Eval200 is for staging and local runs only. It is off unless BEAR_EVAL_ENABLED=1, and always off in Vercel production
// (whatever else is set). Calls need the bearer BEAR_EVAL_TOKEN (at least 24 characters). When off, it doesn't exist (404).
import {createHash,timingSafeEqual} from 'node:crypto';
type Env=Record<string,string|undefined>;
export function evalEnabled(env:Env=process.env){return env.BEAR_EVAL_ENABLED==='1'&&env.VERCEL_ENV!=='production';}
export function evalAuthorised(header:string|null,env:Env=process.env){
 const want=env.BEAR_EVAL_TOKEN||'';const got=/^Bearer\s+(.+)$/i.exec(header||'')?.[1]?.trim()||'';
 if(want.length<24||!got)return false;
 const h=(s:string)=>createHash('sha256').update(s).digest();return timingSafeEqual(h(want),h(got));
}
