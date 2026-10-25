// Pure helpers for shopping / supply lists. Safe to import from client and server.
export interface RawItem{name:string;quantity:string|null;estimatedCents:number|null}
// "2 bags potting mix" / "3 x fence palings" / "eggs x 2" / "milk" → name + quantity.
export function parseItemLine(line:string):RawItem|null{
 const part=line.replace(/^[\s•\-*]+/,'').replace(/^\d+[.)]\s+/,'').trim();
 if(!part||part.length>80)return null;
 const m=/^(\d+(?:\.\d+)?\s*(?:x|kg|g|l|ml|packs?|pk|bags?|boxes?|bottles?|cans?|dozen)?)\s+(.+)$/i.exec(part)||/^(.+?)\s+[x×]\s*(\d+)$/i.exec(part);
 if(m&&/^\d/.test(m[1]))return {name:m[2].trim(),quantity:m[1].trim(),estimatedCents:null};
 if(m)return {name:m[1].trim(),quantity:m[2].trim(),estimatedCents:null};
 return {name:part,quantity:null,estimatedCents:null};
}
export function parseItemLines(text:string):RawItem[]{return text.split('\n').map(parseItemLine).filter((x):x is RawItem=>!!x).slice(0,60);}
export function formatItemLine(i:{name:string;quantity:string|null}){return i.quantity?`${i.quantity} ${i.name}`:i.name;}
// "2", "3 packs" multiply a per-item estimate; weights and volumes do not.
export function qtyFactor(q:string|null){if(!q)return 1;const m=/^(\d+)\s*(x|packs?|pk|bags?|boxes?|bottles?|cans?)?$/i.exec(q.trim());return m?Math.min(50,Math.max(1,Number(m[1]))):1;}
export const itemCost=(i:{quantity:string|null;estimatedCents:number|null})=>i.estimatedCents===null?0:i.estimatedCents*qtyFactor(i.quantity);
export function totalCost(items:{quantity:string|null;estimatedCents:number|null}[]):number|null{return items.some(i=>i.estimatedCents!==null)?items.reduce((s,i)=>s+itemCost(i),0):null;}
// A purchase this size is worth offering to split.
export const LARGE_PURCHASE_CENTS=10000;
