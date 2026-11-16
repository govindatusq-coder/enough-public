import {json,withBear} from '@/lib/bear/server/context';
import {ignoreSuggestion} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;await ignoreSuggestion(store,id);return json({ok:true});});
