// Structured outputs accept a JSON-schema subset: value constraints such as pattern, minimum and
// maximum are rejected with a 400, so they are stripped here and enforced by zod afterwards.
export function structuredOutputSchema(schema:unknown):unknown{
 if(Array.isArray(schema))return schema.map(structuredOutputSchema);
 if(schema&&typeof schema==='object'){const out:Record<string,unknown>={};for(const [k,v] of Object.entries(schema as Record<string,unknown>)){if(['pattern','minimum','maximum','minLength','maxLength','minItems','maxItems','format'].includes(k))continue;out[k]=structuredOutputSchema(v);}return out;}
 return schema;
}
