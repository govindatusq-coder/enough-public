// Offers sent to many people ("grants for eligible staff"). Bear can't know who qualifies, so the first time it
// asks once, remembers the person's own answer for that GROUP, and stops asking. Never inferred, only what the
// person says. Sensitive groups (hardship, income, disability, health) are never remembered: Bear asks each time.
import {decide,type Decided} from './decide.ts';
export const OFFER_GROUPS=['staff','student','senior','parent'] as const;
export type OfferGroup=typeof OFFER_GROUPS[number];
export type OfferAnswers=Partial<Record<OfferGroup,'yes'|'no'>>;
export const OFFER_LABELS:Record<OfferGroup,string>={staff:'staff or employees',student:'students',senior:'seniors',parent:'parents and carers'};

const SENSITIVE=/\b(hardship|low[- ]income|income[- ]support|concession|disabilit\w+|health (care )?card|mental health|medical condition|unemploy\w+|refugee|asylum|domestic violence|crisis)\b/i;
const GROUP_PATTERNS:[OfferGroup,RegExp][]=[
 ['staff',/\b(eligible|open to|available to|for)\b[^.?!]{0,40}\b(staff|employees?|team members)\b/i],
 ['student',/\b(eligible|open to|available to|for)\b[^.?!]{0,40}\bstudents?\b/i],
 ['senior',/\b(eligible|open to|available to|for)\b[^.?!]{0,40}\b(seniors?|pensioners?|over 65|aged 65)\b/i],
 ['parent',/\b(eligible|open to|available to|for)\b[^.?!]{0,40}\b(parents?|carers?|guardians?|families with children)\b/i],
];
export interface OfferInfo{group:OfferGroup|null;sensitive:boolean}
// Which group is the offer for? null if Bear can't tell. Sensitive offers are flagged and never resolved.
export function offerGroup(text:string):OfferInfo{
 if(SENSITIVE.test(text))return {group:null,sensitive:true};
 for(const [g,re] of GROUP_PATTERNS)if(re.test(text))return {group:g,sensitive:false};
 return {group:null,sensitive:false};
}
export interface DecidedFor extends Decided{offer?:OfferInfo&{resolved:boolean}}
// decide(), plus what the person has already told Bear about offers. Only resolves a clear, non-sensitive group.
export function decideFor(text:string,answers:OfferAnswers={}):DecidedFor{
 const d=decide(text);
 if(d.rule!=='eligibility-offer')return d;
 const info=offerGroup(text);
 const answer=info.group?answers[info.group]:undefined;
 if(info.group&&!info.sensitive&&answer==='yes')return {decision:'ACT',meaning:'offer_you_qualify',rule:'offer-remembered-yes',offer:{...info,resolved:true}};
 if(info.group&&!info.sensitive&&answer==='no')return {decision:'IGNORE',meaning:'offer_not_for_you',rule:'offer-remembered-no',offer:{...info,resolved:true}};
 return {...d,offer:{...info,resolved:false}};
}
