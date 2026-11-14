import {json,readJson,withBear} from '@/lib/bear/server/context';
import {areaSchema,setTaskArea} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
// "Where does this go?": move one task to another area.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const {area}=areaSchema.parse(await readJson(req));return json(await setTaskArea(store,id,area));});
