import type {Tone} from './types.ts';
// Brand voice. Bear never reminds users that they have failed; it offers to make things easier.
export const brand={
 name:'Load Bear',promise:'Your mental load is ours to bear.',areasLine:'Work. Family. Home. Money. Health. You.',
 gotYou:"Mama Bear's got you.",giveIt:'Give it to Bear',bearsGotIt:"Bear's got it.",oneLess:'One less thing to carry.',
 captureHeading:'Give it to Bear.',captureSub:"Tell me what's on your mind. I'll remember it.",
 thinking:['Finding the important bits…','Checking when you need to act…','Making sure there’s enough time…','Working out what’s worth a reminder…'],
 verifyHeading:'Have I got this right?',verifyCta:"Yep, Bear's got it",
 emptyNeeds:'Nothing needs you right now.',emptyNeedsSub:"Bear's got the rest.",
 notYet:'Nothing else needs your attention.',notYetSub:'You can stop thinking about it for now.',
 winsHeading:'My Wins',winsSub:"The work you do shouldn't be invisible.",winsEmpty:'Your wins will show up here.',
 ideasHeading:'Bear noticed…',ideasEmpty:"Nothing to suggest right now. When Bear notices a pattern worth acting on, it'll show up here.",
 chaosReply:"Got you. I'll only bring you things that genuinely can't wait.",
 reinforcement:['One less thing to carry.',"Bear's got the rest.","That's sorted."],
};
export const banned=/overdue!|you missed|you still haven|tasks overdue/i;
export function greeting(hour:number,name:string){const part=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';return name?`${part}, ${name}.`:`${part}.`;}
export function withTone(tone:Tone,warm:string,direct:string,cheeky:string){return tone==='direct'?direct:tone==='cheeky'?cheeky:warm;}
export const dayModeReply:Record<string,string>={good:"Lovely. Bear will keep things light.",full:"Noted. Bear will only bring you what's useful today.",wiped:"Understood. Rest is the plan. Bear will hold the rest.",chaos:brand.chaosReply};
