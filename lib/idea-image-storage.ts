import type {SupabaseClient} from '@supabase/supabase-js';
import type {IdeaImageStore} from './idea-image-service.ts';

const missing=(error:{status?:number;statusCode?:string})=>Number(error.statusCode||error.status)===404;
export function ideaImageStorage(db:SupabaseClient):IdeaImageStore{
 const bucket=db.storage.from('enough-photos');
 return {
  async read(key){const {data,error}=await bucket.download(key);if(error){if(missing(error))return null;throw error;}return new Uint8Array(await data.arrayBuffer());},
  async create(key,bytes){const {error}=await bucket.upload(key,bytes,{contentType:'image/jpeg',upsert:false,cacheControl:'0'});if(!error)return true;if(Number(error.statusCode||error.status)===409)return false;throw error;},
  async createdAt(key){const {data,error}=await bucket.info(key);if(error){if(missing(error))return null;throw error;}const timestamp=Date.parse(data.createdAt||data.lastModified||data.metadata?.lastModified||'');if(!Number.isFinite(timestamp))throw Error('Image reservation timestamp unavailable');return timestamp;},
  async remove(key){const {error}=await bucket.remove([key]);if(error)throw error;}
 };
}
