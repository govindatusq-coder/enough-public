import type {Idea} from './ideas.ts';

export const movementModes=['walk','cycle','stairs','wheel','task','play','dance','seated'] as const;
export type MovementMode=typeof movementModes[number];
export type IdeaMovement={version:1;action:string;activityMinutes:number};

const normalise=(text:string)=>text.toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const bodyParts=/\b(?:arms?|shoulders?|torso|upper body|lower body|whole body|neck|back|legs?|knees?|ankles?|hips?|elbows?)\b/;
const mobility=/\b(?:stretch(?:es|ing)?|reach(?:es|ing)?|rais(?:e|es|ing)|lift(?:s|ing)?|lower(?:s|ing)?|circl(?:e|es|ing)|roll(?:s|ing)?|rotat(?:e|es|ing)|turn(?:s|ing)?|bend(?:s|ing)?|extend(?:s|ing)?|march(?:es|ing)?|pedal(?:s|ling|ing)?)\b/;
const patterns:Record<MovementMode,RegExp>={
 walk:/\b(?:walk(?:s|ing)?|stroll(?:s|ing)?|pac(?:e|es|ing)|take (?:a few |some |short |comfortable )?steps)\b/,
 cycle:/\b(?:cycl(?:e|es|ing)|bik(?:e|es|ing)|pedal(?:s|ling|ing)?)\b/,
 stairs:/\b(?:stairs?|staircase|steps? up|steps? down)\b/,
 wheel:/\b(?:wheel(?:s|ing)?|propel(?:s|ling)?|push(?:ing)? (?:your |the |a )?wheelchair)\b/,
 task:/\b(?:walk(?:s|ing)?|trips?|sweep(?:s|ing)?|mop(?:s|ping)?|rak(?:e|es|ing)|dig(?:s|ging)?|weed(?:s|ing)?|scrub(?:s|bing)?)\b/,
 play:/\b(?:walk(?:s|ing)?|danc(?:e|es|ing)|kick(?:s|ing)?|throw(?:s|ing)?|toss(?:es|ing)?|catch(?:es|ing)?|jump(?:s|ing)?|hop(?:s|ping)?|chase|chasing)\b/,
 dance:/\b(?:danc(?:e|es|ing)|sway(?:s|ing)?|step(?:s|ping)? to (?:the |your )?music)\b/,
 seated:mobility,
};

// A duration or a "seated" label alone cannot establish that an idea moves.
export function describesMovement(mode:string,text:string,legacy=false):boolean{
 if(!movementModes.includes(mode as MovementMode))return false;
 const action=normalise(text),pattern=patterns[mode as MovementMode];
 if(!legacy&&!/^(?:walk|stroll|pace|take|cycle|bike|pedal|ride|climb|wheel|propel|push|sweep|mop|rake|dig|weed|scrub|carry|lift|play|join|kick|throw|toss|catch|jump|hop|chase|dance|sway|step|stretch|reach|raise|lower|circle|roll|rotate|turn|bend|extend|march)\b/.test(action))return false;
 const match=action.match(pattern)||(mode==='task'&&bodyParts.test(action)?action.match(mobility):null);
 if(!match||match.index===undefined)return false;
 const before=action.slice(Math.max(0,match.index-32),match.index);
 if(/\b(?:no|not|don't|avoid|without|skip|instead of|rather than)\b[^.!;]{0,24}$/.test(before))return false;
 if(mode==='stairs'&&!/\b(?:climb(?:ing)?|walk(?:ing)?|take|go)\b/.test(action))return false;
 if(/\b(?:read|watch|listen|learn|talk|think)\b[^.!;]*\babout\b[^.!;]*$/.test(action.slice(0,match.index)))return false;
 if(mode==='seated'||mode==='task'){
  if(mode==='seated'&&!bodyParts.test(action))return legacy&&/\bseated stretch(?:es|ing)?\b/.test(action);
  if(/\b(?:fingers?|thumbs?|typing|knitting|sewing)\b/.test(action)&&!bodyParts.test(action))return false;
 }
 return true;
}

export function hasMovement(idea:Idea):boolean{
 if(idea.source==='library')return true;
 if(!idea.movement)return describesMovement(idea.movementMode,idea.body,true);
 const {action,activityMinutes,version}=idea.movement;
 return version===1&&Number.isInteger(idea.minutes)&&idea.minutes>=1&&idea.minutes<=60&&
  Number.isFinite(activityMinutes)&&activityMinutes>=idea.minutes&&activityMinutes<=240&&
  normalise(idea.body).includes(normalise(action))&&describesMovement(idea.movementMode,action);
}
