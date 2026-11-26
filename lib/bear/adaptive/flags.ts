// Experimental conditions for evaluating the engine (development and the synthetic harness only).
//  A conventional task management · B generic assistance · C personalised lists + generic assistance
//  D adaptive strategy + generic lists · E full personalisation
// Production never reads the flag: people are not enrolled in experiments without being asked. There, Bear uses full
// personalisation when she has answered "How your days work", and generic assistance otherwise.
export type Condition='A'|'B'|'C'|'D'|'E';
export function conditionFor(env:Record<string,string|undefined>,hasProfile:boolean):Condition{
 const forced=env.VERCEL_ENV!=='production'&&env.NODE_ENV!=='production'?env.BEAR_ENGINE_CONDITION:undefined;
 if(forced&&/^[A-E]$/.test(forced))return forced as Condition;
 return hasProfile?'E':'B';
}
