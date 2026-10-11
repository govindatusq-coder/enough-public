import type {Idea} from './ideas.ts';
import type {State} from './journey.ts';
import {ideaSchema} from './idea-validation.ts';

export const RECENT_IDEAS=100;
export function mergeIdeas(earlier:Idea[],later:Idea[]):Idea[]{
 const seen=new Set<number>();
 return [...earlier,...later].filter(idea=>{if(seen.has(idea.id))return false;seen.add(idea.id);return true;});
}
// The archive keeps every batch. Account writes need only recent ideas and
// every idea referenced by a bookmark, plan, outcome or cost assumption.
export function accountSnapshot(state:State):State{
 if(!state.generated)return state;
 const required=new Set([...state.saved,...state.entries.map(e=>e.ideaId),...(state.costs||[]).map(c=>c.ideaId)]);
 const recent=new Set(state.generated.slice(-RECENT_IDEAS).map(i=>i.id));
 return {...state,generated:state.generated.filter(i=>required.has(i.id)||recent.has(i.id))};
}
export type HistoryRow={sequence:number|string;idea_json:unknown};
export function historyPage(rows:HistoryRow[],limit:number){
 const page=rows.slice(0,limit),hasMore=rows.length>limit;
 return {ideas:page.map(row=>ideaSchema.parse(row.idea_json)).reverse(),hasMore,nextCursor:hasMore?String(page.at(-1)!.sequence):null};
}
export function freshFirst(ideas:Idea[],freshIds:number[]){
 const fresh=new Map(freshIds.map((id,index)=>[id,index]));
 return [...ideas.filter(i=>fresh.has(i.id)).sort((a,b)=>fresh.get(a.id)!-fresh.get(b.id)!),...ideas.filter(i=>!fresh.has(i.id))];
}
