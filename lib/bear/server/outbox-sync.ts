import 'server-only';
import type {BearStore} from '@/lib/bear/store/store';
import {buildOutbox} from '@/lib/bear/services/outbox';
import {pushConfig} from './push';
import {loadOutbox,removeOutbox,robot,saveOutbox} from './outbox-robot';
// Keeps one person's delivery outbox in step with their data. Runs after they change something or open the main screen.
// Never throws: a problem here must not break what the person was doing (they still see reminders in the app).
export async function syncOutbox(store:BearStore){
 try{
  if(!pushConfig()||!(await robot()))return;
  const box=await buildOutbox(store,await loadOutbox(store.userId));
  if(box)await saveOutbox(box);else await removeOutbox(store.userId);
 }catch{/* in-app reminders still work */}
}
