// Feature flags for controlled testing and rollback. All on unless set to "off" in the environment.
const on=(name:string)=>process.env[name]!=='off';
export const flags={
 priorityEngineV1:()=>on('BEAR_PRIORITY_ENGINE_V1'),
 priorityEngineV2:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_PRIORITY_ENGINE_V2'),     // importance hierarchy, traffic lights, work roles
 strategicAttentionV1:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_STRATEGIC_ATTENTION_V1'),
 mentalLoadOpportunityV1:()=>on('BEAR_MENTAL_LOAD_V1'),
 relationalPriorityV1:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_RELATIONAL_V1'),
 ptmInterpretationV1:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_RELATIONAL_V1')&&on('BEAR_PTM_V1'),
 // Load Bear 2.0. Coverage packs and the responsibility engine are on unless switched off; inbound
 // email is OFF unless explicitly switched on (and it also needs its provider configured).
 coveragePacks:()=>on('BEAR_COVERAGE_PACKS_ENABLED'),
 responsibilityEngine:()=>on('BEAR_COVERAGE_PACKS_ENABLED')&&on('BEAR_RESPONSIBILITY_ENGINE_ENABLED'),
 inboundEmail:()=>process.env.BEAR_INBOUND_EMAIL_ENABLED==='on',
 // Bear's first read of an email in the Outlook panel (ACT/ASK/WAIT/UPDATE/CLOSE/IGNORE). OFF unless switched on.
 decisions:()=>process.env.BEAR_DECISIONS_ENABLED==='on',
 // The execution layer (approvals, attempts, confirmation) feeding responsibility states. OFF unless switched on.
 executionLayer:()=>process.env.BEAR_EXECUTION_ENABLED==='on',
 bearIdeasIntelligenceV2:()=>on('BEAR_IDEAS_V2'),                                        // one curated feed; recommendations live in Bear Ideas, not My Bear
};
