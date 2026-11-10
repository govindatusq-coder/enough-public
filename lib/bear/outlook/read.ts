// Bear's first read of an email, in words the panel shows. The decision itself comes from engine/decide.ts and
// runs inside the panel, so the email text isn't sent anywhere before the person taps. Nothing here adds
// anything by itself: it only changes what the panel suggests.
import type {Decision} from '../engine/decide.ts';
export interface Read{headline:string;detail:string;button:string;primary:boolean}
export function presentRead(d:Decision):Read{
 switch(d){
  case 'ACT':return {headline:'Looks like something for you',detail:'It asks you to do something. Bear can track it.',button:'Give this to Bear',primary:true};
  case 'ASK':return {headline:'This might matter to you',detail:'It isn’t clear it’s for you. Give it to Bear if you want it tracked.',button:'Track this',primary:true};
  case 'WAIT':return {headline:'Looks like you’re waiting on someone',detail:'Bear can track the reply so you don’t have to remember.',button:'Track what I’m waiting for',primary:true};
  case 'UPDATE':return {headline:'This looks like a change',detail:'It may change something you already track. Giving it to Bear checks.',button:'Give this to Bear',primary:true};
  case 'CLOSE':return {headline:'This looks like a confirmation',detail:'Something may be done. Bear won’t close anything without your say.',button:'Give this to Bear',primary:false};
  default:return {headline:'Nothing here looks like it needs you',detail:'Bear’s first read is that this is just for information.',button:'Give it to Bear anyway',primary:false};
 }
}
export const READ_CHOICES:{label:string;value:Decision}[]=[
 {label:'It needs me',value:'ACT'},{label:'Ask me first',value:'ASK'},{label:'I’m waiting',value:'WAIT'},
 {label:'A change',value:'UPDATE'},{label:'It’s done',value:'CLOSE'},{label:'Nothing',value:'IGNORE'},
];
