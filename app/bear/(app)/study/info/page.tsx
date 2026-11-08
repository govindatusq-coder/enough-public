import {TopBar} from '@/components/bear/ui';
// Participant information, in plain words. The full version (with researcher and ethics contacts) is in
// docs/research/PARTICIPANT_INFORMATION_AND_CONSENT.md and must be filled in before inviting anyone.
export default function StudyInfo(){
 return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/me'}}/>
  <h1 style={{fontSize:26}}>About the Load Bear study</h1>
  <div className="section"><div className="card"><p style={{fontWeight:700}}>What it’s about</p><p className="small" style={{marginTop:6}}>Whether Load Bear makes keeping on top of household admin feel lighter and take less time.</p></div>
  <div className="card"><p style={{fontWeight:700}}>What you’d do</p><p className="small" style={{marginTop:6}}>Use Load Bear as you normally would for six weeks. Answer a starting survey (about 4 minutes), a one-minute check-in each week, and a final survey (about 6 minutes). You can skip any question.</p></div>
  <div className="card"><p style={{fontWeight:700}}>What researchers see</p><p className="small" style={{marginTop:6}}>Your survey answers, and counts such as how many things you gave Bear, how many reminders you got and how many things were done, under a code instead of your name.</p><p className="small" style={{marginTop:6}}>They never see what your items say, your documents, names, children’s details, amounts or anything you type.</p></div>
  <div className="card"><p style={{fontWeight:700}}>Your choices</p><p className="small" style={{marginTop:6}}>Taking part is voluntary. You can leave at any time in Settings, with the option to delete your answers. Leaving doesn’t change how Load Bear works for you.</p></div>
  <div className="card"><p style={{fontWeight:700}}>Questions or concerns</p><p className="small" style={{marginTop:6}}>Contact details for the research team and the ethics committee are in your invitation.</p></div></div>
 </main>;
}
