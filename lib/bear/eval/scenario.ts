// Eval200: one benchmark scenario, as the dataset gives it, plus the concrete dates the runner assigns.
// The dataset names weekdays only ("Tuesday 18:40" → "Friday 09:00"). The runner places every scenario in one fixed week so
// runs are repeatable: received on that weekday in the week of Monday 23 November 2026, target on the next matching weekday
// after it, in the household's own time zone.
import {zonedDateTime} from '../domain/dates.ts';

export interface RawMaterial{type:string;content:string}
export interface Scenario{
 id:string;category:string;activity:string;locale:string;scenario:string;raw_materials:RawMaterial[];expected_responsibility:string;
 time_context:{received_local:string;target_local:string};constraints:Record<string,unknown>&{budget?:string};unknowns_to_resolve:string[];
 dependency_graph:{id:string;action:string;depends_on:string[];actor:string}[];approval_gates:string[];autonomous_opportunities:string[];
 completion_evidence:string[];expected_agent_state:string;failure_traps:string[];physical_execution_required:boolean;risk_level:string;
 rubric_weights:Record<string,number>;evaluation_notes?:string;
}
export const ANCHOR_MONDAY='2026-11-23';
export const TIMEZONES:Record<string,string>={AU:'Australia/Sydney',CA:'America/Toronto',US:'America/New_York'};
const DAYS=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function parseLocal(s:string){const m=/^\s*([A-Za-z]+)\s+(\d{1,2}):(\d{2})\s*$/.exec(s||'');if(!m)return null;const day=DAYS.indexOf(m[1].toLowerCase());if(day<0)return null;return {day,minute:+m[2]*60+ +m[3]};}

export interface ScenarioDates{timezone:string;receivedDate:string;receivedAt:string;targetDate:string;targetAt:string;targetMinute:number}
export function datesFor(c:Pick<Scenario,'locale'|'time_context'>):ScenarioDates{
 const timezone=TIMEZONES[c.locale]||TIMEZONES.AU;
 const r=parseLocal(c.time_context.received_local),t=parseLocal(c.time_context.target_local);
 if(!r||!t)throw new Error('scenario_dates');
 const receivedDate=addDays(ANCHOR_MONDAY,r.day);
 // The next target weekday strictly after the day it arrived (same weekday means a week later).
 let gap=(t.day-r.day+7)%7;if(gap===0)gap=7;const targetDate=addDays(receivedDate,gap);
 return {timezone,receivedDate,receivedAt:zonedDateTime(receivedDate,r.minute,timezone),targetDate,targetAt:zonedDateTime(targetDate,t.minute,timezone),targetMinute:t.minute};
}

// Each material arrives as "[email screenshot; US; received Wednesday 07:20] '…'". The bracketed envelope is benchmark
// metadata (what kind of thing it was and when it arrived), not words the parent wrote, so it becomes the source type and the
// clock; only the quoted message goes to Bear.
export function messageOf(m:RawMaterial){
 const env=/^\s*\[([^\]]*)\]\s*/.exec(m.content||'');let body=env?m.content.slice(env[0].length):m.content||'';
 body=body.trim().replace(/^['"‘“]([\s\S]*)['"’”]$/,'$1').trim();
 return {source:m.type||(env?env[1].split(';')[0].trim():'text'),text:body};
}
export function parseDataset(text:string):Scenario[]{return text.split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l) as Scenario);}
