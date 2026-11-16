import {json,withBear} from '@/lib/bear/server/context';
import {boardView} from '@/lib/bear/board/service';
import {noticeFor,sharesFor,syncMine} from '@/lib/bear/board/shares';
import {completeTask} from '@/lib/bear/services/completion';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
// The Brain Dump Board: everything she has unloaded, her lists, and anything worth knowing about what she shared.
export const GET=(req:Request)=>withBear(req,async({store,user,aiAvailable})=>{
 let profile=await ensureProfile(store);if(!profile.name&&user.name)profile=await store.update('profiles',profile.id,{name:user.name});
 if(!profile.onboardingComplete)return json({onboarding:true});
 let notices:{id:string;text:string}[]=[];let sharing=true;
 try{const {sent}=await syncMine(store,sharesFor(store),id=>completeTask(store,{taskId:id,method:'shared',evidence:'user'} as never));notices=sent.filter(s=>!s.senderSeen).map(s=>({id:s.id,text:noticeFor(s)||''})).filter(n=>n.text);}catch{sharing=false;}
 return json({board:await boardView(store),notices,sharing,aiAvailable});
});
