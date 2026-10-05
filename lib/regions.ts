import {z} from 'zod';
export const currencyCodes=['AUD','NZD','USD','GBP','CAD','EUR','SGD','ZAR'] as const;
export const currencySchema=z.enum(currencyCodes);
export const regions=[
 {code:'AU',name:'Australia',currency:'AUD',locale:'en-AU'},
 {code:'NZ',name:'New Zealand',currency:'NZD',locale:'en-NZ'},
 {code:'US',name:'United States',currency:'USD',locale:'en-US'},
 {code:'GB',name:'United Kingdom',currency:'GBP',locale:'en-GB'},
 {code:'CA',name:'Canada',currency:'CAD',locale:'en-CA'},
 {code:'IE',name:'Ireland',currency:'EUR',locale:'en-IE'},
 {code:'SG',name:'Singapore',currency:'SGD',locale:'en-SG'},
 {code:'ZA',name:'South Africa',currency:'ZAR',locale:'en-ZA'},
] as const;
export const countrySchema=z.enum(['AU','NZ','US','GB','CA','IE','SG','ZA']);
export function regionFor(country?:string){return regions.find(r=>r.code===country);}
export function regionChange(country:string){const region=regionFor(country);if(!region)throw Error('Choose a supported country');return {country:region.code,currency:region.currency};}
export function formatMoney(cents:number,currency:string,country?:string){return new Intl.NumberFormat(regionFor(country)?.locale||'en',{style:'currency',currency,currencyDisplay:'code'}).format(cents/100);}
export function parseMoney(text:string):number|null{const value=text.trim();if(!/^\d{1,4}(\.\d{1,2})?$/.test(value))return null;const [whole,fraction='']=value.split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));return cents<=100000?cents:null;}
export const costSchema=z.object({ideaId:z.number().int().nonnegative(),currency:currencySchema,usualCents:z.number().int().min(0).max(100000),moveCents:z.number().int().min(0).max(100000),updatedAt:z.string().datetime({offset:true})}).strict();
export type Cost=z.infer<typeof costSchema>;
export function savingFromCost(cost:Cost){return Math.max(0,cost.usualCents-cost.moveCents);}
