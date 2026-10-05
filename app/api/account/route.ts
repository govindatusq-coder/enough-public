import {signedIn} from '@/lib/supabase/server';
import {sameOrigin} from '@/lib/public-auth';
import {validateState,writeSchema} from '@/lib/account-validation';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{
 const {db,user}=await signedIn();if(!user)return json({user:null,state:null,revision:0,signIn:'/signin'});
 const {data,error}=await db.from('enough_accounts').select('state_json,revision,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;
 return json({user:{email:user.email,name:user.user_metadata?.name||''},state:data?validateState(data.state_json):null,revision:data?.revision||0,updatedAt:data?.updated_at||null,signIn:'/signin',signOut:'/signout'});
 }catch{return json({error:'Your account could not be loaded. Please try again.'},503)}}
export async function PUT(req:Request){if(!sameOrigin(req))return json({error:'Request origin is not allowed.'},403);try{
 const {db,user}=await signedIn();if(!user)return json({error:'Sign in to save to your account.'},401);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>1024*1024)return json({error:'Account data is too large.'},413);
 let input;try{input=writeSchema.parse(JSON.parse(raw))}catch{return json({error:'Check your profile and move data.'},400)}
 const state=validateState(input.state);state.demo=false;
 const {data,error}=await db.rpc('enough_save_account',{p_state:state,p_revision:input.revision});if(error)throw error;
 if(!data?.length)return json({error:'Your account changed in another tab or device. Reload the cloud version before saving again.'},409);return json(data[0]);
 }catch{return json({error:'Your changes could not be saved. Please try again.'},503)}}
export async function DELETE(req:Request){if(!sameOrigin(req))return json({error:'Request origin is not allowed.'},403);try{
 const {db,user}=await signedIn();if(!user)return json({error:'Sign in first.'},401);
 const body=await req.json();if(body.confirmation!=='DELETE ENOUGH DATA'||!Number.isInteger(body.revision))return json({error:'Confirm deletion first.'},400);
 const {data:current,error:readError}=await db.from('enough_accounts').select('revision').eq('user_id',user.id).maybeSingle();if(readError)throw readError;
 if(current){const {data,error}=await db.from('enough_accounts').delete().eq('user_id',user.id).eq('revision',body.revision).select('user_id');if(error)throw error;if(!data.length)return json({error:'Your account changed. Reload before deleting.'},409)}
 for(;;){const {data,error}=await db.storage.from('enough-photos').list(user.id,{limit:100});if(error)throw error;if(!data?.length)break;const removed=await db.storage.from('enough-photos').remove(data.map(p=>user.id+'/'+p.name));if(removed.error)throw removed.error;}
 return json({deleted:true});
 }catch{return json({error:'Deletion could not finish. Try again to remove remaining photos.'},503)}}
