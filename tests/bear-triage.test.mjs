// Triage: email cleaning, the strict schema (reasoning first), the checks on every card, and the pipeline end to end.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {cleanEmailInput,looksLikeEmail,triageJsonSchema,checkTriage,anchorsFor,triageSystemPrompt} from '../lib/bear/services/triage-core.ts';
import {triage,TriageError} from '../lib/bear/services/triage-service.ts';
import {structuredOutputSchema} from '../lib/bear/ai/schema-subset.ts';

const TODAY='2026-11-16';const NOW=new Date('2026-11-16T09:30:00+11:00');   // a Monday in Sydney
const SCHOOL_EMAIL=`<html><head><style>.x{color:red} body{font-family:Arial}</style><title>Newsletter</title></head><body>
<div class="x">Dear Year 3 families,</div><p>Our <b>Year&nbsp;3 excursion</b> to Taronga Zoo is on <strong>Friday 20 November</strong>.</p>
<ul><li>Permission note &amp; $25 due <em>Wednesday</em></li><li>Wear full sports uniform &amp; a hat</li><li>Bring a packed lunch (nut free, please)</li></ul>
<p>Thanks,<br>Mrs Lee</p><img src="https://track.example/open.gif?u=123" width="1" height="1" alt=""><!-- tracking -->
<p>Sent from my iPhone</p>
<div>On Mon, 9 Nov 2026 at 8:02 am, Office &lt;office@school.example&gt; wrote:</div><blockquote>Last week's note about the swimming carnival on 12 November…</blockquote></body></html>`;
const FORWARDED=`FYI for Ava\n\n---------- Forwarded message ---------\nFrom: Eastside Soccer <club@soccer.example>\nDate: Sun, 15 Nov 2026 at 6:10 pm\nSubject: Presentation night\nTo: parents@soccer.example\n\nHi all,\nPresentation night is Saturday 28 November, 5pm at the clubhouse. Please RSVP by Thursday.\n\nOn Sat, 14 Nov 2026, Coach wrote:\n> old stuff\n> more old stuff`;

test('cleanEmailInput: HTML, CSS, tracking pixels, signatures and quoted history go; the message and its lists stay',()=>{
 const c=cleanEmailInput(SCHOOL_EMAIL);
 assert.ok(!/<|>|\{|color:|font-family|track\.example|open\.gif/.test(c),c);
 assert.ok(c.includes('Year 3 excursion to Taronga Zoo is on Friday 20 November'));assert.ok(c.includes('- Permission note & $25 due Wednesday'),c);
 assert.ok(c.includes('- Wear full sports uniform & a hat')&&c.includes('nut free'));assert.ok(c.includes('Mrs Lee'));
 assert.ok(!/swimming carnival|Sent from my iPhone|wrote:/.test(c),'quoted history and phone signatures are cut');
 assert.ok(!/\n{3,}/.test(c),'no runs of blank lines');
});
test('cleanEmailInput: a forward keeps the forwarded message and the person’s note, not the forward headers or older replies',()=>{
 const c=cleanEmailInput(FORWARDED);
 assert.ok(c.startsWith('FYI for Ava'));assert.ok(c.includes('Presentation night is Saturday 28 November, 5pm'));
 assert.ok(!/Forwarded message|^From:|^Subject:|club@soccer/m.test(c),c);assert.ok(!/old stuff|Coach wrote/.test(c));
 assert.equal(cleanEmailInput('Pay the water bill by Friday.\n\nThanks'),'Pay the water bill by Friday.\n\nThanks','plain text is left as it is');
 assert.ok(looksLikeEmail(SCHOOL_EMAIL)&&looksLikeEmail(FORWARDED)&&!looksLikeEmail('buy milk'));
});

test('the schema: reasoning comes first, and every object is closed with every property required',()=>{
 assert.equal(Object.keys(triageJsonSchema.properties)[0],'reasoning_scratchpad');
 const walk=(n,path)=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach((x,i)=>walk(x,path+'['+i+']'));return;}
  if(n.type==='object'&&n.properties){assert.equal(n.additionalProperties,false,path);assert.deepEqual([...n.required].sort(),Object.keys(n.properties).sort(),path);}
  for(const [k,v] of Object.entries(n))walk(v,path+'.'+k);};
 walk(triageJsonSchema,'root');
 const wire=structuredOutputSchema(triageJsonSchema);assert.equal(Object.keys(wire.properties)[0],'reasoning_scratchpad','still first on the wire');
});

const card=o=>({card_id:'c1',family_member:'Ava',action_type:'form',urgency:'amber',hard_deadline:'2026-11-18',card_headline:'Return Ava’s zoo excursion permission note and $25',ai_work_completed:'Listed the steps and what to pack.',
 execution_payload:{email:null,sms:null,calendar_hold:{title:'Year 3 zoo excursion',start:'2026-11-20',end:null,all_day:true,location:'Taronga Zoo'},shopping_list:['Packed lunch (nut free)','Hat'],steps:['Sign the permission note','Put $25 in an envelope','Hand both to Mrs Lee by Wednesday']},
 confidence_score:0.92,missing_blocker:null,...o});
const SCHOOL_OUT={reasoning_scratchpad:'School newsletter from Mrs Lee (Year 3). "Friday 20 November" resolves to 2026-11-20. "Wednesday" before it is 2026-11-18. Year 3 = Ava (profile). Implicit: $25, sports uniform, hat, nut-free lunch.',source_summary:'Year 3 excursion note from Mrs Lee.',action_cards:[card({})]};
const FLYER_OUT={reasoning_scratchpad:'Club flyer. Presentation night Saturday 28 November 5pm = 2026-11-28T17:00. RSVP by Thursday = 2026-11-19. Soccer is Sam’s (profile notes).',source_summary:'Eastside Soccer presentation night.',action_cards:[
 card({card_id:'r1',family_member:'Sam',action_type:'email_reply',urgency:'amber',hard_deadline:'2026-11-19',card_headline:'RSVP for Sam’s soccer presentation night',ai_work_completed:'Drafted an RSVP to the club.',execution_payload:{email:{to:'club@soccer.example',subject:'RSVP: Presentation night',body:'Hi, Sam will be there with two adults. Thanks!'},sms:null,calendar_hold:null,shopping_list:null,steps:null}}),
 card({card_id:'r2',family_member:'Sam',action_type:'calendar_hold',urgency:'green',hard_deadline:null,card_headline:'Hold Saturday evening for presentation night',ai_work_completed:'Prepared a calendar hold.',execution_payload:{email:null,sms:null,calendar_hold:{title:'Soccer presentation night',start:'2026-11-28T17:00',end:'2026-11-28T19:00',all_day:false,location:'Clubhouse'},shopping_list:null,steps:null}})]};
test('sample outputs for a messy school email and a club flyer pass the schema and the checks',()=>{
 for(const out of [SCHOOL_OUT,FLYER_OUT]){const r=checkTriage(out,TODAY,['Ava','Sam']);assert.ok(r.ok,r.error);assert.ok(r.cards.every(c=>!c.problems.length),JSON.stringify(r.cards.map(c=>c.problems)));}
});
test('the checks: invented people, impossible dates and bad calendar times are not believed; bad shapes are refused',()=>{
 const one=o=>checkTriage({...SCHOOL_OUT,action_cards:[card(o)]},TODAY,['Ava','Sam']);
 const ghost=one({family_member:'Oliver'});assert.equal(ghost.cards[0].family_member,null);assert.ok(ghost.cards[0].problems.length);
 assert.equal(one({family_member:'ava'}).cards[0].family_member,'Ava');assert.equal(one({family_member:'Ava & Sam'}).cards[0].family_member,'Ava');
 for(const d of ['2026-02-30','Wednesday','2024-01-01','2030-01-01']){const r=one({hard_deadline:d});assert.equal(r.cards[0].hard_deadline,null,d);assert.ok(r.cards[0].missing_blocker,'a missing date becomes the one question');}
 assert.equal(one({hard_deadline:'2026-11-18T15:00'}).cards[0].hard_deadline,'2026-11-18');
 assert.equal(one({execution_payload:{...card({}).execution_payload,calendar_hold:{title:'x',start:'next Friday',end:null,all_day:true,location:null}}}).cards[0].execution_payload.calendar_hold,null);
 assert.equal(checkTriage({...SCHOOL_OUT,action_cards:[card({urgency:'purple'})]},TODAY,[]).ok,false);
 assert.equal(checkTriage({source_summary:'x',action_cards:[]},TODAY,[]).ok,false,'no reasoning: refused');
 assert.equal(checkTriage({...SCHOOL_OUT,action_cards:[{...card({}),extra:1}]},TODAY,[]).ok,false,'unexpected fields: refused');
 assert.equal(checkTriage({...SCHOOL_OUT,action_cards:[card({confidence_score:1.4})]},TODAY,[]).ok,false);
});

async function person(){const s=new MemoryBackend().for('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');await ensureProfile(s);
 await saveProfile(s,{name:'Govind Smith',areas:['family'],onboardingComplete:true,family:[{name:'Ava',relation:'child',age:8,yearLevel:'Year 3',school:'Eastside Public',allergies:'peanuts',notes:null},{name:'Sam',relation:'child',age:11,yearLevel:'Year 6',school:'Eastside Public',allergies:null,notes:'Eastside Soccer, under 12s'}]});return s;}
test('the prompt is anchored to the exact local day and the saved family',()=>{
 const p=triageSystemPrompt(anchorsFor(NOW,'Australia/Sydney',[{name:'Ava',relation:'child',age:8,yearLevel:'Year 3',school:'Eastside Public',allergies:'peanuts',notes:null}],'Govind'));
 assert.match(p,/Today is Monday 2026-11-16, 09:30 local time \(Australia\/Sydney\)/);assert.match(p,/Ava \(child, age 8, Year 3, Eastside Public; allergies: peanuts\)/);assert.match(p,/The parent is Govind/);
 assert.match(p,/Fill reasoning_scratchpad first/);assert.ok(!/step by step|think/i.test(p+JSON.stringify(triageJsonSchema)),'no wording that asks the model to reveal its own thinking');assert.match(p,/Never claim you have sent, booked, paid or submitted/);
});
test('triage end to end: raw pictures and a cleaned email go in; tasks with drafts attached come out; nothing is sent',async()=>{
 const s=await person();const provider=new FakeProvider(()=>FLYER_OUT);const png=new Uint8Array([0x89,0x50,0x4e,0x47,1,2,3]);
 const r=await triage(s,provider,{images:[{mime:'image/png',bytes:png}],documents:[],text:FORWARDED},NOW);
 const call=provider.calls[0];assert.equal(call.images[0].bytes,png,'the picture itself is sent, not text read out of it');
 assert.ok(!/Forwarded message|old stuff/.test(call.text),'the email is cleaned before it is sent');assert.match(call.system,/Sam \(child, age 11, Year 6/);
 assert.equal(r.cards.length,2);assert.match(r.reasoning,/^Club flyer/);
 const rsvp=r.cards.find(c=>c.card_id==='r1');assert.equal(rsvp.area,'family');assert.equal(rsvp.hard_deadline,'2026-11-19');assert.ok(rsvp.taskId);
 const task=await s.get('tasks',rsvp.taskId);assert.equal(task.dueAt,'2026-11-19');assert.equal(task.prepared.payload.email.to,'club@soccer.example');assert.equal(task.status,'open','prepared, not done');
 const log=(await s.list('ai_inferences')).filter(i=>i.service==='Triage');assert.equal(log.length,1);assert.ok(!JSON.stringify(log[0].rawOutput).includes('Sam'),'the log holds counts, not content');
 const again=await triage(s,new FakeProvider(()=>FLYER_OUT),{images:[],documents:[],text:FORWARDED},NOW);assert.ok(again.cards.every(c=>c.already),'the same email twice is not two sets of tasks');
});
test('triage says plainly when it cannot run, and when the answer does not hold together',async()=>{
 const s=await person();
 await assert.rejects(()=>triage(s,null,{images:[],documents:[],text:'x'},NOW),e=>e instanceof TriageError&&e.code==='missing_key'&&e.status===503);
 await assert.rejects(()=>triage(s,new FakeProvider(()=>({nonsense:true})),{images:[],documents:[],text:'hello'},NOW),e=>e instanceof TriageError&&e.code==='invalid_output');
 const {ProviderError}=await import('../lib/bear/ai/provider.ts');
 await assert.rejects(()=>triage(s,new FakeProvider(()=>new ProviderError('The AI service is busy.','rate_limited')),{images:[],documents:[],text:'hello'},NOW),e=>e instanceof TriageError&&e.code==='upstream'&&/busy/.test(e.message));
 await assert.rejects(()=>triage(s,new FakeProvider(()=>SCHOOL_OUT),{images:[],documents:[],text:'  '},NOW),e=>e.code==='empty');
});
