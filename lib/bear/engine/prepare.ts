// Things Bear can really prepare today, with no integration: a calendar file the person opens to add the event
// themselves (so it's "prepared", never "added to your calendar"). RFC 5545, all-day event, text escaped and folded.
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
function fold(line:string){const out:string[]=[];let cur='';let bytes=0;for(const ch of line){const b=Buffer.byteLength(ch);if(bytes+b>74){out.push(cur);cur=' '+ch;bytes=1+b;}else{cur+=ch;bytes+=b;}}out.push(cur);return out.join('\r\n');}
const compact=(d:string)=>d.replace(/-/g,'');
export interface CalendarEvent{uid:string;title:string;date:string;endDate?:string|null;description?:string|null;stamp?:Date}
export function calendarEventIcs(e:CalendarEvent):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date))throw new Error('invalid_date');
 const next=(()=>{const d=new Date(e.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);})();
 const end=e.endDate&&/^\d{4}-\d{2}-\d{2}$/.test(e.endDate)?(()=>{const d=new Date(e.endDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);})():next;
 const stamp=(e.stamp||new Date()).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Load Bear//Prepared event//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
  `UID:${e.uid.replace(/[^A-Za-z0-9-]/g,'')}@loadbear`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${compact(e.date)}`,`DTEND;VALUE=DATE:${compact(end)}`,
  `SUMMARY:${esc(e.title)}`,...(e.description?[`DESCRIPTION:${esc(e.description)}`]:[]),'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
