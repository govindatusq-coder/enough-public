import type {RhythmBlock} from './types.ts';
export const categoryLabels:Record<string,string>={electricity:'Electricity',gas:'Gas',water:'Water',internet:'Internet',mobile:'Mobile phone',council_rates:'Council rates',car_registration:'Car registration',insurance:'Insurance',school_fees:'School fees',childcare:'Childcare',sports_fees:'Sports fees',subscription:'Subscription',rent:'Rent',strata:'Strata',medical:'Medical',other:'Bill'};
export const areaLabels:Record<string,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
// Default rhythm blocks a user can switch on. Minutes from midnight; capacity is Bear's
// prior for how much room there usually is during that block.
export const rhythmPresets:Omit<RhythmBlock,'id'>[]=[
 {kind:'morning_rush',label:'Morning rush',days:['mon','tue','wed','thu','fri'],startMinute:6*60+30,endMinute:8*60+30,capacity:'none'},
 {kind:'commute',label:'Commute',days:['mon','tue','wed','thu','fri'],startMinute:8*60+30,endMinute:9*60+15,capacity:'low'},
 {kind:'work',label:'Work',days:['mon','tue','wed','thu','fri'],startMinute:9*60,endMinute:17*60,capacity:'low'},
 {kind:'school_run',label:'School run',days:['mon','tue','wed','thu','fri'],startMinute:15*60,endMinute:15*60+45,capacity:'none'},
 {kind:'after_school',label:'After-school activities',days:['mon','tue','wed','thu','fri'],startMinute:15*60+45,endMinute:17*60+30,capacity:'none'},
 {kind:'dinner',label:'Dinner',days:['mon','tue','wed','thu','fri','sat','sun'],startMinute:17*60+30,endMinute:19*60,capacity:'none'},
 {kind:'bedtime',label:'Bedtime',days:['mon','tue','wed','thu','fri','sat','sun'],startMinute:19*60,endMinute:20*60,capacity:'none'},
 {kind:'admin',label:'Admin time',days:['tue','thu'],startMinute:20*60,endMinute:21*60,capacity:'good'},
 {kind:'my_time',label:'My time',days:['wed','sat'],startMinute:20*60,endMinute:21*60+30,capacity:'good'},
 {kind:'sleep',label:'Sleep',days:['mon','tue','wed','thu','fri','sat','sun'],startMinute:22*60,endMinute:6*60+30,capacity:'none'},
 {kind:'weekend',label:'Weekend activities',days:['sat','sun'],startMinute:9*60,endMinute:13*60,capacity:'low'},
];
