import {flags} from '../flags.ts';
import {billsPack,carPack,familyPack,healthPack,homePack} from './packs/definitions.ts';
import {schoolPack} from './packs/school.ts';
import type {CoveragePack,PackId} from './types.ts';

// The Coverage Pack registry. Only School Admin is a full pack today.
export const packs:CoveragePack[]=[schoolPack,billsPack,carPack,homePack,familyPack,healthPack];
export const packById=(id:PackId)=>packs.find(p=>p.id===id)||null;
export const availablePacks=()=>flags.coveragePacks()?packs.filter(p=>p.status==='full'):[];
