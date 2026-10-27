import {json,withBear} from '@/lib/bear/server/context';
import {prioritiseOpen,whyView} from '@/lib/bear/services/priority';
export const dynamic='force-dynamic';
// "Why this matters?": fetched only when the person taps it. Plain words, at most four reasons.
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const r=(await prioritiseOpen(store)).results.get(id);
 return json(r?whyView(r):{reasons:[],latestComfortable:null,latestSafe:null,deadline:null,firstStep:null});
});
