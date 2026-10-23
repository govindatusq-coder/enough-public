import {formatAUD} from '../domain/money.ts';
import type {BearStore} from '../store/store.ts';
// My Wins: a visual receipt for invisible labour, not a completed-task list.
export interface WinsView{totals:{handled:number;moneyCents:number;timeMinutes:number;forMe:number};cards:{id:string;title:string;detail:string;amount:string|null;when:string;isDemo:boolean}[];reinforcement:string|null}
export async function winsView(store:BearStore):Promise<WinsView>{
 const wins=await store.list('wins',{orderBy:{column:'created_at',ascending:false},limit:100});
 const ledger=await store.list('value_ledger',{orderBy:{column:'occurred_at',ascending:false},limit:300});
 const moneyCents=ledger.filter(r=>r.kind==='wealth'&&r.defensible).reduce((s,r)=>s+(r.amountCents||0),0);
 const timeMinutes=ledger.filter(r=>r.kind==='happiness').reduce((s,r)=>s+(r.minutes||0),0);
 const forMe=ledger.filter(r=>r.kind==='health').length;
 const lines=['One less thing to carry.',"Bear's got the rest.","That's sorted."];
 return {totals:{handled:wins.length,moneyCents,timeMinutes,forMe},cards:wins.map(w=>({id:w.id,title:w.title,detail:w.detail,amount:w.amountCents?'+'+formatAUD(w.amountCents):null,when:w.createdAt,isDemo:w.isDemo})),reinforcement:wins.length&&wins.length%3===1?lines[wins.length%lines.length]:null};
}
