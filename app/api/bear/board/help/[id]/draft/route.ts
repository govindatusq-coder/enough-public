import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {DraftError,draftRequestSchema,writeDraft} from '@/lib/bear/board/draft';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';export const maxDuration=60;
// Bear writes (or improves) the draft with AI. Nothing is saved or sent here: the page shows it, and saving happens as she edits.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,provider})=>{
 const {id}=await params;const task=await store.get('tasks',id);if(!task)return json({error:"Bear couldn't find that."},404);
 const profile=await ensureProfile(store);
 try{return json({draft:await writeDraft(store,provider,task,(profile.name||'').split(/\s+/)[0]||'',draftRequestSchema.parse(await readJson(req)))});}
 catch(e){if(e instanceof DraftError)throw new HttpError(e.message,e.status);throw e;}
});
