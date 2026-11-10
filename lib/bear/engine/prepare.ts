// Things Bear can really prepare today, with no integration: a calendar file the person opens to add the event
// themselves (so it's "prepared", never "added to your calendar"). RFC 5545, all-day event, text escaped and folded.
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
function fold(line:string){const out:string[]=[];let cur='';let bytes=0;for(const ch of line){const b=Buffer.byteLength(ch);if(bytes+b>74){out.push(cur);cur=' '+ch;bytes=1+b;}else{cur+=ch;bytes+=b;}}out.push(cur);return out.join('\r\n');}
const compact=(d:string)=>d.replace(/-/g,'');
export interface CalendarEvent{uid:string;title:string;date:string;endDate?:string|null;time?:string|null;location?:string|null;description?:string|null;stamp?:Date}
// "10:30", "10:30am", "2pm", "14:00" -> "HH:MM", or null. Bear never invents a time.
export function parseTime(t?:string|null):string|null{
 const m=/^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(t||'');if(!m)return null;
 let h=+m[1];const min=m[2]?+m[2]:0;const ap=m[3]?.toLowerCase();
 if(min>59||h>23||(ap&&(h<1||h>12)))return null;if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;
 return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
export function calendarEventIcs(e:CalendarEvent):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date))throw new Error('invalid_date');
 const next=(()=>{const d=new Date(e.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);})();
 const end=e.endDate&&/^\d{4}-\d{2}-\d{2}$/.test(e.endDate)?(()=>{const d=new Date(e.endDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);})():next;
 const stamp=(e.stamp||new Date()).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const time=parseTime(e.time);
 // Floating local time (no zone): the person's calendar shows it at that clock time wherever they are. Length wasn't
 // given, so a timed event is set to one hour and says so; an event with no time is an all-day event.
 const when=time?(()=>{const [h,m]=time.split(':').map(Number);const eh=(h+1)%24;const endDay=h+1>23?next:e.date;return [`DTSTART:${compact(e.date)}T${time.replace(':','')}00`,`DTEND:${compact(endDay)}T${String(eh).padStart(2,'0')}${String(m).padStart(2,'0')}00`];})():[`DTSTART;VALUE=DATE:${compact(e.date)}`,`DTEND;VALUE=DATE:${compact(end)}`];
 const desc=[e.description,time?'Length wasn’t given, so this is set to one hour.':null].filter(Boolean).join('\n');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Load Bear//Prepared event//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
  `UID:${e.uid.replace(/[^A-Za-z0-9-]/g,'')}@loadbear`,`DTSTAMP:${stamp}`,...when,
  `SUMMARY:${esc(e.title)}`,...(e.location?[`LOCATION:${esc(e.location)}`]:[]),...(desc?[`DESCRIPTION:${esc(desc)}`]:[]),'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
