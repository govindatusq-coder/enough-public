import {signedIn} from '@/lib/supabase/server';
import type {Idea} from '@/lib/ideas';
import {validateState} from '@/lib/account-validation';
import {createIdeaImageHandlers} from '@/lib/idea-image-http';
import {generateIdeaImage} from '@/lib/idea-image-service';
import {ideaImageStorage} from '@/lib/idea-image-storage';
export const dynamic='force-dynamic';
export const maxDuration=180;
async function licensed(idea:Idea){
 const query=(idea.brief||idea.title).split('.')[0].split(/\s+/).slice(0,5).join(' ');
 const res=await fetch('https://api.openverse.org/v1/images/?q='+encodeURIComponent(query)+'&license=cc0,pdm,by,by-sa&categories=photograph&mature=false&page_size=12',{signal:AbortSignal.timeout(8000),cache:'no-store'});if(!res.ok)throw Error('Image search unavailable');
 const result=await res.json() as {results?:{url:string;width:number;creator:string;license:string;license_version?:string;foreign_landing_url:string}[]};
 for(const hit of result.results||[]){let url;try{url=new URL(hit.url)}catch{continue}
  if(hit.width<900||!['cc0','pdm','by','by-sa'].includes(hit.license)||url.protocol!=='https:'||!['upload.wikimedia.org','live.staticflickr.com','images.unsplash.com','cdn.stocksnap.io'].includes(url.hostname))continue;
  return {image:hit.url,creator:(hit.creator||'Photographer').slice(0,100),license:hit.license==='pdm'?'Public domain':hit.license==='cc0'?'CC0':('CC '+hit.license.toUpperCase()+' '+(hit.license_version||'')).trim(),sourceUrl:/^https:\/\//.test(hit.foreign_landing_url)?hit.foreign_landing_url:hit.url};
 }
 return null;
}
const handlers=createIdeaImageHandlers({
 async account(){const {db,user}=await signedIn();if(!user)return null;const {data,error}=await db.from('enough_accounts').select('state_json').eq('user_id',user.id).maybeSingle();if(error)throw error;return {owner:user.id,ideas:data?validateState(data.state_json).generated||[]:[],store:ideaImageStorage(db),async takeSlot(){const {data:slot,error}=await db.rpc('enough_take_ai_slot');if(error)throw error;return !!slot;}};},
 generate:idea=>generateIdeaImage(idea,process.env.OPENAI_API_KEY||'',process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst'),
 licensed
});
export const GET=handlers.GET;
export const POST=handlers.POST;
