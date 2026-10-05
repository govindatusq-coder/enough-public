import {z} from 'zod';
const count=z.number().finite().nonnegative().max(1000000).nullable();
const iso=z.string().datetime({offset:true});
export const movementWindowSchema=z.object({start:iso,end:iso.optional()}).strict().refine(w=>!w.end||(Date.parse(w.end)>Date.parse(w.start)&&Date.parse(w.end)-Date.parse(w.start)<=86400000),'Use a movement check of up to 24 hours');
export const movementEvidenceSchema=z.object({source:z.enum(['apple-health','health-connect']),start:iso,end:iso,readAt:iso,steps:count,exerciseMinutes:count}).strict().refine(w=>Date.parse(w.end)>Date.parse(w.start)&&Date.parse(w.end)-Date.parse(w.start)<=86400000&&Date.parse(w.end)<=Date.parse(w.readAt));
export const snapshotSchema=z.object({source:z.enum(['apple-health','health-connect']),timezone:z.string().min(1).max(100),readAt:iso,days:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),steps:count,exerciseMinutes:count}).strict()).max(15)}).strict().refine(s=>new Set(s.days.map(d=>d.date)).size===s.days.length,'Duplicate movement dates').refine(s=>{try{dateAt(new Date(),s.timezone);return true}catch{return false}},'Invalid timezone');
export type Snapshot=z.infer<typeof snapshotSchema>;
export type Evidence=z.infer<typeof movementEvidenceSchema>;
export type Metric='steps'|'exerciseMinutes';
export const movementSettingsSchema=z.object({metric:z.enum(['steps','exerciseMinutes']),threshold:z.number().int().finite().positive().max(100000).nullable()}).strict();
export type MovementSettings=z.infer<typeof movementSettingsSchema>;
export function dateAt(now:Date,timezone:string){const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=(name:string)=>p.find(v=>v.type===name)!.value;return `${part('year')}-${part('month')}-${part('day')}`;}
export function suggestedThreshold(s:Snapshot,metric:Metric,now=new Date()):number|null{
 const today=dateAt(now,s.timezone);const oldest=new Date(today+'T12:00:00Z');oldest.setUTCDate(oldest.getUTCDate()-14);const lower=oldest.toISOString().slice(0,10);
 const unique=new Map(s.days.filter(d=>d.date<today&&d.date>=lower).map(d=>[d.date,d[metric]]));const values=[...unique.values()].filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);if(values.length<7)return null;const middle=Math.floor(values.length/2);const median=values.length%2?values[middle]:(values[middle-1]+values[middle])/2;return median>0?Math.max(1,Math.round(median)):null;
}
export function todayMovement(s:Snapshot|null,now=new Date()){if(!s||Date.parse(s.readAt)>now.getTime()+60000||now.getTime()-Date.parse(s.readAt)>15*60000)return null;return s.days.find(d=>d.date===dateAt(now,s.timezone))||null;}
export function enoughToday(s:Snapshot|null,settings:MovementSettings,now=new Date()){const value=todayMovement(s,now)?.[settings.metric];return settings.threshold!==null&&value!==null&&value!==undefined&&value>=settings.threshold;}
