import type {Importance,WorkRole} from '../domain/types.ts';
import type {PatternId} from '../load/types.ts';

// Work roles (internal): what a piece of work mainly does. Maintain keeps life running, prevent stops
// future trouble, progress moves a meaningful goal forward, restore protects capacity.
const PROGRESS=/\b(manuscript|paper|article|grant|thesis|chapter|proposal|book|draft|research|analysis|launch|business|course|study|qualification|portfolio|pricing model|strategy|startup|savings? goal|renovat\w*|collaborat\w*|discussion|methods|abstract|publication|arc linkage|partner(?:ship)?)\b/i;
const RESTORE=/\b(rest|walk|yoga|gym|run|swim|read for fun|me time|holiday|break|massage|catch up with|date night|hobby|garden(?:ing)?|meditat\w*|sleep)\b/i;
const PREVENT=/\b(renew\w*|service|check[- ]?up|maintenance|backup|insurance|inspection|vaccin\w*|smoke alarm|warranty|before it)\b/i;
const patternRole:Record<PatternId,WorkRole>={BILL_PAYMENT:'maintain',SCHOOL_EVENT:'maintain',APPOINTMENT:'prevent',FORM_APPLICATION:'maintain',REPAIR_PROBLEM:'prevent',WAITING_FOR_RESPONSE:'maintain',PURCHASE_REQUIRED:'maintain',RENEWAL:'prevent',INVITATION_EVENT:'restore',REPLENISHMENT:'maintain',UNKNOWN_LOAD:'maintain'};
export function roleOf(pattern:PatternId,text:string,projectRole?:WorkRole|null,taskRole?:WorkRole|null):{role:WorkRole;explicit:boolean}{
 if(taskRole)return {role:taskRole,explicit:true};
 // A project's role is a strong prior for its tasks, but obvious upkeep inside it stays upkeep.
 if(projectRole&&!(projectRole==='progress'&&LOW_LEVERAGE.test(text)))return {role:projectRole,explicit:true};
 if(pattern==='UNKNOWN_LOAD'){if(PROGRESS.test(text))return {role:'progress',explicit:false};if(RESTORE.test(text))return {role:'restore',explicit:false};if(PREVENT.test(text))return {role:'prevent',explicit:false};}
 return {role:patternRole[pattern],explicit:false};
}
// Small, tidy-up work inside an important project: worth doing, not strategically important.
export const LOW_LEVERAGE=/\b(font|format\w*|heading|tidy|colou?r|spacing|rename|re-?order|move (?:the )?card|fix (?:the )?references|references|typos?|spell ?check|margins?|page numbers?|cover page|file names?)\b/i;
export const isLowLeverage=(text:string)=>LOW_LEVERAGE.test(text);
// The person's traffic light as a prior. Never written back from inference.
export const importancePrior:Record<Importance,number>={very:0.88,nice:0.62,not:0.25};
export const importanceLabel:Record<Importance,string>={very:'Really matters',nice:'Matters',not:'Low stakes'};
export const roleLabel:Record<WorkRole,string>={progress:'Moves you forward',maintain:'Keeps things running',prevent:'Prevents trouble',restore:'Matters to you'};
