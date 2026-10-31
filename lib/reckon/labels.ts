import type {RouteFunction, ItemStatus, ExperimentStatus, OSSection} from './types.ts';

export const ROUTE_LABELS: Record<RouteFunction, {label: string; hint: string}> = {
  KNOW: {label: 'Help me understand this', hint: 'Something to make sense of'},
  THINK: {label: 'Help me think differently', hint: 'A new way of seeing something'},
  DO: {label: 'Help me use this', hint: 'Something to try in real life'},
  FEEL: {label: 'Have this ready when I need it', hint: 'Reassurance, steadiness, permission'},
  RELATE: {label: 'Help me with the people in my life', hint: 'For relationships and conversations'},
  BECOME: {label: 'Something I want to live by', hint: 'A principle, a way of being'},
  CREATE: {label: "A spark for something I'm making", hint: 'For a project or idea'},
  REMEMBER: {label: 'Just keep it', hint: 'Worth remembering, nothing more needed'},
};
export const ROUTE_ORDER: RouteFunction[] = ['DO', 'THINK', 'FEEL', 'BECOME', 'RELATE', 'KNOW', 'CREATE', 'REMEMBER'];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {KEPT: 'Kept', EXPLORING: 'Exploring', TRYING: 'Trying', WORKING: 'Working', INTEGRATED: 'Integrated', RETIRED: 'Retired'};
export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {trying: 'Trying', working: 'Working', generalising: 'Generalising', integrated: 'Integrated', retired: 'Retired'};

export const OS_SECTIONS: {id: OSSection; title: string; hint: string}[] = [
  {id: 'matters', title: 'What matters to me', hint: 'Only directions you have stated yourself.'},
  {id: 'returning', title: 'Ideas I keep returning to', hint: 'Threads you confirmed.'},
  {id: 'patterns', title: "Patterns I'm noticing", hint: 'Noticed together in conversation.'},
  {id: 'principles', title: 'Principles I want to live by', hint: 'Things you said you want to live by.'},
  {id: 'helps', title: 'What seems to help', hint: 'From your own reflections, cautiously.'},
  {id: 'doesnt_help', title: "What doesn't seem to help", hint: 'Also from your reflections. Advice is not assumed to be right.'},
  {id: 'figuring_out', title: "Things I'm still figuring out", hint: 'Low confidence, unresolved.'},
];

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? 'Still up.' : h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
}
