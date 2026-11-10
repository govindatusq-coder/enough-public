// Responsibility decision layer. Given what a message says, decide what (if anything) has changed about
// what the user needs to do. Pure and deterministic: no network, no model. Outputs one of
// ACT | ASK | WAIT | UPDATE | CLOSE | IGNORE. The default is IGNORE.
// This is a RULE-BASED baseline. An LLM-backed decider can replace it later, but must beat this on the
// same labelled sets (evaluation/dataset/*.json) before it is used.
export type Decision='ACT'|'ASK'|'WAIT'|'UPDATE'|'CLOSE'|'IGNORE';
export interface Decided{decision:Decision;meaning:string;rule:string}

const A="(?:’|')"; // apostrophe, straight or curly
const re=(s:string)=>new RegExp(s,'i');
const DAY='monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MONTH='january|february|march|april|may|june|july|august|september|october|november|december';
const NUMERIC_DATE='\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b';
// A real date or day, in any common form (not just "by Friday").
const DATED=re(`\\b(${DAY})\\b|\\b\\d{1,2}(st|nd|rd|th)? (${MONTH})\\b|\\b(${MONTH}) \\d{1,2}\\b|${NUMERIC_DATE}|\\bend of (term|month|year)\\b|\\bbefore (the )?(first day|next)\\b`);
// Things that look like requests but aren't ("please find attached", "please note").
const NOT_A_REQUEST=re(`please (find|see) (the )?(attached|below|enclosed)|please note|please do not reply|please enjoy`);

// Mail footer boilerplate: opt-out and housekeeping lines. Their "please" is not a request to the reader, so those
// sentences are removed before reading the rest. A real obligation in the same message is still read.
const BOILERPLATE=re(`unsubscribe|stop receiving|no longer wish to receive|don${A}t want to receive|safe list|address book|to your contacts|notification settings|do not reply|forward this to`);
const withoutBoilerplate=(t:string)=>t.split(/(?<=[.!?])\s+/).filter(sentence=>!BOILERPLATE.test(sentence)).join(' ');

// The decision order matters: more specific meanings first, the default (IGNORE) last.
const RULES:{decision:Decision;meaning:string;rule:string;test:(t:string,raw:string)=>boolean}[]=[
 // 1. Confirmations: something the user did, sent or asked for has been received or done. Closes an existing item.
 {decision:'CLOSE',meaning:'confirmation',rule:'receipt-or-submission',test:t=>re(`\\b(we(${A}ve| have) (now )?received your|payment (received|of \\$[\\d.,]+ (for|has been|was (successful|received))|was (successful|received))|thank you for (submitting|your payment)|has been (paid|submitted|issued|recorded)|thanks,? got the|is (now )?confirmed|booking.{0,30}confirmed)\\b`).test(t)&&!re(`\\b(haven${A}t|have not|not yet) received\\b`).test(t)},
 // 2. Cancellations and changes to something already tracked.
 {decision:'CLOSE',meaning:'cancellation',rule:'appointment-cancelled',test:t=>re('\\bappointment\\b.*\\bcancel+ed\\b|\\bcancel+ed\\b.*\\bappointment\\b').test(t)},
 {decision:'UPDATE',meaning:'change',rule:'cancelled-or-moved',test:t=>re(`\\b(cancel+ed|cancellation|(is|are) off (because|due|for)\\b|\\b(training|lesson|class|practice|session)s?\\b.{0,30}\\b(is|are) off\\b)|\\bnow (on|at|due|held)\\b|\\bchange of (date|time)\\b|\\broom change\\b|\\brescheduled\\b|\\bmoved (to|from)\\b|\\bhas moved\\b|\\binstead of\\b|\\bextended\\b`).test(t)},
 // 3. Someone else owns the action, or the message says nothing is needed.
 {decision:'IGNORE',meaning:'no_action',rule:'explicitly-no-action',test:t=>re(`nothing (needed )?(for you to do|from you)|you don${A}t need to do anything|no (need to worry|payment is needed)|no action (is )?(required|needed) (and|,)`).test(t)||re('^.{0,80}no action (is )?required').test(t)&&!/\bprocess/i.test(t)},
 {decision:'IGNORE',meaning:'delegated',rule:'someone-else-owns-it',test:t=>re(`\\b(i${A}ll|i will|jo is|sarah has|someone is|we${A}ll|has (offered|arranged)) (to )?(organise|organize|book|pick up|collect|handle|arrange|arranged)\\b`).test(t)||re('\\bhas (offered to|arranged)\\b').test(t)},
 // 4. Waiting on someone else's reply, decision or processing.
 {decision:'WAIT',meaning:'waiting',rule:'awaiting-reply-or-decision',test:t=>re(`\\b(haven${A}t|have not) (yet )?heard back\\b|\\bstill (waiting|considering)\\b|\\bwill (be in touch|let you know|contact you|respond once)\\b|\\bonce (it|they|the \\w+) (has|have) (been )?(assessed|reviewed|made)\\b|\\bbeing (processed|reviewed|assessed)\\b|\\bwe(${A}ll| will) (email|contact|notify|call|let) you (once|when|as soon as)\\b|\\bwill respond once\\b|\\bin touch within\\b`).test(t)},
 // 5. Optional replies and small talk.
 {decision:'IGNORE',meaning:'optional_reply',rule:'let-me-know-if',test:t=>re(`^(let (me|us) know|if you (have|would like|${A}d like))\\b|\\blet (me|us) know if\\b`).test(t)},
 // 5b. Optional feedback or surveys with no date.
 {decision:'IGNORE',meaning:'optional_feedback',rule:'survey-no-date',test:t=>re('\\b(survey|rate your|your feedback|how did we do)\\b').test(t)&&!DATED.test(t)},
 // 6. Information or broadcasts that may or may not matter to this reader: one question, not a task.
 {decision:'ASK',meaning:'information',rule:'fyi-or-uncertain',test:t=>re(`\\bjust (confirming|a heads up|letting you know)\\b|\\bheads up\\b|\\bfyi\\b|\\bmay (move|start|change|be)\\b|\\bmight be\\b|\\bin due course\\b|\\bwe${A}ll confirm\\b|\\bwill confirm\\b`).test(t)},
 {decision:'ASK',meaning:'broadcast_offer',rule:'eligibility-offer',test:t=>re(`\\beligible\\b|\\bwho (is eligible|qualify|qualifies)\\b|\\bfamilies who qualify\\b|\\bhow to apply\\b|\\bopen to\\b`).test(t)},
 {decision:'ASK',meaning:'approval_for_someone_else',rule:'please-go-ahead',test:t=>re('\\bplease go ahead\\b').test(t)},
];

export function decide(text:string):Decided{
 const raw=text.replace(/\s+/g,' ').trim();
 const t=withoutBoilerplate(raw.replace(NOT_A_REQUEST,' '));
 for(const r of RULES)if(r.test(t,raw))return {decision:r.decision,meaning:r.meaning,rule:r.rule};
 const dated=DATED.test(t);
 // Questions that need an answer: scheduling and availability.
 if(t.includes('?')&&re(`\\b(could we|can we|would you be able|are you (free|available)|do you (want|have time)|what time)\\b`).test(t))
  return {decision:'ACT',meaning:'question',rule:'scheduling-question'};
 // Reminders, deadlines and expiries with a date.
 if(re('\\b(reminder|is due|are due|due (by|on|back|before)|closes|close at|expires?|expiry|don'+A+'t forget|renew|overdue)\\b').test(t)&&dated)
  return {decision:'ACT',meaning:'reminder',rule:'dated-reminder'};
 // Explicit requests.
 if(re(`\\b(please|could you|can you|kindly|ensure|make sure|bring|pay|return|send|sign|submit|reply|call|add|haven${A}t received)\\b`).test(t)){
  if(re('\\bend of term\\b|\\bsoon\\b|\\bwhen (you can|possible)\\b').test(t)&&!re(`\\b\\d{1,2}(st|nd|rd|th)? (${MONTH})\\b|${NUMERIC_DATE}`).test(t)&&!/\bas soon as\b/i.test(t))
   return {decision:'ASK',meaning:'request_unclear_deadline',rule:'request-without-date'};
  return {decision:'ACT',meaning:'request',rule:'explicit-request'};
 }
 if(re('\\bneed(s)? (their|a|an|to be)\\b').test(t)&&dated)
  return {decision:'ACT',meaning:'preparation',rule:'dated-preparation'};
 return {decision:'IGNORE',meaning:'no_action',rule:'no-responsibility-found'};
}
