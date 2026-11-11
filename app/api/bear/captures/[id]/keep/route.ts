import {HttpError,json,withBear} from '@/lib/bear/server/context';
import {maybeAutoSetup} from '@/lib/bear/services/auto-setup';
export const dynamic='force-dynamic';
// "Keep it anyway": Bear said a message needed nothing, the person disagrees, so it goes through as an ordinary capture.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,provider})=>{
 const {id}=await params;const capture=await store.get('captures',id);if(!capture||!capture.extractionId)throw new HttpError('Bear couldn’t find that.',404);
 if(capture.status!=='rejected')return json({capture,auto:null});
 const extraction=await store.get('extractions',capture.extractionId);if(!extraction)throw new HttpError('Bear couldn’t find that.',404);
 const draft=await store.update('extractions',extraction.id,{status:'draft'});const c=await store.update('captures',capture.id,{status:'needs_verification'});
 const a=await maybeAutoSetup(store,draft,new Date(),provider).catch(()=>null);
 return json({capture:c,auto:a?{taskId:a.task.id,title:a.task.title}:null});
});
