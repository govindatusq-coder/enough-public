import {signedIn} from '@/lib/supabase/server';
import {historyPage,RECENT_IDEAS} from '@/lib/suggestion-history';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){try{
 const {db,user}=await signedIn(req);if(!user)return json({error:'Sign in to browse your earlier suggestions.'},401);
 const cursor=new URL(req.url).searchParams.get('before');
 if(cursor!==null&&(!/^\d{1,19}$/.test(cursor)||BigInt(cursor)>BigInt('9223372036854775807')))return json({error:'Choose a valid page of suggestions.'},400);
 const limit=cursor===null?RECENT_IDEAS:32;
 let query=db.from('enough_ideas').select('sequence,idea_json').eq('user_id',user.id).order('sequence',{ascending:false}).limit(limit+1);
 if(cursor!==null)query=query.lt('sequence',cursor);
 const {data,error}=await query;if(error)throw error;
 return json(historyPage(data||[],limit));
 }catch{return json({error:'Earlier suggestions could not be loaded. Try again.'},503);}}
