// Web personas for the System A (suggestion) regression baseline and the
// System B (goal fitting) tests. `lifeMap`, `feedback` and `moments` are the
// only inputs the suggestion engine reads. `fitting` holds the newer Life Map
// answers the engine must ignore; the regression test runs each persona with
// and without it and expects identical suggestions.
import {emptyLifeMap} from '../../lib/life-map.ts';

export const NOW=new Date('2026-10-26T09:00:00Z');
const at=(daysAgo,hour=9)=>new Date(NOW.getTime()-daysAgo*864e5+(hour-9)*36e5).toISOString();
const map=patch=>({...emptyLifeMap(),hardNosAnswered:true,onboardingCompleted:true,updatedAt:'2026-10-20T08:00:00.000Z',...patch});
const accept=(id,opportunityId,daysAgo,surface='home')=>({id,opportunityId,response:'accept',surface,at:at(daysAgo),profile:{contexts:['desk','calls'],extraTime:'few'}});
const reject=(id,opportunityId,daysAgo,reason)=>({id,opportunityId,response:'reject',surface:'home',at:at(daysAgo),profile:{contexts:['desk','calls'],extraTime:'few'},...(reason?{reason}:{})});
const done=(id,opportunityId,daysAgo,minutes,extraMinutes=0)=>({id,opportunityId,status:'done',plannedAt:at(daysAgo,8),doneAt:at(daysAgo,12),minutes,extraMinutes});

/** The production profile that produces "Camera off, feet on" as the best fit. */
const cameraOff=()=>map({contexts:['desk','calls'],moments:['listening-meeting','long-desk'],styles:['wander','outside'],hardNos:['colleagues'],extraTime:'few',permissions:{'listening-call':'yes',desk:'maybe'}});

export const personas=[
 {id:'camera-off',label:'Core acceptance: listening meetings',lifeMap:cameraOff(),fitting:{goalFeel:'flexible',suggestStyle:'nudge',friction:['time']}},
 {id:'busy-parent',label:'1. Busy working parent',lifeMap:map({contexts:['kids','driving','calls','desk'],moments:['kid-activity-wait','school-run','listening-call','listening-meeting','long-desk','short-car-trip'],styles:['wander','outside'],hardNos:['public'],extraTime:'none',permissions:{'kid-wait':'yes','listening-call':'yes','school-run':'maybe',desk:'maybe','nearby-shop':'no'}}),fitting:{friction:['time','childcare','unpredictable-work'],workPattern:'regular',goalFeel:'flexible',suggestStyle:'nudge'}},
 {id:'demand-sensitive',label:'2. High demand sensitivity',lifeMap:map({contexts:['desk','calls','home'],moments:['listening-call','long-desk','cooking-dinner','watching-tv'],styles:['wander','useful'],extraTime:'few',permissions:{'listening-call':'maybe',cooking:'maybe',tv:'maybe'}}),fitting:{friction:['dislike-exercise'],goalFeel:'told-what-to-do',suggestStyle:'low-pressure'}},
 {id:'low-energy',label:'3. Low-energy user',lifeMap:map({contexts:['home','downtime'],moments:['watching-tv','listening-podcasts','chores','cooking-dinner'],styles:['bursts','useful'],hardNos:['sweating','floor'],extraTime:'none',permissions:{tv:'maybe',cooking:'yes'}}),fitting:{friction:['fatigue'],goalFeel:'depends',suggestStyle:'low-pressure'}},
 {id:'physical',label:'4. Physical constraints',lifeMap:map({contexts:['home','errands','catchups'],moments:['grocery-shop','appointment-wait','coffee','chores'],styles:['wander','people'],hardNos:['stairs','floor','running','jumping','high-impact'],extraTime:'few',permissions:{'nearby-shop':'maybe',coffee:'yes',early:'maybe'},profiling:{'walk-ten-comfortable':'good-days'}}),fitting:{friction:['pain'],goalFeel:'flexible',suggestStyle:'options'}},
 {id:'cost-constrained',label:'5. Financially constrained',lifeMap:map({contexts:['commuting','errands','home'],moments:['public-transport','grocery-shop','chores','arriving-early'],styles:['destination','useful'],hardNos:['equipment'],extraTime:'few',permissions:{transport:'yes','nearby-shop':'yes',early:'maybe'}}),fitting:{friction:['cost','time'],goalFeel:'helpful',suggestStyle:'commit'}},
 {id:'shift-worker',label:'6. Shift worker',lifeMap:map({contexts:['driving','home','errands','downtime'],moments:['short-car-trip','watching-tv','takeaway-wait','grocery-shop'],styles:['wander','destination'],extraTime:'few',permissions:{'nearby-shop':'maybe',tv:'maybe'}}),fitting:{friction:['unpredictable-work','fatigue'],workPattern:'shifts',goalFeel:'depends',suggestStyle:'nudge'}},
 {id:'already-active',label:'7. Already active today',lifeMap:cameraOff(),feedback:[accept('f7a','call-meeting-walk',6)],moments:[done('m7a','call-meeting-walk',6,15)],fitting:{goalFeel:'helpful',suggestStyle:'nudge'}},
 {id:'shorter',label:'8. Repeatedly accepts shorter movement',lifeMap:cameraOff(),feedback:[accept('f8a','call-meeting-walk',9)],moments:[done('m8a','call-meeting-walk',9,8)],fitting:{friction:['time'],goalFeel:'flexible',suggestStyle:'nudge'}},
 {id:'declining',label:'9. Consistently declines prompts',lifeMap:cameraOff(),feedback:[accept('f9a','call-meeting-walk',12),reject('f9b','work-walk-not-message',5,'wrong-moment')],moments:[{id:'m9a',opportunityId:'call-meeting-walk',status:'skipped',plannedAt:at(12),minutes:15,extraMinutes:0}],fitting:{goalFeel:'resist',suggestStyle:'low-pressure'}},
 {id:'extender',label:'10. Enjoys and extends movement',lifeMap:cameraOff(),feedback:[accept('f10a','call-meeting-walk',8)],moments:[done('m10a','call-meeting-walk',8,25)],fitting:{goalFeel:'helpful',suggestStyle:'commit'}},
 {id:'older-adult',label:'Earlier persona: 65+ at home',lifeMap:map({contexts:['home','errands','downtime'],moments:['watching-tv','grocery-shop','appointment-wait','weekend-errands','chores','arriving-early'],styles:['wander','useful'],hardNos:['running','high-impact','jumping','floor'],extraTime:'more',permissions:{tv:'maybe','nearby-shop':'maybe',early:'yes',cooking:'maybe'}}),fitting:{extraTimeVaries:true}},
 {id:'exercise-averse',label:'Earlier persona: exercise-averse office worker',lifeMap:map({contexts:['desk','driving','calls','downtime'],moments:['long-desk','listening-call','short-car-trip','watching-tv','listening-meeting'],styles:['useful','bursts'],hardNos:['sweating','public','colleagues','floor'],extraTime:'none',permissions:{'listening-call':'maybe',desk:'maybe',tv:'maybe','nearby-shop':'no'}}),fitting:{friction:['dislike-exercise','time'],goalFeel:'resist',suggestStyle:'options'}}
];
