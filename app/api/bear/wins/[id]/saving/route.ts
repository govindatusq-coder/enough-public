import {json,readJson,withBear} from '@/lib/bear/server/context';
import {setWinSaving,winSavingSchema} from '@/lib/bear/services/win-edit';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json({win:await setWinSaving(store,id,winSavingSchema.parse(await readJson(req)))});});
