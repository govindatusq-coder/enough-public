import type {LoadMap,PatternId} from '../load/types.ts';
import type {ValueArea,ValuesGoalsMap,ValueEntry} from './types.ts';

// Values are inferred cautiously and never assumed: a domain the person said they carry, or a
// kind of load they give Bear again and again, suggests a value at low confidence. Anything the
// person confirms or adds in Settings wins outright. Nothing here comes from age, gender or place.
const fromDomain:Record<string,ValueArea[]>={kids:['parenting'],home:['home'],work:['career'],money:['financial_security'],health:['health'],people:['relationships'],pets:['caregiving']};
const fromPattern:Partial<Record<PatternId,ValueArea>>={SCHOOL_EVENT:'parenting',BILL_PAYMENT:'financial_security',APPOINTMENT:'health',INVITATION_EVENT:'relationships',REPAIR_PROBLEM:'home'};
export function effectiveValues(saved:ValuesGoalsMap|null|undefined,loadMap:LoadMap|null|undefined,patternCounts:Partial<Record<PatternId,number>>={}):ValuesGoalsMap{
 const values=new Map<ValueArea,ValueEntry>();
 for(const [d,on] of Object.entries(loadMap?.domains||{}))if(on)for(const v of fromDomain[d]||[])values.set(v,{key:v,source:'inferred',confidence:0.5});
 for(const c of loadMap?.caringResponsibilities||[])if(c==='older_family'||c==='support_needs')values.set('caregiving',{key:'caregiving',source:'inferred',confidence:0.55});
 for(const [p,n] of Object.entries(patternCounts)){const v=fromPattern[p as PatternId];if(v&&(n||0)>=3&&!values.has(v))values.set(v,{key:v,source:'inferred',confidence:Math.min(0.6,0.3+(n||0)*0.05)});}
 for(const v of saved?.values||[])values.set(v.key,v);
 // A value the person switched off is saved at confidence 0 and stays off.
 return {values:[...values.values()].filter(v=>v.confidence>0),goals:saved?.goals||[],learnedPriorities:saved?.learnedPriorities||[]};
}
