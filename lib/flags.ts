/**
 * Feature flags. `adaptiveGoalFittingV1` turns on what happens after "I'd do
 * that" (goal fitting, invitations, check-ins and the follow-through views).
 * The suggestion system is identical either way.
 *
 * Off for everyone: set NEXT_PUBLIC_ADAPTIVE_GOAL_FITTING_V1=off and redeploy.
 * Compare in one browser: add ?adaptiveGoalFittingV1=off (or =on) to the URL;
 * the choice is remembered on that device.
 */
export const ADAPTIVE_GOAL_FITTING_V1='adaptiveGoalFittingV1';
const STORAGE='enough.flag.'+ADAPTIVE_GOAL_FITTING_V1;
export function adaptiveGoalFittingV1(env=process.env.NEXT_PUBLIC_ADAPTIVE_GOAL_FITTING_V1,search?:string,storage?:Pick<Storage,'getItem'|'setItem'>):boolean{
 let local:string|null=null;
 try{
  const asked=search?new URLSearchParams(search).get(ADAPTIVE_GOAL_FITTING_V1):null;
  if(asked==='on'||asked==='off')storage?.setItem(STORAGE,asked);
  local=asked??storage?.getItem(STORAGE)??null;
 }catch{}
 if(local==='on'||local==='off')return local==='on';
 return env!=='off';
}
