// What is a form field for, and what may Bear do about it? Decided from the field's name only, by fixed rules:
// no model, so a hostile PDF can't talk Bear into filling something. The rule that matters most: anything that is a
// decision or an attestation by the parent (consent, signature, medical, allergy, emergency contact, photo
// permission, payment, the date signed) is NEVER filled and never remembered. Unknown fields are left alone.
export type FieldRole='student_name'|'student_first'|'student_last'|'class_year'|'event_name'|'event_date'|'school'|'parent_name'|'phone'|'email'|'address'
 |'signature'|'date_signed'|'consent'|'medical'|'allergy'|'emergency'|'photo'|'payment'|'other';
export type FieldPolicy='fill_verified'|'fill_remembered'|'parent_decision'|'leave';
export const POLICY:Record<FieldRole,FieldPolicy>={
 student_name:'fill_verified',student_first:'fill_verified',student_last:'fill_verified',class_year:'fill_verified',event_name:'fill_verified',event_date:'fill_verified',school:'fill_verified',
 parent_name:'fill_remembered',phone:'fill_remembered',email:'fill_remembered',address:'fill_remembered',
 signature:'parent_decision',date_signed:'parent_decision',consent:'parent_decision',medical:'parent_decision',allergy:'parent_decision',emergency:'parent_decision',photo:'parent_decision',payment:'parent_decision',
 other:'leave',
};
// Only these details may be remembered for the next form. Never a decision, never anything medical.
export const REMEMBERABLE:FieldRole[]=['parent_name','phone','email','address'];
export const normalise=(name:string)=>name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[^A-Za-z0-9]+/g,' ').toLowerCase().trim();
export function classifyField(name:string,kind:'text'|'checkbox'|'radio'|'dropdown'|'signature'|'button'|'other'='text'):FieldRole{
 const n=normalise(name);const has=(re:RegExp)=>re.test(n);
 if(kind!=='signature'&&has(/\bdate\b.*\bsign|\bsign.*\bdate\b|\bdate signed\b/))return 'date_signed';
 if(kind==='signature'||has(/\bsignature\b|\bsign(ed)? here\b|\bsigned by\b/))return 'signature';
 // Health and safety come before everything else, so "emergency phone" is an emergency contact, not a phone number.
 if(has(/\ballerg|\banaphyla|\bepipen\b|\bepi pen\b/))return 'allergy';
 if(has(/\bmedical|\bmedication|\bcondition|\bdoctor|\bhealth|\basthma|\bdiagnos|\bimmunis|\bvaccin|\bdietary|\bdiet\b|\bdisabilit/))return 'medical';
 if(has(/\bemergency|\bnext of kin|\balternate contact/))return 'emergency';
 if(has(/\bphoto|\bmedia release|\bimage release|\bvideo\b/))return 'photo';
 if(has(/\bpayment|\bpay\b|\bcard\b|\bamount|\bfee\b|\bbank|\bbsb\b|\baccount number|\bcvv\b|\bexpiry/))return 'payment';
 if(has(/\bconsent|\bpermission|\bauthori[sz]|\bagree|\bapprove|\bdeclar|\bgive permission|\bi do\b|\bi do not\b/))return 'consent';
 // Any other tick box is a decision by the parent, whatever it is called.
 if(kind==='checkbox'||kind==='radio')return 'consent';
 if(has(/\bphone|\bmobile|\bcontact number|\btelephone/))return 'phone';
 if(has(/\bemail|\be mail/))return 'email';
 if(has(/\baddress|\bstreet|\bsuburb|\bpostcode|\bpost code/))return 'address';
 if(has(/\bparent|\bguardian|\bcarer|\bmother|\bfather/)&&has(/\bname\b|\bfull name\b/))return 'parent_name';
 if(has(/\bparent|\bguardian|\bcarer/)&&!has(/\bsign/))return 'parent_name';
 if(has(/\b(student|child|pupil)\b/)&&has(/\bfirst\b|\bgiven\b/))return 'student_first';
 if(has(/\b(student|child|pupil)\b/)&&has(/\blast\b|\bsurname\b|\bfamily\b/))return 'student_last';
 if(has(/\b(student|child|pupil)\b/)&&has(/\bname\b/))return 'student_name';
 if(has(/\b(year|class|grade|homeroom)\b/))return 'class_year';
 if(has(/\b(event|excursion|camp|trip|activity)\b/)&&has(/\bdate|\bwhen\b/))return 'event_date';
 if(has(/\b(event|excursion|camp|trip|activity)\b/))return 'event_name';
 if(has(/\bschool\b/))return 'school';
 return 'other';
}
