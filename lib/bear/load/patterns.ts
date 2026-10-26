import {addDays} from '../domain/dates.ts';
import type {LoadEntities,LoadPattern,PatternId,PatternStepTemplate} from './types.ts';

// The V1 canonical load patterns. Version-controlled, deterministic and cheap to read.
// AI may help recognise and extract; these rules alone govern ownership, state and closure.
export const PATTERN_LIBRARY_VERSION='2026.10-v1';

const has=(...flags:string[])=>(e:LoadEntities)=>flags.some(f=>e.flags?.includes(f));
const lacks=(...flags:string[])=>(e:LoadEntities)=>!flags.some(f=>e.flags?.includes(f));
const all=(...tests:((e:LoadEntities)=>boolean)[])=>(e:LoadEntities)=>tests.every(t=>t(e));
const before=(d:string|null|undefined,days:number)=>d?addDays(d,-days):null;
const after=(d:string|null|undefined,days:number)=>d?addDays(d,days):null;
const actBy=(e:LoadEntities)=>e.dueDate||e.rsvpDate||e.expiryDate||e.eventDate||null;
const eventDay=(e:LoadEntities)=>e.eventDate||e.dueDate||null;
const lastDay=(e:LoadEntities)=>e.eventEndDate||e.eventDate||e.dueDate||null;

const bear=(key:string,operation:PatternStepTemplate['operation'],label:string,extra:Partial<PatternStepTemplate>={}):PatternStepTemplate=>({key,operation,owner:'bear',label,...extra});
const human=(key:string,operation:PatternStepTemplate['operation'],human:NonNullable<PatternStepTemplate['human']>,label:string,cta:string,extra:Partial<PatternStepTemplate>={}):PatternStepTemplate=>({key,operation,owner:'human',human,label,cta,...extra});
const external=(key:string,label:string,waitingFor:(e:LoadEntities)=>string,extra:Partial<PatternStepTemplate>={}):PatternStepTemplate=>({key,operation:'monitor',owner:'external_system',label,waitingFor,...extra});
const sig=(match:RegExp,weight=1)=>({match,weight});

const BILL_PAYMENT:LoadPattern={
 id:'BILL_PAYMENT',name:'Bill to pay',domain:'money',description:'Money owed by a date: a bill, invoice, fee or charge.',
 recognition:{signals:[sig(/\b(invoice|bill|tax invoice|statement of account|rates notice|amount due|total due|balance due|amount owing|please pay|pay by|payment (?:is )?due|due for payment|bpay|biller code|direct debit)\b/i,2),sig(/\b(fee|fees|charge|levy|premium|instal+ment|owing|overdue|final notice)\b/i,1),sig(/\$\s?\d/,0.6),sig(/\b(electricity|gas(?! leak| smell)|water(?! bottle)|internet|phone bill|mobile|council|strata|energy|telstra|optus|agl|origin)\b/i,0.8)],entityHints:['amountCents','dueDate','reference'],confidenceThreshold:0.5,competingPatterns:['RENEWAL','PURCHASE_REQUIRED'],captureKinds:['bill']},
 interpretation:{requiredEntities:['amountCents','dueDate'],optionalEntities:['reference','provider','flags']},
 cognitiveOperations:['understand','decide','remember','monitor','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Read the bill and kept the details'),
  human('query','decide','decision','Something looks off with this bill. Pay it, or query it first?','Decide',{when:has('disputed','duplicate'),choices:[{label:'Pay it anyway',evidence:'query_cleared'},{label:"I'll query it",evidence:'query_raised'}],evidence:'query_cleared'}),
  human('plan','decide','decision','Pay it in full, or ask about a payment plan?','Decide',{when:has('insufficient','instalment'),choices:[{label:'Pay in full',evidence:'plan_full'},{label:'Ask for a payment plan',evidence:'plan_requested'}]}),
  human('share','coordinate','information','Sort out who pays which part','Sorted',{when:has('shared'),due:e=>before(e.dueDate,3),surfaceFrom:e=>before(e.dueDate,5),evidence:'shared_sorted'}),
  bear('remember','remember','Keep track of the due date',{due:e=>e.dueDate||null}),
  human('pay','follow_up','payment','Pay {amount}','I’ve paid it',{when:lacks('autopay','already_paid'),dependsOn:['query','plan','share'],due:e=>e.dueDate||null,surfaceFrom:(e,today)=>e.flags?.includes('overdue')||e.flags?.includes('with_parent')?today:before(e.dueDate,3),evidence:'payment_confirmed',doneText:'Paid. Off your mind.'}),
  external('debit','The direct debit takes it',()=>'the direct debit',{when:has('autopay'),due:e=>e.dueDate||null}),
  human('check_debit','close','confirmation','Did the {amount} direct debit go through?','It went through',{when:has('autopay'),surfaceFrom:e=>after(e.dueDate,1),requires:'payments',evidence:'payment_confirmed',doneText:'Confirmed. All sorted.'}),
 ],typicalDependencies:['understand → decide timing → remember → pay → verify → close'],decisions:['dispute or pay','payment plan'],actions:['pay'],possibleWaitingStates:['direct debit pending']},
 ownershipRules:{bearCanOwn:['understand','remember','monitor','follow_up'],bearCanPrepare:['payment details'],humanRequired:['payment','dispute decision'],externalSystemPossible:['direct debit']},
 intervention:{minimumHumanActionStrategy:'Reduce to one payment action, shown a few days before it is due.',surfaceRules:['surface the payment 3 days before due (learned per person)','surface immediately when overdue','surface a decision first when the bill looks wrong'],hideRules:['hide when autopay is on until the debit date passes'],escalationRules:['the evening before due if still unpaid']},
 waiting:{supported:true,monitoringStrategies:['time-based check after the debit date'],escalationStrategies:['ask once if the debit went through']},
 closure:{conditions:[['payment_confirmed'],['already_paid']],evidence:['payment_confirmed','already_paid'],description:'payment confirmed'},
 recurrence:{supported:true,strategy:'expect the next bill from the same biller on the learned cycle'},
};

const SCHOOL_EVENT:LoadPattern={
 id:'SCHOOL_EVENT',name:'School event',domain:'kids',description:'An excursion, carnival, camp or other school activity with its own admin.',
 recognition:{signals:[sig(/\b(excursion|incursion|carnival|camp\b|school camp|athletics|swimming carnival|cross country|sports day|book week|book parade|school (?:event|disco|concert|fete|photos?|play)|assembly|permission (?:note|slip)|year \d|kindergarten|kindy|prep\b|the school|students|parents and carers|dear parents|our class)\b/i,2),sig(/\b(teacher|principal|uniform|hat|water bottle|students|class|graduation|formal|compass|seesaw|sentral|qkr|operoo|term \d)\b/i,0.6)],entityHints:['eventDate','dueDate','person','items'],confidenceThreshold:0.5,competingPatterns:['INVITATION_EVENT','FORM_APPLICATION'],captureKinds:['school'],dominates:[{pattern:'INVITATION_EVENT',when:/\b(year \d+|kindy|kindergarten|prep|school|class|students)\b/i},{pattern:'FORM_APPLICATION',when:/\b(year \d+|kindy|kindergarten|excursion|camp|carnival|graduation)\b/i}]},
 interpretation:{requiredEntities:['eventDate'],optionalEntities:['dueDate','person','items','amountCents','location']},
 cognitiveOperations:['understand','anticipate','plan','remember','coordinate','close'],
 decomposition:{steps:[
  bear('read','understand','Worked out what the school needs'),
  bear('remember','remember','Keep track of {event}',{due:eventDay}),
  human('attend','decide','decision','Parents are invited. Do you want to go along?','Decide',{when:has('parent_attendance'),choices:[{label:'I’ll go',evidence:'attending'},{label:'Not this time',evidence:'not_attending'}],due:e=>before(eventDay(e),2)}),
  human('clash','decide','decision','This clashes with something else. Which one wins?','Decide',{when:has('conflict'),choices:[{label:'This one',evidence:'clash_sorted'},{label:'The other thing',evidence:'clash_sorted'}]}),
  human('medical','understand','information','Send in the medical details','Sent',{when:has('medical_requirement'),due:e=>e.dueDate||before(eventDay(e),3),evidence:'medical_sent'}),
  human('pack','plan','physical','Pack for {event}: {items}','Packed',{when:e=>!!e.items?.length,surfaceFrom:e=>before(eventDay(e),2),due:e=>before(eventDay(e),1),evidence:'packed',doneText:'Packed. Ready to go.'}),
  bear('happen','close','Close it off once {event} is over',{due:lastDay}),
 ],typicalDependencies:['participation → consent → payment → calendar → transport → preparation → event'],decisions:['participation','parent attendance'],actions:['consent','payment','packing'],possibleWaitingStates:['the event date']},
 ownershipRules:{bearCanOwn:['understand','anticipate','plan','remember'],bearCanPrepare:['packing list','sequencing'],humanRequired:['consent signature','payment','packing'],externalSystemPossible:['school portal payments']},
 intervention:{minimumHumanActionStrategy:'Only the next thing the school needs from the parent, by its deadline.',surfaceRules:['consent before payment','packing two days before'],hideRules:['never show the whole plan at capture'],escalationRules:['the day before a school deadline']},
 waiting:{supported:true,monitoringStrategies:['time-based: the event date']},
 closure:{conditions:[['event_occurred','children_resolved'],['cancelled']],evidence:['event_occurred','cancelled'],description:'event occurred and the things it needed are done'},
 attaches:[{pattern:'FORM_APPLICATION',when:e=>!!e.flags?.includes('consent')},{pattern:'BILL_PAYMENT',when:e=>!!e.amountCents&&!!e.flags?.includes('payment')},{pattern:'PURCHASE_REQUIRED',when:(e,t)=>/\b(buy|purchase|order|new (?:shoes|uniform|hat|bag)|need to get)\b/i.test(t)}],
};

const APPOINTMENT:LoadPattern={
 id:'APPOINTMENT',name:'Appointment',domain:'health',description:'Something booked (or to book) with a person or service.',
 recognition:{signals:[sig(/\b(appointment|appt|booking|consult(?:ation)?|check[- ]?up|dentist|doctor|\bgp\b|dr\.? [a-z]+|physio|optometrist|specialist|vaccination|vaccine|immunisation|scan|x-?ray|blood test|pathology|telehealth|orthodontist|haircut|vet\b|clinic|surgery|hospital|referral|review appointment|parent[- ]teacher interview)\b/i,2),sig(/\b(see you (?:on|at)|arrive \d+ min|please arrive|reschedul\w+|book (?:in|a)|need to book)\b/i,1)],entityHints:['eventDate','time','provider','person','location'],confidenceThreshold:0.5,competingPatterns:['WAITING_FOR_RESPONSE','INVITATION_EVENT'],captureKinds:['appointment']},
 interpretation:{requiredEntities:['eventDate'],optionalEntities:['time','provider','person','location','flags'],waivers:{eventDate:['needs_booking','referral','cancelled']}},
 cognitiveOperations:['understand','plan','remember','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Noted the appointment details'),
  human('referral','identify','information','Get the referral first','Got it',{when:has('referral'),evidence:'referral_ready'}),
  human('book','decide','decision','Book {title}','Booked it',{when:all(has('needs_booking','referral'),lacks('booked','cancelled')),dependsOn:['referral'],due:e=>e.dueDate||null,evidence:'booked',doneText:'Booked. Bear will remember it.'}),
  bear('remember','remember','Bring it back the day before',{when:lacks('cancelled'),due:eventDay}),
  human('prepare','plan','physical','Get ready for {title}','Ready',{when:all(has('preparation'),lacks('cancelled')),surfaceFrom:e=>before(eventDay(e),1),due:eventDay}),
  human('outcome','close','confirmation','How did {title} go? Anything to follow up?','All done',{when:lacks('cancelled'),dependsOn:['book'],surfaceFrom:e=>eventDay(e)||'9999-12-31',evidence:'outcome_captured',choices:[{label:'All done, nothing more',evidence:'outcome_captured'},{label:'There’s a follow-up',evidence:'follow_up_needed'}],doneText:'Noted. That one’s closed.'}),
 ],typicalDependencies:['book → prepare → attend → capture outcome → follow-up'],decisions:['when to book'],actions:['book','attend'],possibleWaitingStates:['the appointment date']},
 ownershipRules:{bearCanOwn:['understand','remember','plan'],bearCanPrepare:['preparation reminders'],humanRequired:['booking','attending','outcome'],externalSystemPossible:['online booking']},
 intervention:{minimumHumanActionStrategy:'Booking if not booked; otherwise nothing until preparation or the outcome matters.',surfaceRules:['preparation the day before','outcome on the day'],hideRules:['attendance itself is never a to-do'],escalationRules:['the day before']},
 waiting:{supported:true,monitoringStrategies:['time-based: the appointment date']},
 closure:{conditions:[['outcome_captured','children_resolved'],['cancelled']],evidence:['outcome_captured','cancelled'],description:'appointment outcome resolved and any follow-up captured'},
 attaches:[{pattern:'BILL_PAYMENT',when:(e,t)=>!!e.amountCents&&/\b(gap|fee|pay|payment|cost)\b/i.test(t)}],
};

const FORM_APPLICATION:LoadPattern={
 id:'FORM_APPLICATION',name:'Form or application',domain:'life_admin',description:'Something to fill in, sign, submit, or apply for.',
 recognition:{signals:[sig(/\b(form|application|apply|applying|fill (?:in|out)|sign (?:and return|the)|signature|consent|permission (?:form|note|slip)|lodge|lodged|submit|submitted|submission|paperwork|tax return|claim form|enrolment|enrollment|registration form|questionnaire|survey to complete)\b/i,2),sig(/\b(portal|documents?|proof of|certified|witness|attach(?:ed)?)\b/i,0.6)],entityHints:['dueDate','flags'],confidenceThreshold:0.5,competingPatterns:['SCHOOL_EVENT','RENEWAL'],captureKinds:['form'],dominates:[{pattern:'WAITING_FOR_RESPONSE',when:/\bsubmitted\b[^.]*\bapplication\b|\bapplication\b[^.]*\bsubmitted\b/i}]},
 interpretation:{requiredEntities:[],optionalEntities:['dueDate','flags','amountCents']},
 cognitiveOperations:['understand','identify','plan','remember','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Worked out what the form needs'),
  human('docs','identify','information','Find the documents it asks for','Got them',{when:has('documents'),due:e=>before(e.dueDate,3),evidence:'documents_ready'}),
  human('partner','coordinate','information','Get the details only your partner has','Got them',{when:has('partner'),evidence:'shared_input'}),
  human('submit','follow_up','signature','{formLabel}','{formCta}',{when:lacks('submitted'),dependsOn:['docs','partner','resubmit'],due:e=>e.dueDate||null,surfaceFrom:(e,today)=>today,evidence:'submission_confirmed',doneText:'{formDone}'}),
  external('outcome','Waiting to hear back',e=>e.provider||'them',{when:has('application','submitted','multi_stage'),dependsOn:['submit'],due:e=>after(e.dueDate,21)}),
  human('heard','close','confirmation','Heard back about {title}?','Yes, heard back',{when:has('application','submitted','multi_stage'),dependsOn:['submit'],surfaceFrom:(e,today)=>after(e.dueDate||today,21),evidence:'outcome_received',choices:[{label:'Approved, all done',evidence:'outcome_received'},{label:'They need more',evidence:'resubmit_needed'}]}),
  human('resubmit','decide','decision','It came back. Fix it and send again, or let it go?','Decide',{when:has('rejected'),choices:[{label:'Send it again',evidence:'resubmitting'},{label:'Let it go',evidence:'abandoned'}]}),
 ],typicalDependencies:['understand → gather → complete → sign → submit → verify → wait if applicable'],decisions:['resubmit or not'],actions:['gather','sign','submit'],possibleWaitingStates:['outcome pending']},
 ownershipRules:{bearCanOwn:['understand','identify','remember','follow_up'],bearCanPrepare:['what the form needs','document list'],humanRequired:['signature','submission'],externalSystemPossible:['online portals']},
 intervention:{minimumHumanActionStrategy:'One action: complete and send it, after anything it depends on.',surfaceRules:['documents first','then sign and submit'],hideRules:['field-by-field steps are never shown'],escalationRules:['the day before it is due']},
 waiting:{supported:true,monitoringStrategies:['time-based check three weeks after submitting'],escalationStrategies:['ask if they have heard back']},
 closure:{conditions:[['submission_confirmed'],['outcome_received'],['abandoned']],conditionsFor:e=>e.flags?.some(f=>['application','submitted','multi_stage'].includes(f))?[['outcome_received'],['abandoned']]:[['submission_confirmed'],['outcome_received'],['abandoned']],evidence:['submission_confirmed','outcome_received'],description:'submission confirmed (or, for applications, the outcome received)'},
 attaches:[{pattern:'BILL_PAYMENT',when:(e,t)=>!!e.amountCents&&/\b(fee|pay|payment|cost)\b/i.test(t)}],
};

const REPAIR_PROBLEM:LoadPattern={
 id:'REPAIR_PROBLEM',name:'Something to fix',domain:'home',description:'Something broken, leaking or not working.',
 recognition:{signals:[sig(/\b(broken|broke|leak(?:ing|s|y)?|dripping|blocked|won'?t (?:start|turn on|close|open|drain|flush)|not working|stopped working|crack(?:ed)?|fault(?:y)?|repair|fix(?:ed|ing)?|plumber|electrician|mechanic|handyman|service the|warning light|making a noise|noisy|smell(?:s)? (?:gas|burning)|no hot water|tripping|mould)\b/i,2),sig(/\b(tap|toilet|hot water|dishwasher|washing machine|fridge|oven|car|tyre|roof|gutter|fence|door|window|aircon|heater|lock)\b/i,0.6)],entityHints:['provider','flags'],confidenceThreshold:0.5,competingPatterns:['APPOINTMENT','WAITING_FOR_RESPONSE'],captureKinds:[]},
 interpretation:{requiredEntities:[],optionalEntities:['provider','flags','location']},
 cognitiveOperations:['understand','decide','identify','coordinate','monitor','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Noted what is wrong'),
  human('safe','decide','physical','Make it safe first. If it’s dangerous, turn it off at the source and call an emergency line.','It’s safe',{when:has('safety'),evidence:'made_safe'}),
  human('warranty','identify','information','Check whether it’s still under warranty','Checked',{when:has('warranty'),evidence:'warranty_checked'}),
  human('choose','decide','decision','Fix it yourself, or get someone in?','Decide',{when:all(lacks('rental','safety','urgent'),e=>!e.provider),choices:[{label:'I’ll fix it',evidence:'diy'},{label:'Get someone in',evidence:'get_someone'}]}),
  human('contact','coordinate','physical','{contactLabel}','Done, I’ve asked',{skipIf:['diy'],when:lacks('no_response'),dependsOn:['safe','warranty','choose'],surfaceFrom:(e,today)=>today,evidence:'contacted',requires:'providers'}),
  external('reply','Waiting on {who}',e=>e.flags?.includes('rental')?'the property manager':e.provider||'the tradie',{skipIf:['diy'],dependsOn:['contact'],due:e=>after(e.dueDate,0)}),
  human('chase','follow_up','physical','No word from {who} yet. Chase them, or try someone else?','Chased',{when:has('no_response'),choices:[{label:'I’ve chased them',evidence:'chased'},{label:'Try someone else',evidence:'switch_provider'}]}),
  human('quote','decide','approval','Approve the quote?','Approve',{when:has('quote'),dependsOn:['contact'],choices:[{label:'Go ahead',evidence:'quote_approved'},{label:'Get another quote',evidence:'quote_rejected'}]}),
  human('fixed','close','confirmation','Is it actually fixed?','It’s fixed',{dependsOn:['contact'],surfaceFrom:(e,today)=>after(today,3),evidence:'problem_fixed',doneText:'Fixed. Off your mind.'}),
 ],typicalDependencies:['assess → choose response → provider → contact → wait → quote → approve → schedule → repair → verify'],decisions:['diy or provider','approve quote'],actions:['contact','approve'],possibleWaitingStates:['provider reply','quote','repair visit']},
 ownershipRules:{bearCanOwn:['understand','remember','monitor','follow_up'],bearCanPrepare:['who to contact','what to say'],humanRequired:['contacting providers (no provider integration yet)','approving cost'],externalSystemPossible:['provider replies']},
 intervention:{minimumHumanActionStrategy:'Safety first, then one contact; then Bear waits.',surfaceRules:['safety immediately','chase only after the reply window'],hideRules:['quote and scheduling steps until they arise'],escalationRules:['chase after two days without a reply']},
 waiting:{supported:true,monitoringStrategies:['time-based: check two days after contacting'],escalationStrategies:['ask whether to chase or switch provider']},
 closure:{conditions:[['problem_fixed']],evidence:['problem_fixed'],description:'the problem is actually fixed (not just reported, quoted or booked)'},
};

const WAITING_FOR_RESPONSE:LoadPattern={
 id:'WAITING_FOR_RESPONSE',name:'Waiting on someone',domain:'life_admin',description:'Something someone else owes a reply, refund, result or delivery for.',
 recognition:{signals:[sig(/\b(waiting (?:on|for)|still waiting|let me know|haven'?t heard|not heard back|no reply|hasn'?t (?:replied|responded|got back|arrived|called)|expect(?:ing)? (?:a|to hear|the)|should hear|will (?:get back|let me know|call back)|awaiting|pending|refund|claim (?:is )?(?:in|lodged|submitted)|results?|tracking|delivery|on its way|get back to (?:me|us))\b/i,2.5),sig(/\b(reply|response|confirm|outcome|answer|hear back|heard back)\b/i,0.6)],entityHints:['provider','dueDate'],confidenceThreshold:0.5,competingPatterns:['REPAIR_PROBLEM','FORM_APPLICATION','PURCHASE_REQUIRED'],captureKinds:['message']},
 interpretation:{requiredEntities:[],optionalEntities:['provider','dueDate','flags']},
 cognitiveOperations:['remember','monitor','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Noted who owes what'),
  external('wait','Waiting on {who}',e=>e.provider||e.person||'them',{when:lacks('no_response'),due:e=>e.dueDate||null}),
  human('chase','follow_up','physical','Still nothing from {who}. Give them a nudge?','Nudged them',{when:has('no_response'),evidence:'chased',doneText:'Nudged. Bear will check again.'}),
  human('heard','close','confirmation','Heard back from {who}?','Yes, it’s sorted',{surfaceFrom:(e,today)=>e.dueDate||after(today,5),evidence:'response_received',choices:[{label:'Yes, all sorted',evidence:'response_received'},{label:'Not yet',evidence:'still_waiting'}],doneText:'Good. That loop is closed.'}),
 ],typicalDependencies:['establish expectation → wait → monitor → escalate if necessary → interpret response → close'],decisions:['chase or wait'],actions:['chase'],possibleWaitingStates:['reply','refund','delivery','result']},
 ownershipRules:{bearCanOwn:['remember','monitor','follow_up'],bearCanPrepare:['the chase message'],humanRequired:['confirming the response arrived (no inbox access)'],externalSystemPossible:['email','order tracking']},
 intervention:{minimumHumanActionStrategy:'Nothing until the expected reply date; then one check.',surfaceRules:['bring it back when the reply window ends'],hideRules:['the wait itself is never a to-do'],escalationRules:['offer a chase once overdue']},
 waiting:{supported:true,monitoringStrategies:['time-based resurfacing (no inbox access)'],escalationStrategies:['offer a chase']},
 closure:{conditions:[['response_received']],evidence:['response_received'],description:'the expected response or outcome was received'},
};

const PURCHASE_REQUIRED:LoadPattern={
 id:'PURCHASE_REQUIRED',name:'Something to get',domain:'home',description:'A specific thing that has to be bought or obtained.',
 recognition:{signals:[sig(/\b(buy|bought|purchase|order|ordered|return it|refund|exchange it|get (?:a|an|some|new)|need(?:s)? (?:a |an |new )|new (?:shoes|charger|uniform|kettle|phone|laptop|bag|bike|school shoes)|replace(?:ment)?|present for|gift for|pick up (?:a|some)|shopping for)\b/i,2),sig(/\b(size|budget|under \$|brand|model|store|online|delivery|in stock|out of stock|costume|arrive|faulty receipt)\b/i,0.6)],entityHints:['items','dueDate','person'],confidenceThreshold:0.5,competingPatterns:['REPLENISHMENT','BILL_PAYMENT'],captureKinds:['shopping','errand']},
 interpretation:{requiredEntities:[],optionalEntities:['items','dueDate','person','amountCents']},
 cognitiveOperations:['identify','decide','remember','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Worked out what is needed'),
  human('spec','identify','information','What exactly is needed? (size, model, colour)','Sorted',{when:has('unsure'),evidence:'spec_known'}),
  human('agree','coordinate','decision','Check with your partner before buying','Agreed',{when:has('partner'),evidence:'agreed'}),
  human('instead','decide','decision','It’s unavailable. Wait for it, or get something else?','Decide',{when:has('unavailable'),choices:[{label:'Wait for it',evidence:'wait_restock'},{label:'Get something else',evidence:'choose_other'}]}),
  human('buy','decide','payment','{buyLabel}','Got it',{when:lacks('ordered','return'),dependsOn:['spec','agree','instead'],due:e=>e.dueDate||before(e.eventDate,2),surfaceFrom:(e,today)=>e.flags?.includes('urgent')?today:before(e.dueDate||before(e.eventDate,2),7)||today,evidence:'item_obtained',doneText:'Got it. Done.'}),
  external('delivery','Waiting for it to arrive',()=>'the delivery',{when:has('ordered'),due:e=>e.dueDate||null}),
  human('arrived','close','confirmation','Did {item} arrive, and is it right?','Yes, it’s here',{when:has('ordered'),surfaceFrom:(e,today)=>e.dueDate||after(today,5),evidence:'item_obtained',choices:[{label:'Yes, all good',evidence:'item_obtained'},{label:'It needs returning',evidence:'needs_return'}]}),
  human('send_back','follow_up','physical','Send {item} back','Sent back',{when:has('return'),evidence:'returned'}),
  external('refund','Waiting for the refund',()=>'the refund',{when:has('return'),dependsOn:['send_back']}),
  human('refunded','close','confirmation','Has the refund come through?','Yes',{when:has('return'),dependsOn:['send_back'],surfaceFrom:(e,today)=>after(today,10),evidence:'item_obtained'}),
 ],typicalDependencies:['define requirement → identify → compare → decide → buy → wait → verify'],decisions:['which one','wait or substitute'],actions:['buy'],possibleWaitingStates:['delivery','refund']},
 ownershipRules:{bearCanOwn:['remember','follow_up'],bearCanPrepare:['the list','a usual choice'],humanRequired:['buying'],externalSystemPossible:['order tracking']},
 intervention:{minimumHumanActionStrategy:'One buy action, a week before it is needed; no option overload.',surfaceRules:['a week before needed','immediately when urgent'],hideRules:['comparisons unless asked'],escalationRules:['two days before needed']},
 waiting:{supported:true,monitoringStrategies:['time-based delivery check (no order tracking yet)']},
 closure:{conditions:[['item_obtained']],evidence:['item_obtained'],description:'the correct, usable item is in hand (not merely ordered)'},
};

const RENEWAL:LoadPattern={
 id:'RENEWAL',name:'Renewal',domain:'life_admin',description:'Something that expires and has to be renewed (or let go).',
 recognition:{signals:[sig(/\b(renew(?:al|ed|s)?|expir(?:y|es|ed|ing)|registration|rego|licen[cs]e|passport|membership|subscription|policy|insurance|working with children|wwcc|first aid (?:cert|certificate)|practising certificate|due to (?:renew|expire))\b/i,2),sig(/\b(annual|yearly|valid until|lapses?|auto[- ]?renew)\b/i,0.8)],entityHints:['expiryDate','amountCents'],confidenceThreshold:0.5,competingPatterns:['BILL_PAYMENT','FORM_APPLICATION'],captureKinds:[]},
 interpretation:{requiredEntities:['expiryDate'],optionalEntities:['amountCents','flags','provider'],waivers:{expiryDate:['expired']}},
 cognitiveOperations:['anticipate','decide','identify','remember','follow_up','close'],
 decomposition:{steps:[
  bear('read','understand','Noted what expires and when'),
  bear('anticipate','anticipate','Keep track of the expiry date',{due:e=>e.expiryDate||e.dueDate||null}),
  human('keep','decide','decision','{keepLabel}','Decide',{when:has('not_wanted','price_increase','comparison'),choices:[{label:'Renew it',evidence:'keep'},{label:'Let it go',evidence:'not_renewing'}]}),
  human('prereq','identify','physical','Get the {prereq} done first','Done',{when:has('prerequisite'),due:e=>before(e.expiryDate||e.dueDate,7),evidence:'prerequisite_done'}),
  human('renew','decide','payment','{renewLabel}','Renewed',{when:lacks('autopay'),dependsOn:['keep','prereq'],due:e=>e.expiryDate||e.dueDate||null,surfaceFrom:(e,today)=>e.flags?.includes('expired')?today:before(e.expiryDate||e.dueDate,14),evidence:'renewal_confirmed',doneText:'Renewed. Bear has the next date.'}),
  external('auto','It renews automatically',()=>'the automatic renewal',{when:has('autopay'),due:e=>e.expiryDate||e.dueDate||null}),
  human('check_auto','close','confirmation','Did {title} renew?','Yes, renewed',{when:has('autopay'),surfaceFrom:e=>after(e.expiryDate||e.dueDate,1),requires:'payments',evidence:'renewal_confirmed'}),
 ],typicalDependencies:['anticipate → assess continued need → prerequisites → decide → renew → confirm → next cycle'],decisions:['keep or let go'],actions:['prerequisite','renew'],possibleWaitingStates:['automatic renewal']},
 ownershipRules:{bearCanOwn:['anticipate','remember','follow_up'],bearCanPrepare:['the renewal window'],humanRequired:['deciding to keep it','paying to renew'],externalSystemPossible:['auto-renewal']},
 intervention:{minimumHumanActionStrategy:'Renew two weeks before expiry; ask the keep-or-go question only when it matters.',surfaceRules:['two weeks before expiry','immediately when expired'],hideRules:['auto-renewals until the date passes'],escalationRules:['three days before expiry']},
 waiting:{supported:true,monitoringStrategies:['time-based check after the renewal date']},
 closure:{conditions:[['renewal_confirmed','next_expiry_recorded'],['not_renewing']],evidence:['renewal_confirmed','next_expiry_recorded','not_renewing'],description:'renewal confirmed and the next expiry recorded (or deliberately let go)'},
 recurrence:{supported:true,strategy:'record the next expiry a year on'},
};

const INVITATION_EVENT:LoadPattern={
 id:'INVITATION_EVENT',name:'Invitation',domain:'people',description:'A party, wedding, dinner or gathering someone invited you to.',
 recognition:{signals:[sig(/\b(invit(?:e|ed|ation)|rsvp|party|wedding|engagement|baby shower|hens?|bucks|dinner (?:at|with|on)|bbq|barbecue|birthday (?:party|lunch|dinner)|celebrat\w+|get[- ]together|reunion|you'?re invited|would love (?:you|to see you)|join us|come (?:over|along) for)\b/i,2),sig(/\b(dinner|lunch|brunch|drinks|catch[- ]up|book club|gathering)\b/i,1.2)],entityHints:['eventDate','rsvpDate','location','person'],confidenceThreshold:0.5,competingPatterns:['SCHOOL_EVENT','APPOINTMENT'],captureKinds:['event']},
 interpretation:{requiredEntities:['eventDate'],optionalEntities:['rsvpDate','location','person','flags']},
 cognitiveOperations:['decide','plan','coordinate','remember','close'],
 decomposition:{steps:[
  bear('read','understand','Noted the invitation'),
  human('partner','coordinate','information','Check with your partner','Checked',{when:all(has('partner'),lacks('accept','decline')),evidence:'partner_checked'}),
  human('go','decide','decision','Do you want to go to {title}?','Decide',{when:lacks('accept','decline','cancelled'),dependsOn:['partner'],due:e=>e.rsvpDate||before(e.eventDate,3),choices:[{label:'Yes, I’ll go',evidence:'going'},{label:'No, I’ll pass',evidence:'declined'}]}),
  human('rsvp','coordinate','physical','{rsvpLabel}','Done',{labelIf:[{evidence:'declined',label:'Let them know you can’t make it'},{evidence:'going',label:'Let them know you’re coming{rsvpBy}'}],when:lacks('cancelled'),dependsOn:['go'],due:e=>e.rsvpDate||before(e.eventDate,3),evidence:'rsvp_sent',doneText:'They know. Sorted.'}),
  human('sitter','coordinate','physical','Sort out someone to mind the kids','Sorted',{when:all(has('childcare'),lacks('decline','cancelled')),dependsOn:['go','rsvp'],requiresEvidence:'going',skipIf:['declined'],surfaceFrom:e=>before(e.eventDate,10),evidence:'childcare_sorted'}),
  human('travel','plan','physical','Book the travel','Booked',{when:all(has('travel'),lacks('decline','cancelled')),dependsOn:['go','rsvp'],requiresEvidence:'going',skipIf:['declined'],surfaceFrom:e=>before(e.eventDate,21),evidence:'travel_booked'}),
  bear('happen','close','Close it off after the day',{when:lacks('cancelled'),due:e=>e.eventDate||null}),
 ],typicalDependencies:['decide → rsvp → logistics → attend'],decisions:['go or not'],actions:['rsvp','gift','childcare','travel'],possibleWaitingStates:['the day itself']},
 ownershipRules:{bearCanOwn:['remember','plan'],bearCanPrepare:['logistics timing'],humanRequired:['the decision to go','rsvp'],externalSystemPossible:[]},
 intervention:{minimumHumanActionStrategy:'Ask only "Do you want to go?" first, then carry the admin.',surfaceRules:['decision before RSVP date','logistics closer to the day'],hideRules:['gift and travel until the person says yes'],escalationRules:['the day before the RSVP date']},
 waiting:{supported:true,monitoringStrategies:['time-based: the day itself']},
 closure:{conditions:[['declined','rsvp_sent'],['event_occurred','rsvp_sent','children_resolved'],['cancelled']],evidence:['declined','rsvp_sent','event_occurred','cancelled'],description:'attended or declined, and the obligations around it resolved'},
 attaches:[{pattern:'PURCHASE_REQUIRED',when:e=>!!e.flags?.includes('gift')&&!e.flags?.includes('decline')}],
};

const REPLENISHMENT:LoadPattern={
 id:'REPLENISHMENT',name:'Running low',domain:'home',description:'Something that runs out and has to be restocked.',
 recognition:{signals:[sig(/\b(running (?:low|out)|run(?:ning)? out of|ran out|almost out|nearly out|low on|out of(?! stock)|restock|top up|refill|repeat (?:script|prescription)|groceries|dog food|cat food|nappies|formula|printer ink|toner|toilet paper|loo paper|dishwasher tablets|detergent|medication|script)\b/i,2),sig(/\b(every (?:week|fortnight|month)|always runs? out|again)\b/i,0.6)],entityHints:['items'],confidenceThreshold:0.5,competingPatterns:['PURCHASE_REQUIRED'],captureKinds:['shopping']},
 interpretation:{requiredEntities:[],optionalEntities:['items','flags']},
 cognitiveOperations:['anticipate','monitor','remember','close'],
 decomposition:{steps:[
  bear('read','understand','Noted what is running low'),
  human('substitute','decide','decision','It’s out of stock. Wait, or try another one?','Decide',{when:has('unavailable'),choices:[{label:'Wait for it',evidence:'wait_restock'},{label:'Get another one',evidence:'substitute_ok'}]}),
  human('script','identify','physical','Get a new script from the doctor','Got it',{when:all(has('medication'),e=>/\b(no repeats|new script|last repeat|run out of repeats)\b/i.test(e.title||'')),evidence:'script_ready'}),
  human('get','follow_up','physical','{getLabel}','Got it',{dependsOn:['substitute','script'],surfaceFrom:(e,today)=>today,due:e=>e.dueDate||null,evidence:'supply_restored',doneText:'Stocked up. Bear will watch for the next one.'}),
 ],typicalDependencies:['anticipate depletion → monitor → determine need → bundle opportunity → acquire → reset estimate'],decisions:['substitute'],actions:['acquire'],possibleWaitingStates:['restock']},
 ownershipRules:{bearCanOwn:['anticipate','remember'],bearCanPrepare:['bundling with the next shop'],humanRequired:['buying'],externalSystemPossible:['retailer subscriptions']},
 intervention:{minimumHumanActionStrategy:'Fold it into the next shop rather than interrupting.',surfaceRules:['with the next shop'],hideRules:['until likely running low'],escalationRules:['essentials: a day before running out']},
 waiting:{supported:false},
 closure:{conditions:[['supply_restored']],evidence:['supply_restored'],description:'supply restored, and the next depletion estimated'},
 recurrence:{supported:true,strategy:'estimate the next run-out from the cycle (learned)'},
};

const UNKNOWN_LOAD:LoadPattern={
 id:'UNKNOWN_LOAD',name:'Something on your mind',domain:'other',description:'A load Bear cannot confidently place yet.',
 recognition:{signals:[],entityHints:[],confidenceThreshold:0},
 interpretation:{requiredEntities:[],optionalEntities:['dueDate']},
 cognitiveOperations:['remember'],
 decomposition:{steps:[bear('remember','remember','Hold onto it so you don’t have to')],typicalDependencies:[],decisions:['what would make this feel sorted'],actions:[],possibleWaitingStates:[]},
 ownershipRules:{bearCanOwn:['remember'],bearCanPrepare:[],humanRequired:['one clarification'],externalSystemPossible:[]},
 intervention:{minimumHumanActionStrategy:'Ask one small question: what would make this feel sorted?',surfaceRules:['ask once'],hideRules:[],escalationRules:[]},
 waiting:{supported:false},
 closure:{conditions:[['user_resolved']],evidence:['user_resolved'],description:'the person says it is sorted'},
};

export const patterns:Record<PatternId,LoadPattern>={BILL_PAYMENT,SCHOOL_EVENT,APPOINTMENT,FORM_APPLICATION,REPAIR_PROBLEM,WAITING_FOR_RESPONSE,PURCHASE_REQUIRED,RENEWAL,INVITATION_EVENT,REPLENISHMENT,UNKNOWN_LOAD};
export const v1Patterns=(Object.values(patterns)).filter(p=>p.id!=='UNKNOWN_LOAD');
// When two patterns score the same, the more specific one wins.
export const patternPriority:PatternId[]=['SCHOOL_EVENT','INVITATION_EVENT','APPOINTMENT','RENEWAL','REPAIR_PROBLEM','WAITING_FOR_RESPONSE','REPLENISHMENT','FORM_APPLICATION','BILL_PAYMENT','PURCHASE_REQUIRED'];
export const unknownChoices=['Make a decision','Arrange something','Wait for someone','Get something done','Something else'] as const;
