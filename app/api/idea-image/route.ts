import {signedIn} from '@/lib/supabase/server';
import {byId,type Idea} from '@/lib/ideas';
import {validateState} from '@/lib/account-validation';
export const dynamic='force-dynamic';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){try{
 const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isInteger(id)||id<0)return json({error:'Choose an idea.'},400);
 let generated:Idea[]=[];
 if(id>=1000){const {db,user}=await signedIn();if(!user)return json({error:'Sign in to view this idea.'},401);const {data,error}=await db.from('enough_accounts').select('state_json').eq('user_id',user.id).maybeSingle();if(error)throw error;if(data)generated=validateState(data.state_json).generated||[];}
 const idea=byId(id,generated);if(!idea||idea.image)return json({error:'No image requested.'},404);
 const query=(idea.brief||idea.title).split('.')[0].split(/\s+/).slice(0,5).join(' ');
 const res=await fetch('https://api.openverse.org/v1/images/?q='+encodeURIComponent(query)+'&license=cc0,pdm,by,by-sa&categories=photograph&mature=false&page_size=12',{signal:AbortSignal.timeout(8000),cache:'no-store'});if(!res.ok)throw Error('Image search unavailable');
 const result=await res.json() as {results?:{url:string;width:number;creator:string;license:string;license_version?:string;foreign_landing_url:string}[]};
 for(const hit of result.results||[]){let url;try{url=new URL(hit.url)}catch{continue}
  if(hit.width<900||!['cc0','pdm','by','by-sa'].includes(hit.license)||url.protocol!=='https:'||!['upload.wikimedia.org','live.staticflickr.com','images.unsplash.com','cdn.stocksnap.io'].includes(url.hostname))continue;
  return json({image:hit.url,creator:(hit.creator||'Photographer').slice(0,100),license:hit.license==='pdm'?'Public domain':hit.license==='cc0'?'CC0':('CC '+hit.license.toUpperCase()+' '+(hit.license_version||'')).trim(),sourceUrl:/^https:\/\//.test(hit.foreign_landing_url)?hit.foreign_landing_url:hit.url});
 }
 return json({error:'No suitable licensed photo yet.'},404);
 }catch{return json({error:'Image unavailable. The idea is still available.'},503)}}
