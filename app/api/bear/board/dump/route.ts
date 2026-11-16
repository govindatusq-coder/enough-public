import {json,readJson,withBear} from '@/lib/bear/server/context';
import {dumpSchema,unload} from '@/lib/bear/board/service';
import {afterDrop} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';export const maxDuration=60;
// Drop Bear: split what she said into responsibilities, plan each one, and mention the one thing worth knowing now (if any).
export const POST=(req:Request)=>withBear(req,async({store,provider})=>{
 const r=await unload(store,provider,dumpSchema.parse(await readJson(req)));
 let tip:{taskId:string;text:string}|null=null;try{tip=await afterDrop(store,r.added.map(a=>a.id));}catch{/* planning can happen later; nothing is lost */}
 return json({...r,tip},201);
});
