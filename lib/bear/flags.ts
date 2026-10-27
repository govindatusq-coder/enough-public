// Feature flags for controlled testing and rollback. All on unless set to "off" in the environment.
const on=(name:string)=>process.env[name]!=='off';
export const flags={
 priorityEngineV1:()=>on('BEAR_PRIORITY_ENGINE_V1'),
 priorityEngineV2:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_PRIORITY_ENGINE_V2'),     // importance hierarchy, traffic lights, work roles
 strategicAttentionV1:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_STRATEGIC_ATTENTION_V1'),
 mentalLoadOpportunityV1:()=>on('BEAR_MENTAL_LOAD_V1'),
 relationalPriorityV1:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_RELATIONAL_V1'),
 ptmInterpretationV1:()=>on('BEAR_PRIORITY_ENGINE_V1')&&on('BEAR_RELATIONAL_V1')&&on('BEAR_PTM_V1'),
 bearIdeasIntelligenceV2:()=>on('BEAR_IDEAS_V2'),                                        // one curated feed; recommendations live in Bear Ideas, not My Bear
};
