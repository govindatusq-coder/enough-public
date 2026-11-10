import {flags} from '@/lib/bear/flags';
export const dynamic='force-dynamic';
// Is Bear's first read of an email switched on? No account data, no email text: just the switch.
export const GET=()=>Response.json({enabled:flags.decisions()},{headers:{'Cache-Control':'private, no-store'}});
