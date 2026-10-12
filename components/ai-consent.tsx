'use client';
import {AI_CONSENT_VERSION,aiConsentLabels,type AiConsent,type AiConsentChoice} from '@/lib/ai-consent';

export function AiConsentOptions({onChoose,disabled=false}:{onChoose:(choice:AiConsentChoice)=>void;disabled?:boolean}){
 return <div className="ai-consent-options">
  <p>OpenAI prepares fresh ideas and illustrative pictures when you request suggestions. It processes information in the United States.</p>
  <p>With your permission, we send your PINS, routines and activity feedback. Needs can include health information, such as pain, fatigue or recovery. For pictures, we send the suggested activity and its scene details.</p>
  <p>Your name, uploaded photos, companion records and visual preferences are not sent. Avoid identifying details in written answers.</p>
  <div className="consent-choices">
   <button className="secondary" disabled={disabled} onClick={()=>onChoose('full')}><strong>{aiConsentLabels.full}</strong><span>Include my needs to help OpenAI shape ideas.</span></button>
   <button className="secondary" disabled={disabled} onClick={()=>onChoose('without-health')}><strong>{aiConsentLabels['without-health']}</strong><span>Send approved non-health choices only. Leave out health needs, usual-day activity, written notes and earlier AI text. ENOUGH still checks every idea against all my needs before showing it.</span></button>
   <button className="secondary" disabled={disabled} onClick={()=>onChoose('declined')}><strong>{aiConsentLabels.declined}</strong><span>Keep using the library without new OpenAI requests.</span></button>
  </div>
  <p className="sample-note">The reduced option may return fewer ideas. It does not generate missing pictures for older ideas, which may contain earlier health context. You can change your choice in My Pins → AI and privacy. Changing it stops future requests; it cannot recall information already sent.</p>
  <a className="text-button privacy-link" href="/privacy" target="_blank" rel="noopener noreferrer">Read the draft privacy notice <span className="sr-only">(opens in a new tab)</span></a>
 </div>;
}
export function AiPrivacySettings({consent,onChange,disabled=false}:{consent?:AiConsent;onChange:()=>void;disabled?:boolean}){
 const current=consent?.version===AI_CONSENT_VERSION;
 return <section className="ai-privacy-settings" aria-labelledby="ai-privacy-heading">
  <h2 id="ai-privacy-heading">AI and privacy</h2>
  <p>{current?`Your choice: ${aiConsentLabels[consent.choice]}.`:'No current AI permission. The library is still available.'}</p>
  {current&&<p className="sample-note">Chosen {new Date(consent.decidedAt).toLocaleDateString('en-AU')}. Consent version {consent.version}.</p>}
  <div className="action-row"><button className="secondary" disabled={disabled} onClick={onChange}>{current?'Change AI choice':'Choose AI permission'}</button><a className="text-button privacy-link" href="/privacy">Privacy notice</a></div>
 </section>;
}
