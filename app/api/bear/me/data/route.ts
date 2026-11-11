import {createClient} from '@supabase/supabase-js';
import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {serverClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Delete everything this person has in Load Bear: records, stored files, forms, reminders, settings. Irreversible, and only after
// the person types DELETE. If the owner has configured the service-role key the sign-in itself is removed too; otherwise the
// sign-in (email and password) remains and the response says so, so Bear never claims more than it did.
export const DELETE=(req:Request)=>withBear(req,async({store,user})=>{
 const body=await readJson(req,512) as {confirm?:string};
 if(body.confirm!=='DELETE')throw new HttpError('Type DELETE to confirm.',400);
 await store.eraseAll();
 let loginRemoved=false;const key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(key&&url){try{const admin=createClient(url,key,{auth:{persistSession:false}});const {error}=await admin.auth.admin.deleteUser(user.id);loginRemoved=!error;}catch{loginRemoved=false;}}
 try{if(process.env.NEXT_PUBLIC_SUPABASE_URL)await (await serverClient()).auth.signOut();}catch{/* the data is gone; the session just ends */}
 return json({deleted:true,loginRemoved});
},{write:true});
