import {HttpError,json,withBear} from '@/lib/bear/server/context';
import {areaView} from '@/lib/bear/services/areas';
import {areaKeys,type AreaKey} from '@/lib/bear/domain/types';
export const dynamic='force-dynamic';
export const GET=(req:Request,{params}:{params:Promise<{key:string}>})=>withBear(req,async({store})=>{const {key}=await params;if(!(areaKeys as readonly string[]).includes(key))throw new HttpError("Bear doesn't know that part of life.",404);return json(await areaView(store,key as AreaKey));});
