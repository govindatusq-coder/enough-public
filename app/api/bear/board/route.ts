import {json,withBear} from '@/lib/bear/server/context';
import {boardView} from '@/lib/bear/board/service';
import {noticeFor,syncMine} from '@/lib/bear/board/shares';
import {sharesForRequest} from '@/lib/bear/server/robot-shares';
import {completeTask} from '@/lib/bear/services/completion';
import {pushToSender} from '@/lib/bear/server/share-push';
import {ensureProfile} from '@/lib/bear/services/profile';
import {dueReminders} from '@/lib/bear/services/reminders';
export const dynamic='force-dynamic';
// The Brain Dump Board: everything she has unloaded, her lists, and anything worth knowing about what she shared.
export const GET=(req:Request)=>withBear(req,async({store,user,aiAvailable})=>{
 let profile=await ensureProfile(store);if(!profile.name&&user.name)profile=await store.update('profiles',profile.id,{name:user.name});
 if(!profile.onboardingComplete)return json({onboarding:true});
 let notices:{id:string;text:string}[]=[];let sharing=true;
 // Share news is a nice-to-have: it never holds the board up for more than a few seconds.
 const withinSeconds=<T,>(p:Promise<T>,ms:number)=>Promise.race([p,new Promise<never>((_,no)=>setTimeout(()=>no(new Error('slow')),ms))]);
 try{const {sent}=await withinSeconds((async()=>syncMine(store,await sharesForRequest(store),id=>completeTask(store,{taskId:id,method:'shared',evidence:'user'} as never),s=>pushToSender(s)))(),4000);notices=sent.filter(s=>!s.senderSeen).map(s=>({id:s.id,text:noticeFor(s)||''})).filter(n=>n.text);}catch{sharing=false;}
 // Reminders that are due now (the ones she asked for, or a date coming up): shown at the top and as a phone notification.
 let due:{reminderId:string;taskId:string;billId:string|null;message:string}[]=[];
 try{const now=new Date().toISOString();due=(await dueReminders(store)).filter(d=>d.reminder.scheduledFor<=now&&d.reminder.status==='scheduled').slice(0,3).map(d=>({reminderId:d.reminder.id,taskId:d.reminder.taskId,billId:d.billId,message:d.decision.message||d.taskTitle}));}catch{/* reminders never stop the board loading */}
 return json({board:await boardView(store),notices,sharing,aiAvailable,due});
});
