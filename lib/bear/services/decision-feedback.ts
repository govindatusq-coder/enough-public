import type {BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';

// "Was Bear's first read right?" Records ONLY the labels: what Bear said, what the person says it should
// have been, and which rule fired. Never the email's subject, sender or text. This is the honest way to
// build real, consented test data from real use.
export const DECISION_LABELS=['ACT','ASK','WAIT','UPDATE','CLOSE','IGNORE'] as const;
export type DecisionLabel=typeof DECISION_LABELS[number];
export interface DecisionFeedback{predicted:DecisionLabel;correct:boolean;expected?:DecisionLabel|null;rule?:string|null}
const RULE=/^[a-z0-9-]{1,60}$/;
export function parseFeedback(input:unknown):DecisionFeedback{
 const o=(input&&typeof input==='object'?input:{}) as Record<string,unknown>;
 const ok=(v:unknown):v is DecisionLabel=>typeof v==='string'&&(DECISION_LABELS as readonly string[]).includes(v);
 if(!ok(o.predicted)||typeof o.correct!=='boolean')throw new Error('invalid_feedback');
 const expected=o.correct?o.predicted:(ok(o.expected)?o.expected:null);
 if(!o.correct&&!expected)throw new Error('invalid_feedback');
 return {predicted:o.predicted,correct:o.correct,expected,rule:typeof o.rule==='string'&&RULE.test(o.rule)?o.rule:null};
}
export async function recordDecisionFeedback(store:BearStore,input:unknown,now=new Date()){
 const f=parseFeedback(input);
 await recordBehaviour(store,'research_signal',{signal:'decision_feedback',predicted:f.predicted,expected:f.expected,correct:f.correct,rule:f.rule},now);
 return {ok:true as const};
}
