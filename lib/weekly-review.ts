import {z} from 'zod';
import type {State} from './journey.ts';
export const planMoments=['yes','different-time','no'] as const;
export const planMomentSchema=z.enum(planMoments);
export type PlanMoment=typeof planMoments[number];
export const planMomentLabels:Record<PlanMoment,string>={yes:'Yes','different-time':'Different time',no:'No'};
export function localWeek(now=new Date()){
 const start=new Date(now);start.setHours(12,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));
 return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
}
const week=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(value+'T12:00:00');return Number.isFinite(date.getTime())&&date.getDay()===1&&localWeek(date)===value},'Use the local Monday for the week');
const note=z.string().max(240);
export const weeklyReviewSchema=z.object({week,reviewedAt:z.string().datetime({offset:true}),worked:note,barrier:note,smallFix:note,plans:z.array(z.object({entryId:z.string().min(1).max(100),choice:z.enum(['keep','change','pause'])}).strict()).max(2000)}).strict().refine(r=>new Set(r.plans.map(p=>p.entryId)).size===r.plans.length,'Choose each plan once');
export const weeklyReviewsSchema=z.array(weeklyReviewSchema).max(520).refine(rows=>new Set(rows.map(r=>r.week)).size===rows.length,'One review per local week');
export type WeeklyReview=z.infer<typeof weeklyReviewSchema>;
export function activePlans(state:State){return state.entries.filter(e=>e.status==='accepted'&&e.support&&!e.support.paused);}
export function saveWeeklyReview(state:State,input:Omit<WeeklyReview,'week'|'reviewedAt'>,now=new Date()):State{
 const review=weeklyReviewSchema.parse({...input,worked:input.worked.trim(),barrier:input.barrier.trim(),smallFix:input.smallFix.trim(),week:localWeek(now),reviewedAt:now.toISOString()});
 const active=new Set(activePlans(state).map(e=>e.id));
 if(review.plans.some(p=>!active.has(p.entryId)))throw Error('A plan has changed. Reopen the review to use the current plans.');
 const reviews=weeklyReviewsSchema.parse([...(state.weeklyReviews||[]).filter(r=>r.week!==review.week),review]);
 const paused=new Set(review.plans.filter(p=>p.choice==='pause').map(p=>p.entryId));
 return {...state,weeklyReviews:reviews,entries:state.entries.map(e=>paused.has(e.id)&&e.support?{...e,support:{...e.support,paused:true,reminderDismissed:true,updatedAt:review.reviewedAt}}:e)};
}
