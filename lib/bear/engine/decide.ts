// Responsibility decision layer. Given what a message says, decide what (if anything) has changed about
// what the user needs to do. Pure and deterministic: no network, no model. Outputs one of
// ACT | ASK | WAIT | UPDATE | CLOSE | IGNORE. The default is IGNORE.
// This is a RULE-BASED baseline. An LLM-backed decider can replace it later, but must beat this on the
// same labelled set (evaluation/dataset/decisions.json) before it is used.
export type Decision='ACT'|'ASK'|'WAIT'|'UPDATE'|'CLOSE'|'IGNORE';
export interface Decided{decision:Decision;meaning:string;rule:string}

const has=(t:string,re:RegExp)=>re.test(t);

export function decide(text:string):Decided{
 const t=text.replace(/\s+/g,' ').trim();
 const lower=t.toLowerCase();
 // 1. Confirmations: something the user did or sent has been received. Closes an existing item; never creates one.
 if(has(lower,/\b(we(’|')ve| we have) received your|payment (received|of \$[\d.,]+ (for|has been))|thank you for (submitting|your payment)|has been (paid|submitted)\b/))
  return {decision:'CLOSE',meaning:'confirmation',rule:'receipt-or-submission'};
 // 2. Cancellations and changes to something already tracked.
 if(has(lower,/\b(appointment)\b.*\b(cancel+ed)\b|\b(cancel+ed)\b.*\bappointment\b/))
  return {decision:'CLOSE',meaning:'cancellation',rule:'appointment-cancelled'};
 if(has(lower,/\b(cancel+ed|cancellation)\b|\bnow on\b|\bchange of date\b|\brescheduled\b|\bmoved to\b/))
  return {decision:'UPDATE',meaning:'change',rule:'cancelled-or-moved'};
 // 3. Someone else owns the action, or the message says nothing is needed.
 if(has(lower,/\bnothing for you to do\b|\byou don(’|')t need to do anything\b|\bno action (is )?required\b|\bno payment is needed\b/))
  return {decision:'IGNORE',meaning:'no_action',rule:'explicitly-no-action'};
 if(has(lower,/\b(i(’|')ll|i will|jo is|someone is|we(’|')ll) (organise|organize|book|pick up|handle|arrange)\b/))
  return {decision:'IGNORE',meaning:'delegated',rule:'someone-else-owns-it'};
 // 4. Waiting on someone else's reply or decision.
 if(has(lower,/\bhaven(’|')t heard back\b|\bstill waiting\b|\bwe will (be in touch|let you know)\b|\bonce it has been assessed\b/))
  return {decision:'WAIT',meaning:'waiting',rule:'awaiting-reply-or-decision'};
 // 5. Optional replies and small talk.
 if(has(lower,/^(let me know|if you (have|would like|’d like|'d like))\b/)||has(lower,/\blet me know if\b/))
  return {decision:'IGNORE',meaning:'optional_reply',rule:'let-me-know-if'};
 // 6. Information that might matter but asks nothing clear: one question, not a task.
 if(has(lower,/\bjust (confirming|a heads up)\b/))
  return {decision:'ASK',meaning:'information',rule:'fyi-without-request'};
 // 7. Reminders and explicit requests with a date or a clear verb.
 const dated=has(lower,/\b(by|due|on|before|starts?|from) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}( |$)|the \d|end of)|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bdue\b/);
 if(has(lower,/\b(reminder|is due|due by|due on)\b/)&&dated)
  return {decision:'ACT',meaning:'reminder',rule:'dated-reminder'};
 if(has(lower,/\b(please|could you|can you|bring|pay|return|send|sign|submit)\b/)){
  if(has(lower,/\bend of term\b|\bsoon\b|\bwhen (you can|possible)\b/)&&!has(lower,/\b\d{1,2} (november|december|january|february|march|april|may|june|july|august|september|october)\b/))
   return {decision:'ASK',meaning:'request_unclear_deadline',rule:'request-without-date'};
  return {decision:'ACT',meaning:'request',rule:'explicit-request'};
 }
 if(has(lower,/\bneed (their|a|an|to be)\b/)&&dated)
  return {decision:'ACT',meaning:'preparation',rule:'dated-preparation'};
 return {decision:'IGNORE',meaning:'no_action',rule:'no-responsibility-found'};
}
