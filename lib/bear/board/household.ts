// Her household list for Share Bear: who she shares with. Optional details only fill in her own Mail or Messages app.
import {z} from 'zod';
import {newId,type BearStore} from '../store/store.ts';
import {ensureProfile} from '../services/profile.ts';
// An empty box means "none".
const blank=(v:unknown)=>typeof v==='string'&&!v.trim()?null:v;
export const householdSchema=z.object({people:z.array(z.object({id:z.string().max(60),name:z.string().trim().min(1).max(60),email:z.preprocess(blank,z.string().trim().email().max(200).nullable()),phone:z.preprocess(blank,z.string().trim().regex(/^[+\d][\d\s()-]{5,20}$/).nullable())}).strict()).max(30)}).strict();
export async function saveHousehold(store:BearStore,input:z.infer<typeof householdSchema>){
 const profile=await ensureProfile(store);const before=new Map((profile.household||[]).map(h=>[h.id,h]));const seen=new Set<string>();
 const household=input.people.filter(p=>{const k=p.name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;})
  .map(p=>({id:p.id==='new'||!before.has(p.id)?newId():p.id,name:p.name,email:p.email||null,phone:p.phone||null,...(before.get(p.id)?.joined?{joined:true}:{})}));
 await store.update('profiles',profile.id,{household});
 return household;
}
