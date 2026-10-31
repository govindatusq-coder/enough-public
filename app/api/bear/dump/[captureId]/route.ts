import {json,readJson,withBear} from '@/lib/bear/server/context';
import {dumpView,sortDump,sortDumpSchema} from '@/lib/bear/services/dump';
export const dynamic='force-dynamic';
export const GET=(req:Request,{params}:{params:Promise<{captureId:string}>})=>withBear(req,async({store})=>{const {captureId}=await params;return json(await dumpView(store,captureId));});
export const POST=(req:Request,{params}:{params:Promise<{captureId:string}>})=>withBear(req,async({store})=>{const {captureId}=await params;return json(await sortDump(store,captureId,sortDumpSchema.parse(await readJson(req))));});
