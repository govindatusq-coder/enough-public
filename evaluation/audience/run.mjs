// Synthetic audience test. Usage: node evaluation/audience/run.mjs
// 12 invented households, each with a generated inbox and KNOWN correct answers, scored on the measures that can be
// measured today. Deterministic (seeded): no model calls, no real data.
// HONESTY: the email templates and the decision rules were written by the same team, so scores here are
// optimistic. Offers: the person answers once per group and Bear remembers (sensitive groups are asked every time). What this is good for: (1) persona-dependent relevance, (2) questions-per-100-emails (user burden),
// (3) a repeatable harness that can take real inboxes later.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide} from '../../lib/bear/engine/decide.ts';
import {decideFor,offerGroup} from '../../lib/bear/engine/offers.ts';
import {extractResponsibilities} from '../../lib/bear/engine/extract.ts';
const here=dirname(fileURLToPath(import.meta.url));
const TODAY='2026-11-10';
// ---- seeded random ----
let seed=20261110;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
const pick=(a)=>a[Math.floor(rnd()*a.length)];
// ---- dates ----
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function when(){const d=new Date(Date.UTC(2026,10,10+3+Math.floor(rnd()*35)));const w=DAYS[d.getUTCDay()],n=d.getUTCDate(),m=MONTHS[d.getUTCMonth()],y=d.getUTCFullYear();
 return {words:`${w} ${n} ${m}`,short:`${n} ${m}`,numeric:`${String(n).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${y}`,day:w};}
const amt=()=>(20+Math.floor(rnd()*480))+'.'+String(Math.floor(rnd()*100)).padStart(2,'0');
const D=()=>{const x=when();return pick([x.words,x.short,x.numeric]);};
// ---- personas ----
const P=[
 {id:'P01',who:'sole parent, two kids',child:true,car:true,work:false,eligible:{}},
 {id:'P02',who:'academic with one child',child:true,car:true,work:true,eligible:{staff:true}},
 {id:'P03',who:'retiree',child:false,car:true,work:false,eligible:{seniors:true}},
 {id:'P04',who:'renting student, part-time job',child:false,car:false,work:true,eligible:{students:true}},
 {id:'P05',who:'couple with three kids',child:true,car:true,work:true,eligible:{}},
 {id:'P06',who:'shift worker, one child, no car',child:true,car:false,work:true,eligible:{}},
 {id:'P07',who:'small business owner, two kids',child:true,car:true,work:true,eligible:{}},
 {id:'P08',who:'grandparent carer',child:true,car:true,work:false,eligible:{seniors:true}},
 {id:'P09',who:'new migrant family, two kids',child:true,car:false,work:false,eligible:{hardship:true}},
 {id:'P10',who:'fly-in fly-out worker, one child',child:true,car:true,work:true,eligible:{}},
 {id:'P11',who:'postgraduate researcher',child:false,car:false,work:true,eligible:{students:true,staff:true}},
 {id:'P12',who:'teacher with two kids',child:true,car:true,work:true,eligible:{staff:true}},
];
// ---- email families: text variants and the correct answer for a given persona ----
const FORMS=['excursion consent','medical','photo permission','swimming carnival'],EVENTS=['Year 5 camp','book fair','swimming carnival','school disco'],UTIL=['electricity','gas','water','internet'];
const FAM=[
 {f:'bill_due',w:5,need:()=>true,label:()=>'ACT',text:()=>pick([`Your ${pick(UTIL)} bill of $${amt()} is due on ${D()}.`,`Payment of $${amt()} for your ${pick(UTIL)} account is due by ${D()}.`,`Reminder: your ${pick(UTIL)} bill is overdue. Please pay $${amt()} by ${D()}.`]),deadline:true},
 {f:'rego',w:2,need:p=>p.car,label:()=>'ACT',text:()=>pick([`Your vehicle registration expires on ${D()}. Renew online to avoid a fine.`,`Don't forget to renew your car registration before ${D()}.`]),deadline:true},
 {f:'school_form',w:4,need:p=>p.child,label:()=>'ACT',text:()=>pick([`Please return the ${pick(FORMS)} form by ${D()}.`,`Could you sign and return the ${pick(FORMS)} form by ${D()}?`,`The ${pick(FORMS)} form needs to be handed in by ${D()}. Thanks!`]),deadline:true},
 {f:'school_fee',w:3,need:p=>p.child,label:()=>'ACT',text:()=>pick([`${pick(EVENTS)} fees of $${amt()} are due on ${D()}.`,`Payment for the ${pick(EVENTS)} ($${amt()}) is due by ${D()}.`]),deadline:true},
 {f:'school_cancel',w:2,need:p=>p.child,label:()=>'UPDATE',text:()=>pick([`The ${pick(EVENTS)} on ${D()} has been cancelled.`,`Training is off because of the wet weather. Back to normal next week.`])},
 {f:'school_change',w:2,need:p=>p.child,label:()=>'UPDATE',text:()=>pick([`Change of time: the ${pick(EVENTS)} has moved to ${D()}.`,`Due date extended: the form is now due on ${D()}.`])},
 {f:'payment_confirm',w:3,need:()=>true,label:()=>'CLOSE',text:()=>pick([`We've received your payment of $${amt()}. Thank you.`,`Your payment of $${amt()} was successful.`,`Thank you for submitting your form. Your child is confirmed.`])},
 {f:'appointment_cancelled',w:1,need:()=>true,label:()=>'CLOSE',text:()=>`Your appointment on ${D()} has been cancelled by the clinic.`},
 {f:'waiting',w:2,need:()=>true,label:()=>'WAIT',text:()=>pick([`Your claim is being assessed. We'll email you once a decision has been made.`,`We're still waiting on your doctor's report. We'll be in touch when it arrives.`,`Your application has been received. We will be in touch in early December.`])},
 {f:'newsletter',w:8,need:()=>true,label:()=>'IGNORE',text:()=>pick([`This week: ${pick(['a new librarian joins us','our garden project','sports day photos','the winter concert recap'])}. Read more.`,`Weekly roundup: top stories in education. Read more.`,`Newsletter: Term 4 is off to a great start.`])},
 {f:'marketing',w:10,need:()=>true,label:()=>'IGNORE',text:()=>pick([`Sale ends Sunday! Take 30% off all shoes. Shop now. To stop receiving promotional emails, please unsubscribe.`,`Your weekly digest is ready. If you no longer wish to receive these emails, please unsubscribe.`,`We found a recent article that cited you. View article. Please unsubscribe if you don't want these emails.`,`A new device signed in to your account. If this was you, no action is needed.`,`Rate your recent stay. We'd love your feedback. Please take our two-minute survey.`])},
 {f:'greeting',w:2,need:()=>true,label:()=>'IGNORE',text:()=>pick([`Happy ${pick(['Diwali','New Year','Easter','Eid'])} from all of us!`,`Congratulations to all our graduates!`])},
 {f:'delegated',w:2,need:()=>true,label:()=>'IGNORE',text:()=>pick([`Sarah has arranged the cake for Friday, so no need to worry about it.`,`Jo is picking up the forms from the office, so there's nothing for you to do.`])},
 {f:'optional_reply',w:2,need:()=>true,label:()=>'IGNORE',text:()=>pick([`Let us know if you have any questions.`,`Let me know if you'd like a copy of the report.`])},
 {f:'work_request',w:4,need:p=>p.work,label:()=>'ACT',text:()=>pick([`Could you send me the budget by ${D()}?`,`Please review the draft report before ${D()}.`,`Please complete the compliance training by ${D()}.`]),deadline:true},
 {f:'work_scheduling',w:3,need:p=>p.work,label:()=>'ACT',text:()=>{const x=when();return pick([`Could we do 3pm or 4pm on ${x.words} for a catch-up?`,`Are you free at 10am on ${x.day}? Let me know what works.`]);}},
 {f:'work_fyi',w:2,need:p=>p.work,label:()=>'IGNORE',text:()=>pick([`Please find attached the minutes from last week's meeting for your records.`,`Here is the agenda for your reference.`])},
 // Sent to everyone; only some people are eligible. The persona decides what the right answer is.
 {f:'broadcast_offer',w:3,need:()=>true,group:true,text:null},
];
const GROUPS=['staff','students','seniors','hardship'];
function offerText(g){const label={staff:'staff',students:'students',seniors:'seniors',hardship:'families experiencing hardship'}[g];return pick([`Financial support of up to $${100+Math.floor(rnd()*400)} is available to eligible ${label}. Apply by ${D()}.`,`Applications are open to eligible ${label} for a one-off grant. How to apply: email us by ${D()}.`]);}
function inbox(p,n=40){const fam=FAM.filter(x=>x.need(p));const total=fam.reduce((s,x)=>s+x.w,0);const out=[];
 for(let i=0;i<n;i++){let r=rnd()*total,x=fam[0];for(const c of fam){r-=c.w;if(r<=0){x=c;break;}}
  if(x.group){const g=pick(GROUPS);out.push({persona:p.id,family:x.f,text:offerText(g),expected:p.eligible[g]?'ACT':'IGNORE',hasDeadline:!!p.eligible[g],group:g});}
  else out.push({persona:p.id,family:x.f,text:x.text(),expected:x.label(p),hasDeadline:!!x.deadline});}
 return out;}
const all=P.flatMap(p=>inbox(p));
// ---- score ----
const NEEDS=new Set(['ACT','WAIT','UPDATE','CLOSE']);
function score(rows){const n=rows.length;let exact=0,needs=0,caught=0,ignores=0,falseAlarm=0,asks=0,missedDeadlines=0,deadlines=0,fabricated=0,sensitiveAsks=0,unclearAsks=0;
 for(const r of rows){const d=r.decided;if(d===r.expected)exact++;
  if(NEEDS.has(r.expected)){needs++;if(d!=='IGNORE')caught++;}
  if(r.expected==='IGNORE'){ignores++;if(d!=='IGNORE')falseAlarm++;}
  if(r.question){asks++;if(r.kind==='sensitive')sensitiveAsks++;if(r.kind==='unclear')unclearAsks++;}
  if(r.expected==='ACT'&&r.hasDeadline){deadlines++;if(d==='IGNORE')missedDeadlines++;}
  const ex=extractResponsibilities(r.text,{today:TODAY,sourceId:'a'}).responsibilities;if(ex.some(x=>x.dueDate)&&!/\d/.test(r.text))fabricated++;}
 const f=(a,b)=>b?+(a/b).toFixed(3):null;
 return {emails:n,exactDecision:f(exact,n),detectionRecall:f(caught,needs),needing:needs,falseAlarmRate:f(falseAlarm,ignores),ignoring:ignores,
  questionsPer100:+(asks/n*100).toFixed(1),sensitiveQuestionsPer100:+(sensitiveAsks/n*100).toFixed(1),missedDeadlines,deadlineEmails:deadlines,fabricatedDates:fabricated};}
// Remembering: the first time an offer for a clear, non-sensitive group is unclear, Bear asks and the person
// answers truthfully; Bear then remembers that group. Sensitive offers are asked every time.
const TRUTH={staff:'staff',student:'students',senior:'seniors'};
for(const p of P){const answers={};
 for(const r of all.filter(x=>x.persona===p.id)){
  const d=decideFor(r.text,answers);r.decided=d.decision;r.question=0;r.kind=null;
  if(d.rule==='eligibility-offer'){
   const info=offerGroup(r.text);r.question=1;
   if(info.group&&!info.sensitive){r.kind='first';const yes=!!p.eligible[TRUTH[info.group]];answers[info.group]=yes?'yes':'no';r.decided=yes?'ACT':'IGNORE';}
   else r.kind=info.sensitive?'sensitive':'unclear';}
  else if(d.decision==='ASK')r.question=1;}}

const overall=score(all);
const byPersona=Object.fromEntries(P.map(p=>[p.id,{who:p.who,...score(all.filter(r=>r.persona===p.id))}]));
const byFamily=Object.fromEntries([...new Set(all.map(r=>r.family))].map(f=>{const rs=all.filter(r=>r.family===f);const ok=rs.filter(r=>r.decided===r.expected).length;return [f,{emails:rs.length,correct:ok,accuracy:+(ok/rs.length).toFixed(3)}];}));
const out={generated:new Date().toISOString(),synthetic:true,personas:P.length,note:'Templates and rules were written by the same team: scores are optimistic. Use for relevance, burden and a repeatable harness, not as proof of real-world accuracy.',overall,byPersona,byFamily,
 notMeasured:['planningAccuracy','autonomousCompletion','incorrectActions']};
mkdirSync(resolve(here,'../results'),{recursive:true});
writeFileSync(resolve(here,'../results/audience-summary.json'),JSON.stringify(out,null,1));
writeFileSync(resolve(here,'dataset.json'),JSON.stringify({synthetic:true,today:TODAY,personas:P,emails:all.map(({persona,family,text,expected})=>({persona,family,text,expected}))},null,1));
console.log(JSON.stringify({overall,byFamily:Object.fromEntries(Object.entries(byFamily).filter(([,v])=>v.accuracy<1))},null,1));
console.log('persona   detect  falseAlarm  questions/100  sensitive/100');
for(const [id,v] of Object.entries(byPersona))console.log(id.padEnd(8),String(v.detectionRecall).padEnd(7),String(v.falseAlarmRate).padEnd(11),String(v.questionsPer100).padEnd(14),v.sensitiveQuestionsPer100);
