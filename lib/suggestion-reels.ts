// Keep the discovery order while current PINS continue to decide eligibility.
export function reelItems<T extends {idea:{id:number}}>(available:T[],ids:number[]|null):T[]{
 if(ids===null)return available;
 const byId=new Map(available.map(item=>[item.idea.id,item]));
 return [...new Set(ids)].flatMap(id=>{const item=byId.get(id);return item?[item]:[]});
}

export function nextReelId(ids:number[],current:number,direction:number):number|null{
 const position=ids.indexOf(current);
 const next=(position<0?0:position)+direction;
 return next>=0&&next<ids.length?ids[next]:null;
}

export function swipeDirection(dx:number,dy:number):number{
 return Math.abs(dy)>=65&&Math.abs(dy)>Math.abs(dx)*1.2?(dy<0?1:-1):0;
}
