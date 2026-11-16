// Brain Dump Board: the redesign's premise, tested against the eight scenarios in the brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {boardView,unload,addOne,moveTask,saveLists,saveProgress,openTasks,chunksOf,ignoreSuggestion} from '../lib/bear/board/service.ts';
import {suggestList,learnChoice,pickMoments,minutesFor,readinessOf,businessOpen,STARTER_LISTS,listsOf} from '../lib/bear/board/logic.ts';
import {helpFor,mailtoFor} from '../lib/bear/board/help.ts';
import {MemoryShares,shareTask,openInvite,respond,syncMine,revoke} from '../lib/bear/board/shares.ts';
import {completeTask} from '../lib/bear/services/completion.ts';

const NOW=new Date('2026-11-16T10:00:00+11:00');// Monday 10am Sydney
const backend=new MemoryBackend();let n=0;
async function person(name='Sarah'){const id=`b0b0b0b0-0000-4000-8000-${String(++n).padStart(12,'0')}`;const s=backend.for(id);await ensureProfile(s);await saveProfile(s,{name,areas:['family'],onboardingComplete:true});return s;}
const DUMP='I need to pay the electricity bill, order school lunches, call the possum man, book the podiatrist, follow up with the builder, organise Christmas presents, fix the bathroom mould and eventually build a new chicken pen.';

test('the six starter lists, in order, with the exact names',()=>{
 assert.deepEqual(STARTER_LISTS.map(l=>`${l.icon} ${l.title}`),['🌙 Nighttime Tasks','📞 Phone Calls','🌱 Aspirational','🔄 Organise – Follow-up','✨ Organise – Time Permitting','📅 This Week/Weekend']);
});

test('a brain dump becomes separate checklist items, all in the Brain Dump, none moved into lists',async()=>{
 const s=await person();const r=await unload(s,null,{text:DUMP,via:'text'},NOW);
 assert.equal(r.added.length,8,`items: ${r.added.map(a=>a.title).join(' | ')}`);
 const b=await boardView(s,NOW);
 assert.equal(b.inbox.length,r.added.length);
 assert.ok(Object.values(b.byList).every(l=>l.length===0),'nothing auto-filed');
 const titles=b.inbox.map(t=>t.title.toLowerCase()).join(' | ');
 for(const w of ['electricity','lunches','possum','podiatrist','builder','christmas','mould','chicken'])assert.ok(titles.includes(w),`${w} in ${titles}`);
 // Bear suggests, quietly.
 const sug=Object.fromEntries(b.inbox.map(t=>[t.title.toLowerCase(),t.suggestion?.listId]));
 const find=w=>Object.entries(sug).find(([k])=>k.includes(w))?.[1];
 assert.equal(find('electricity'),'night');assert.equal(find('possum'),'calls');assert.equal(find('podiatrist'),'calls');assert.equal(find('lunches'),'night');assert.equal(find('mould'),'spare');assert.equal(find('chicken'),'aspire');assert.equal(find('builder'),'followup');assert.equal(find('christmas'),'week');
 // The original words are kept.
 const cap=await s.get('captures',r.dumpId);assert.equal(cap.text,DUMP);assert.equal(cap.status,'verified');
});

test('Scenario 1: twenty things unloaded, app closed before sorting, all still there',async()=>{
 const s=await person();const lines=Array.from({length:20},(_,i)=>`Ring plumber number ${i+1}`).join('\n');
 const r=await unload(s,null,{text:lines,via:'text'},NOW);assert.equal(r.added.length,20);
 const again=await boardView(s,NOW);assert.equal(again.inbox.length,20);
 assert.ok(chunksOf('a\n'.repeat(2000)).every(c=>c.length<=900));
});

test('Scenario 2: organising without scheduling: no dates asked for or added',async()=>{
 const s=await person();await unload(s,null,{text:'Order school lunches\nCall the physio',via:'text'},NOW);
 const b=await boardView(s,NOW);
 for(const t of b.inbox)await moveTask(s,t.id,{listId:t.title.includes('physio')?'calls':'night'},NOW);
 const after=await boardView(s,NOW);
 assert.equal(after.byList.calls.length,1);assert.equal(after.byList.night.length,1);assert.equal(after.inbox.length,0);
 assert.ok([...after.byList.calls,...after.byList.night].every(t=>t.dueAt===null));
});

test('Scenario 3: "I’ve got 10 minutes" gives at most three things that fit and can move now',async()=>{
 const s=await person();
 await unload(s,null,{text:['Reply to school email','Confirm birthday RSVP','Pay the electricity bill','Build a new chicken pen','Renovate the laundry','Call the dentist','Order school lunches'].join('\n'),via:'text'},NOW);
 const tasks=await openTasks(s);const chicken=tasks.find(t=>/chicken/i.test(t.title));await moveTask(s,chicken.id,{listId:'aspire'},NOW);
 const r=pickMoments(await openTasks(s),10,NOW,'Australia/Sydney','2026-11-16');
 assert.ok(r.picks.length>0&&r.picks.length<=3);
 assert.ok(r.picks.every(p=>p.minutes<=10),'all fit');
 assert.ok(!r.picks.some(p=>/chicken|renovate/i.test(p.title)),'no big or aspirational things');
 // At 9pm the dentist is shut: phone calls are held back, and Bear says so.
 const night=pickMoments(await openTasks(s),30,new Date('2026-11-16T21:00:00+11:00'),'Australia/Sydney','2026-11-16');
 assert.ok(!night.picks.some(p=>/call/i.test(p.title)));assert.match(night.heldBack,/phone call/);
 assert.equal(businessOpen(new Date('2026-11-15T11:00:00+11:00'),'Australia/Sydney'),false,'Sunday');
});

test('Scenario 4: an email started, app closed, the draft and next step are there on return',async()=>{
 const s=await person();const t=await addOne(s,{title:'Email the school about the excursion',listId:null},NOW);
 await saveProgress(s,t.id,{draft:{to:'office@school.edu.au',subject:'Excursion',body:'Hi, Mia will'},nextAction:'Finish the second paragraph'},NOW);
 const b=await boardView(s,NOW);
 assert.equal(b.resume.taskId,t.id);assert.equal(b.resume.next,'Finish the second paragraph');
 const back=await s.get('tasks',t.id);assert.equal(back.progress.draft.body,'Hi, Mia will');assert.equal(readinessOf(back),'in_progress');
});

test('Scenario 5: transfer responsibility: ownership moves only on acceptance, and follow-ups go to him',async()=>{
 const sarah=await person('Sarah');const james=await person('James');
 const t=await addOne(sarah,{title:'Organise the holiday',listId:'week'},NOW);
 const {share,link}=await shareTask(sarah,new MemoryShares(sarah.userId),'Sarah',t.id,{mode:'transfer',toName:'James',note:null});
 const token=link.split('/').pop();
 // Before he answers, it is still hers and still on her list.
 assert.equal((await boardView(sarah,NOW)).byList.week.length,1);
 const seen=await openInvite(new MemoryShares(james.userId),token);assert.equal(seen.title,'Organise the holiday');assert.equal(seen.senderName,'Sarah');
 // Nobody else can use the same link once he has it.
 const third=await person('Mallory');await assert.rejects(openInvite(new MemoryShares(third.userId),token));
 const r=await respond(james,new MemoryShares(james.userId),share.id,{answer:'accept',message:null},title=>addOne(james,{title,listId:null},NOW));
 assert.equal(r.status,'accepted');
 const his=await james.get('tasks',r.recipientTaskId);assert.equal(his.title,'Organise the holiday');assert.equal(his.sharedIn.from,'Sarah');
 await syncMine(sarah,new MemoryShares(sarah.userId),id=>completeTask(sarah,{taskId:id,method:'shared',evidence:'user'},NOW));
 const hers=await sarah.get('tasks',t.id);assert.equal(hers.readiness,'waiting');
 assert.equal((await boardView(sarah,NOW)).byList.week.length,0,'off her lists');
 // He finishes it; she doesn't have to chase.
 await completeTask(james,{taskId:his.id,method:null},NOW);
 await syncMine(james,new MemoryShares(james.userId),async()=>{});
 await syncMine(sarah,new MemoryShares(sarah.userId),id=>completeTask(sarah,{taskId:id,method:'shared',evidence:'user'},NOW));
 assert.equal((await sarah.get('tasks',t.id)).status,'done');
 // Her other tasks stay private.
 await addOne(sarah,{title:'Private thing',listId:null},NOW);
 assert.ok(!(await openTasks(james)).some(x=>x.title==='Private thing'));
});

test('Share: declining hands it back; taking it back removes it from his list',async()=>{
 const a=await person('Sarah');const b=await person('James');
 const t=await addOne(a,{title:'Book the car service',listId:null},NOW);
 const s1=await shareTask(a,new MemoryShares(a.userId),'Sarah',t.id,{mode:'action',toName:'James',note:null});
 await openInvite(new MemoryShares(b.userId),s1.link.split('/').pop());
 const r=await respond(b,new MemoryShares(b.userId),s1.share.id,{answer:'accept',message:null},title=>addOne(b,{title,listId:null},NOW));
 await revoke(a,new MemoryShares(a.userId),s1.share.id);
 await syncMine(b,new MemoryShares(b.userId),async()=>{});
 assert.equal((await b.get('tasks',r.recipientTaskId)).status,'dropped');
 const t2=await addOne(a,{title:'Sort the photos',listId:null},NOW);
 const s2=await shareTask(a,new MemoryShares(a.userId),'Sarah',t2.id,{mode:'action',toName:'James',note:null});
 await openInvite(new MemoryShares(b.userId),s2.link.split('/').pop());
 await respond(b,new MemoryShares(b.userId),s2.share.id,{answer:'decline',message:'Away that week'},async()=>{throw new Error('no task on decline');});
 const {sent}=await syncMine(a,new MemoryShares(a.userId),async()=>{});
 const back=sent.find(x=>x.id===s2.share.id);assert.equal(back.status,'declined');assert.equal(back.messages[0].text,'Away that week');
});

test('Scenario 6: Aspirational: no deadline and no reminders',async()=>{
 const s=await person();const t=await addOne(s,{title:'Build a new chicken pen',listId:null},NOW);
 await moveTask(s,t.id,{listId:'aspire'},NOW);
 const back=await s.get('tasks',t.id);assert.equal(back.dueAt,null);
 const live=(await s.list('reminders',{where:[{column:'task_id',value:t.id}]})).filter(r=>['scheduled','snoozed'].includes(r.status));assert.equal(live.length,0);
 // Even one with a date stops being chased once it is a dream.
 const d=await addOne(s,{title:'Renovate the kitchen by 20 December',listId:null},NOW);
 await moveTask(s,d.id,{listId:'aspire'},NOW);
 assert.equal((await s.list('reminders',{where:[{column:'task_id',value:d.id}]})).filter(r=>['scheduled','snoozed'].includes(r.status)).length,0);
});

test('Scenario 7: her correction is recorded and later suggestions follow it; her choice always wins',async()=>{
 const s=await person();
 const lists=listsOf(await ensureProfile(s));
 assert.equal(suggestList('School excursion permission form for the weekend',lists,[])?.listId,'week');
 const t=await addOne(s,{title:'School excursion permission form for the weekend',listId:null},NOW);
 await moveTask(s,t.id,{listId:'night'},NOW);
 const p=await ensureProfile(s);assert.ok(p.listLearning.some(l=>l.word==='permission'&&l.listId==='night'));
 const next=suggestList('Sign the school permission slip',lists,p.listLearning);assert.deepEqual(next,{listId:'night',by:'learned'});
 // A single shared word is not enough to claim a preference.
 assert.notEqual(suggestList('School concert this weekend',lists,learnChoice([],'Pay school fees','night','2026-11-16'))?.by,'learned');
 // Ignoring leaves it in the Brain Dump with no suggestion shown.
 const u=await addOne(s,{title:'Pay the water bill',listId:null},NOW);await ignoreSuggestion(s,u.id);
 const b=await boardView(s,NOW);const row=b.inbox.find(x=>x.id===u.id);assert.equal(row.suggestion,null);assert.equal(row.listId,null);
});

test('Scenario 8: no AI at all: create, edit, organise all still work',async()=>{
 const s=await person();const r=await unload(s,null,{text:'Pay rego\nCall Mum',via:'text'},NOW);assert.equal(r.usedAI,false);assert.equal(r.added.length,2);
 const failing={extract:async()=>{throw new Error('down');}};
 const r2=await unload(s,failing,{text:'Return the library books and also email the swimming coach about Thursday',via:'text'},NOW);assert.ok(r2.added.length>=1,'falls back to Bear’s own reading');
 const t=await addOne(s,{title:'Buy birthday card',listId:'week'},NOW);
 await moveTask(s,t.id,{listId:null},NOW);
 assert.ok((await boardView(s,NOW)).inbox.some(x=>x.id===t.id));
});

test('lists: rename, add, reorder; deleting a list never deletes its tasks',async()=>{
 const s=await person();const t=await addOne(s,{title:'Call the vet',listId:'calls'},NOW);
 const cur=listsOf(await ensureProfile(s));
 const next=[{id:'new',title:'Garden',icon:'🌱'},...cur.filter(l=>l.id!=='calls').map(l=>l.id==='night'?{...l,title:'After bedtime'}:l)].map(({id,title,icon})=>({id,title,icon}));
 const r=await saveLists(s,{lists:next});assert.equal(r.returned,1);assert.equal(r.lists[0].title,'Garden');assert.ok(r.lists.some(l=>l.title==='After bedtime'));
 const back=await s.get('tasks',t.id);assert.equal(back.status,'open');assert.equal(back.listId,null);
 assert.ok((await boardView(s,NOW)).inbox.some(x=>x.id===t.id));
});

test('reordering within a list keeps her order',async()=>{
 const s=await person();const a=await addOne(s,{title:'One',listId:'night'},NOW);const b=await addOne(s,{title:'Two',listId:'night'},NOW);const c=await addOne(s,{title:'Three',listId:'night'},NOW);
 await moveTask(s,c.id,{listId:'night',index:0},NOW);
 assert.deepEqual((await boardView(s,NOW)).byList.night.map(t=>t.title),['Three','One','Two']);void a;void b;
});

test('told twice: shown as already here, never silently merged or duplicated',async()=>{
 const s=await person();await unload(s,null,{text:'Pay the electricity bill',via:'text'},NOW);
 const r=await unload(s,null,{text:'Pay the electricity bill\nBook the podiatrist',via:'text'},NOW);
 assert.equal(r.already.length,1);assert.equal(r.added.length,1);
});

test('Bear Helps prepares, never sends: drafts open in her own apps',()=>{
 const base={id:'t',title:'Follow up with the builder',estimatedMinutes:15,status:'open'};
 const f=helpFor(base,null,'Sarah');assert.equal(f.kind,'followup');assert.match(f.draft.body,/following up/i);assert.match(f.draft.body,/Sarah/);
 const c=helpFor({...base,title:'Call the possum removal service'},null,'');assert.equal(c.kind,'call');assert.match(c.searchFor,/possum removal service/);
 const h=helpFor({...base,title:'Organise the holiday'},null,'');assert.equal(h.kind,'steps');assert.ok(h.steps.length>=4);
 assert.match(mailtoFor({to:'a@b.c',subject:'Hi there',body:'Line 1\nLine 2'}),/^mailto:a%40b\.c\?subject=Hi%20there&body=Line%201%0ALine%202$/);
 assert.equal(minutesFor({title:'Confirm birthday RSVP',estimatedMinutes:15}),2);
 assert.equal(minutesFor({title:'Confirm birthday RSVP',estimatedMinutes:7,minutesBy:'you'}),7);
});

test('existing tasks from before the redesign show in My Brain Dump with a quiet suggestion, and can be ignored',async()=>{
 const s=await person();const t=await addOne(s,{title:'Call the plumber',listId:null},NOW);
 await s.update('tasks',t.id,{suggestion:undefined,listId:undefined,rank:undefined});// as an older task would be stored
 let row=(await boardView(s,NOW)).inbox.find(x=>x.id===t.id);assert.deepEqual(row.suggestion,{listId:'calls',by:'bear'});
 await ignoreSuggestion(s,t.id);row=(await boardView(s,NOW)).inbox.find(x=>x.id===t.id);assert.equal(row.suggestion,null);
});

// ---------- Household, AI drafts, quiet hours, time estimates ----------
import {saveHousehold} from '../lib/bear/board/household.ts';
import {writeDraft,checkDraft,DAILY_DRAFTS} from '../lib/bear/board/draft.ts';
import {inQuietHours} from '../lib/bear/board/logic.ts';
import {setDetails} from '../lib/bear/board/service.ts';

test('household: sharing remembers the person; details are optional and validated; a ✓ appears once they accept',async()=>{
 const a=await person('Sarah');const b=await person('James');
 const t=await addOne(a,{title:'Book the car service',listId:null},NOW);
 const {share,link}=await shareTask(a,new MemoryShares(a.userId),'Sarah',t.id,{mode:'action',toName:'James',note:null});
 let hh=(await ensureProfile(a)).household;assert.deepEqual(hh.map(h=>h.name),['James']);assert.equal(hh[0].email,null);
 // Sharing with him again doesn't add him twice.
 const t2=await addOne(a,{title:'Sort the recycling',listId:null},NOW);await shareTask(a,new MemoryShares(a.userId),'Sarah',t2.id,{mode:'info',toName:'james',note:null});
 assert.equal((await ensureProfile(a)).household.length,1);
 const saved=await saveHousehold(a,{people:[{id:hh[0].id,name:'James',email:'james@example.com',phone:'0412 345 678'},{id:'new',name:'Mum',email:'',phone:''},{id:'new',name:'mum',email:'',phone:''}]});
 assert.deepEqual(saved.map(h=>h.name),['James','Mum'],'no duplicate names');assert.equal(saved[0].email,'james@example.com');assert.equal(saved[1].email,null);
 const {householdSchema}=await import('../lib/bear/board/household.ts');
 assert.throws(()=>householdSchema.parse({people:[{id:'new',name:'X',email:'not-an-email',phone:''}]}));
 await openInvite(new MemoryShares(b.userId),link.split('/').pop());
 await respond(b,new MemoryShares(b.userId),share.id,{answer:'accept',message:null},title=>addOne(b,{title,listId:null},NOW));
 await syncMine(a,new MemoryShares(a.userId),async()=>{});
 hh=(await ensureProfile(a)).household;assert.equal(hh.find(h=>h.name==='James').joined,true);
 // Saving the list again keeps the ✓.
 assert.equal((await saveHousehold(a,{people:hh.map(({id,name,email,phone})=>({id,name,email,phone}))})).find(h=>h.name==='James').joined,true);
});

test('the sender is told when the other person finishes it (the push hook fires once, with the finished share)',async()=>{
 const a=await person('Sarah');const b=await person('James');
 const t=await addOne(a,{title:'Pick up the dry cleaning',listId:null},NOW);
 const {share,link}=await shareTask(a,new MemoryShares(a.userId),'Sarah',t.id,{mode:'action',toName:'James',note:null});
 await openInvite(new MemoryShares(b.userId),link.split('/').pop());
 const r=await respond(b,new MemoryShares(b.userId),share.id,{answer:'accept',message:null},title=>addOne(b,{title,listId:null},NOW));
 await completeTask(b,{taskId:r.recipientTaskId,method:null},NOW);
 const told=[];await syncMine(b,new MemoryShares(b.userId),async()=>{},async s=>{told.push(s.status);});
 await syncMine(b,new MemoryShares(b.userId),async()=>{},async s=>{told.push(s.status);});
 assert.deepEqual(told,['done'],'once');
});

test('quiet hours: overnight and same-day ranges, in her own time zone',()=>{
 const night={quietStartMinute:21*60,quietEndMinute:7*60};
 assert.equal(inQuietHours(night,new Date('2026-11-16T22:30:00+11:00'),'Australia/Sydney'),true);
 assert.equal(inQuietHours(night,new Date('2026-11-16T06:59:00+11:00'),'Australia/Sydney'),true);
 assert.equal(inQuietHours(night,new Date('2026-11-16T12:00:00+11:00'),'Australia/Sydney'),false);
 assert.equal(inQuietHours({quietStartMinute:13*60,quietEndMinute:15*60},new Date('2026-11-16T14:00:00+11:00'),'Australia/Sydney'),true);
 assert.equal(inQuietHours(night,new Date('2026-11-16T12:00:00Z'),'Australia/Sydney'),true,'12:00 UTC is 11pm in Sydney');
});

test('AI drafts: uses only what she gave; invented addresses are dropped; limits and failures leave her draft alone',async()=>{
 const given='Task: Follow up with the builder\n\nNotes: Dave, dave@builds.com.au, quote for the deck';
 assert.deepEqual(checkDraft({to:'dave@builds.com.au',subject:'Deck quote',body:'Hi Dave'},given,'followup'),{to:'dave@builds.com.au',subject:'Deck quote',body:'Hi Dave'});
 assert.equal(checkDraft({to:'someone@else.com',subject:'x',body:'Hi'},given,'email').to,'','an address she never gave is dropped');
 assert.equal(checkDraft({to:'',subject:'Should go',body:'Running late'},given,'message').subject,'','texts have no subject');
 assert.equal(checkDraft({to:'',subject:'x'},given,'email'),null);
 const s=await person('Sarah');const t=await addOne(s,{title:'Follow up with the builder',listId:null},NOW);await s.update('tasks',t.id,{notes:'Dave, dave@builds.com.au'});
 let seen=null;const fake={name:'fake',model:'fake-1',supportsVision:false,extract:async i=>{seen=i;return {output:{to:'dave@builds.com.au',subject:'Following up on the deck quote',body:'Hi Dave,\n\nJust checking in on the quote for the deck. Could you let me know when it might be ready?\n\nSarah'},raw:{},provider:'fake',model:'fake-1',latencyMs:5};}};
 const d=await writeDraft(s,fake,await s.get('tasks',t.id),'Sarah',{ask:'mention the deck',current:null,kind:'followup'},NOW);
 assert.equal(d.to,'dave@builds.com.au');assert.match(d.body,/deck/);assert.match(seen.system,/Never invent/);assert.match(seen.text,/mention the deck/);assert.match(seen.system,/Australian English/);
 await assert.rejects(writeDraft(s,null,t,'Sarah',{ask:null,current:null,kind:'email'},NOW),/isn’t connected/);
 await assert.rejects(writeDraft(s,{...fake,extract:async()=>{throw new Error('overloaded');}},t,'Sarah',{ask:null,current:null,kind:'email'},NOW),/couldn’t write that just now/);
 for(let i=0;i<DAILY_DRAFTS;i++)await s.insert('ai_inferences',{id:crypto.randomUUID(),userId:s.userId,createdAt:NOW.toISOString(),updatedAt:NOW.toISOString(),captureId:null,service:'Draft',provider:'fake',model:'f',promptHash:'d',rawOutput:null,latencyMs:1,ok:true,error:null});
 await assert.rejects(writeDraft(s,fake,t,'Sarah',{ask:null,current:null,kind:'email'},NOW),/a lot of drafting/);
});

test('her own time estimate wins, and can be handed back to Bear',async()=>{
 const s=await person();const t=await addOne(s,{title:'Call the dentist',listId:null},NOW);
 assert.equal(minutesFor(await s.get('tasks',t.id)),10);
 await setDetails(s,t.id,{minutes:25});assert.equal(minutesFor(await s.get('tasks',t.id)),25);
 assert.equal(pickMoments([await s.get('tasks',t.id)],20,NOW,'Australia/Sydney','2026-11-16').picks.length,0,'no longer fits 20 minutes');
 await setDetails(s,t.id,{minutes:null});assert.equal(minutesFor(await s.get('tasks',t.id)),10);
});

test('share rules hold whatever the storage: only the sender takes it back, only the recipient answers, strangers see nothing, one claim per link',async()=>{
 const {KvShares,memoryShareRows,checkChange}=await import('../lib/bear/board/shares.ts');
 const a=await person('Sarah');const b=await person('James');const c=await person('Mallory');
 const t=await addOne(a,{title:'Renew the rego',listId:null},NOW);
 const {share,link}=await shareTask(a,new MemoryShares(a.userId),'Sarah',t.id,{mode:'transfer',toName:'James',note:null});
 const token=link.split('/').pop();
 assert.equal(await new MemoryShares(c.userId).get(share.id),null,'a stranger can’t see it');
 await openInvite(new MemoryShares(b.userId),token);
 const asB=new MemoryShares(b.userId),asA=new MemoryShares(a.userId);
 const cur=await asB.get(share.id);
 await assert.rejects(asB.save({...cur,status:'revoked'}),/Only the person who shared it/);
 await assert.rejects(asA.save({...cur,status:'accepted'}),/Only the person it was shared with/);
 await assert.rejects(asA.save({...cur,recipientId:c.userId}),/Not allowed/);
 await assert.rejects(asB.save({...cur,mode:'info'}),/Not allowed/);
 await assert.rejects(new MemoryShares(c.userId).save({...cur,status:'accepted'}),/Not found/);
 const ok=await asB.save({...cur,status:'accepted'});assert.equal(ok.status,'accepted');
 // Two people opening the same link at the same moment: only one becomes the recipient.
 const rows=memoryShareRows();const t2=await addOne(a,{title:'Book the vet',listId:null},NOW);
 const s2=await shareTask(a,new KvShares(a.userId,rows),'Sarah',t2.id,{mode:'action',toName:'James',note:null});
 const {hashToken}=await import('../lib/bear/board/shares.ts');const h=await hashToken(s2.link.split('/').pop());
 const [x,y]=await Promise.all([new KvShares(b.userId,rows).claim(h),new KvShares(c.userId,rows).claim(h)]);
 assert.equal([x,y].filter(Boolean).length,1,'exactly one claim wins');
 assert.throws(()=>checkChange({...cur,status:'revoked'},{...cur,status:'accepted'},b.userId),/taken back/);
});

test('one odd old record never stops the board loading',async()=>{
 const s=await person();const good=await addOne(s,{title:'Pay the water bill',listId:null},NOW);
 const odd=await addOne(s,{title:'Odd one',listId:null},NOW);
 await s.update('tasks',odd.id,{title:null,createdAt:undefined,progress:{draft:null},suggestion:'night',light:'red'});
 const b=await boardView(s,NOW);
 assert.ok(b.inbox.some(t=>t.id===good.id));const row=b.inbox.find(t=>t.id===odd.id);assert.ok(row,'still shown');assert.equal(typeof row.title,'string');
});
