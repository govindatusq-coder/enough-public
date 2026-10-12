export const WEEK_ROLES = ['Work','Looking after kids','Caring for someone','Retired','Study','Something else'] as const;
export const DAY_PLACES = ['Mostly home','Mostly workplace','Home + workplace','Out and about','It changes a lot'] as const;
export const ENOUGH_GOALS = ['Fit movement into a busy day','Break up sitting','Feel stronger','Move more comfortably','Clear my head','Keep doing things independently','Get outside more','Do something while I’m waiting','I’m just curious'] as const;
export const FRICTIONS = ['If it adds time','If people can see me doing it','If I need to change clothes','If I need equipment','If someone else has to join','If it feels too easy','If it feels like a workout','None of these bother me'] as const;

export type WeekRole = typeof WEEK_ROLES[number];
export type DayPlace = typeof DAY_PLACES[number];
export type EnoughGoal = typeof ENOUGH_GOALS[number];
export type Friction = typeof FRICTIONS[number];

export type OpportunityProfile = {
  roles: WeekRole[];
  dayPlace?: DayPlace;
  goals: EnoughGoal[];
  frictions: Friction[];
  work?: {
    pattern?: 'Mostly sitting'|'A mix of sitting and moving'|'Mostly on my feet'|'It varies';
    moments: string[];
    visibility?: 'Fine with it'|'Only if it looks normal'|'I’d rather keep it private';
  };
  caring?: {
    childAges: string[];
    onlyAdult?: 'Usually'|'Sometimes'|'Rarely';
    moments: string[];
    company?: 'Something by myself'|'Something the kids can join'|'Either';
  };
  laterLife?: {
    capability?: 'I’m active and happy to be challenged'|'I get around comfortably but want to do a bit more'|'I’d prefer gentle or supported movement'|'Walking or balance can sometimes be difficult';
    routines: string[];
    payoffs: string[];
  };
};

export const emptyOpportunityProfile = ():OpportunityProfile => ({roles:[],goals:[],frictions:[]});

export function needsWorkQuestions(p:OpportunityProfile){return p.roles.includes('Work')||p.roles.includes('Study');}
export function needsCaringQuestions(p:OpportunityProfile){return p.roles.includes('Looking after kids');}
export function needsLaterLifeQuestions(p:OpportunityProfile){return p.roles.includes('Retired');}

/** Ask only questions that can change recommendation eligibility or ranking. */
export function nextOpportunitySection(p:OpportunityProfile){
  if(!p.roles.length)return 'roles';
  if(!p.dayPlace)return 'place';
  if(!p.goals.length)return 'goals';
  if(needsWorkQuestions(p)&&(!p.work?.pattern||!p.work.visibility))return 'work';
  if(needsCaringQuestions(p)&&(!p.caring?.childAges.length||!p.caring.company))return 'caring';
  if(needsLaterLifeQuestions(p)&&(!p.laterLife?.capability||!p.laterLife.payoffs.length))return 'later-life';
  if(!p.frictions.length)return 'friction';
  return 'complete';
}

export function opportunityComplete(p:OpportunityProfile){return nextOpportunitySection(p)==='complete';}
