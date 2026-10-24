// Structured outputs accept a JSON-schema subset, and the compiled grammar has hard limits.
// Three transformations keep Bear's rich internal schema within them:
//  1. Value constraints (pattern, minimum, maximum, …) are rejected with a 400, so they are
//     stripped from the wire schema and enforced by zod afterwards.
//  2. At most 16 fields may be union-typed (anyOf / ["string","null"]). Nullable scalars are
//     sent as plain types with an "unknown" sentinel (empty string; "unknown" for booleans;
//     digits-as-text for numbers) and restored to null afterwards. Only nullable objects and
//     arrays stay as unions.
//  3. The grammar must stay small. Every traced field {value, confidence, evidence} is sent as
//     the bare value, and the root object gains one `uncertain` list naming the traced fields
//     the model is not sure about. restoreNullables() rebuilds the trios (confidence 0.9, or
//     0.45 when listed as uncertain; evidence null).
const STRIP=new Set(['pattern','minimum','maximum','minLength','maxLength','minItems','maxItems','format']);
export const UNCERTAIN_KEY='uncertain';
const SURE=0.9,UNSURE=0.45;
type Node=Record<string,unknown>;
const isObj=(v:unknown):v is Node=>!!v&&typeof v==='object'&&!Array.isArray(v);

// A traced field is an object with exactly value / confidence / evidence.
function tracedInner(node:Node):Node|null{
 if(node.type!=='object'||!isObj(node.properties))return null;
 const keys=Object.keys(node.properties).sort().join(',');
 return keys==='confidence,evidence,value'?(node.properties as Node).value as Node:null;
}
// A nullable scalar is anyOf:[{type:X,...},{type:'null'}] or type:[X,'null'].
function nullableScalar(node:Node):{inner:Node;kind:'string'|'enum'|'boolean'|'number'}|null{
 let inner:Node|null=null;
 if(Array.isArray(node.anyOf)&&node.anyOf.length===2){const [a,b]=node.anyOf as Node[];if(isObj(a)&&isObj(b)&&b.type==='null')inner=a;else if(isObj(a)&&isObj(b)&&a.type==='null')inner=b;}
 else if(Array.isArray(node.type)&&node.type.length===2&&node.type.includes('null')){inner={...node,type:(node.type as string[]).find(t=>t!=='null')};delete (inner as Node).anyOf;}
 if(!inner)return null;
 const t=inner.type;
 if(t==='string'&&Array.isArray(inner.enum))return {inner,kind:'enum'};
 if(t==='string')return {inner,kind:'string'};
 if(t==='boolean')return {inner,kind:'boolean'};
 if(t==='number'||t==='integer')return {inner,kind:'number'};
 return null;
}
const withDesc=(node:Node,extra:string)=>({...node,description:[node.description,extra].filter(Boolean).join(' ')});

function transform(schema:unknown,path:string,traced:string[]):unknown{
 if(Array.isArray(schema))return schema.map(s=>transform(s,path,traced));
 if(!isObj(schema))return schema;
 const inner=tracedInner(schema);
 if(inner){traced.push(path);return transform(inner,path,traced);}
 const nullable=nullableScalar(schema);
 if(nullable){
  const {inner:n,kind}=nullable;const desc=typeof schema.description==='string'?schema.description:undefined;
  const base:Node={...n};if(desc&&!base.description)base.description=desc;
  if(kind==='string')return transform(withDesc(base,'Empty string when unknown or not present.'),path,traced);
  if(kind==='enum')return transform(withDesc({...base,enum:[...(base.enum as unknown[]),'']},'Empty string when unknown or not present.'),path,traced);
  if(kind==='boolean')return withDesc({type:'string',enum:['true','false','unknown'],...(base.description?{description:base.description as string}:{})},'"unknown" when it cannot be told.');
  return withDesc({type:'string',...(base.description?{description:base.description as string}:{})},'Plain digits (e.g. 4550). Empty string when unknown.');
 }
 if(Array.isArray(schema.anyOf)){
  // Nullable object/array: keep the union, transform each branch at the same path.
  return {...schema,anyOf:(schema.anyOf as unknown[]).map(b=>transform(b,path,traced))};
 }
 const out:Node={};
 for(const [k,v] of Object.entries(schema)){
  if(STRIP.has(k))continue;
  if(k==='properties'&&isObj(v)){const props:Node={};for(const [pk,pv] of Object.entries(v))props[pk]=transform(pv,path?`${path}.${pk}`:pk,traced);out[k]=props;continue;}
  if(k==='items'){out[k]=transform(v,path?`${path}[]`:'[]',traced);continue;}
  out[k]=transform(v,path,traced);
 }
 return out;
}

export function structuredOutputSchema(schema:unknown):unknown{
 const traced:string[]=[];
 const wire=transform(schema,'',traced) as Node;
 if(!traced.length||!isObj(wire)||wire.type!=='object')return wire;
 const props={...(wire.properties as Node),[UNCERTAIN_KEY]:{type:'array',items:{type:'string',enum:traced},description:'Names of the fields above whose value you are not sure about (ambiguous, partly readable, or inferred). Empty list when everything listed is clearly printed.'}};
 return {...wire,properties:props,required:[...(wire.required as string[]),UNCERTAIN_KEY]};
}

function restoreScalar(nullable:{inner:Node;kind:string},value:unknown):unknown{
 const {kind}=nullable;
 if(value===null||value===undefined)return null;
 if(kind==='string'||kind==='enum')return typeof value==='string'&&value.trim()===''?null:value;
 if(kind==='boolean'){if(typeof value==='boolean')return value;if(value==='true')return true;if(value==='false')return false;return null;}
 if(typeof value==='number')return value;
 if(typeof value==='string'){const cleaned=value.replace(/[^0-9.-]/g,'');if(cleaned==='')return null;const n=Number(cleaned);return Number.isFinite(n)?(nullable.inner.type==='integer'?Math.round(n):n):null;}
 return null;
}
function restore(schema:unknown,value:unknown,path:string,unsure:Set<string>):unknown{
 if(!isObj(schema))return value;
 const inner=tracedInner(schema);
 if(inner){
  // Accept either the bare wire value or an already-shaped trio (fake providers, older outputs).
  if(isObj(value)&&'value' in value&&'confidence' in value)return {...value,value:restore(inner,value.value,path,unsure)};
  const v=restore(inner,value,path,unsure);
  return {value:v,confidence:v===null?0:(unsure.has(path)?UNSURE:SURE),evidence:null};
 }
 const nullable=nullableScalar(schema);
 if(nullable)return restoreScalar(nullable,value);
 if(Array.isArray(schema.anyOf)){
  if(value===null||value===undefined)return null;
  const branch=(schema.anyOf as unknown[]).find(b=>isObj(b)&&(Array.isArray(value)?b.type==='array':b.type==='object'));
  return branch?restore(branch,value,path,unsure):value;
 }
 if(schema.type==='object'&&isObj(schema.properties)&&isObj(value)){
  const out:Node={};const props=schema.properties as Record<string,unknown>;
  for(const [k,v] of Object.entries(value)){if(k===UNCERTAIN_KEY&&!(k in props))continue;out[k]=k in props?restore(props[k],v,path?`${path}.${k}`:k,unsure):v;}
  return out;
 }
 if(schema.type==='array'&&Array.isArray(value))return value.map(v=>restore(schema.items,v,path?`${path}[]`:'[]',unsure));
 return value;
}
// Walk the ORIGINAL schema next to the model output: rebuild traced trios, turn sentinels back into nulls.
export function restoreNullables(schema:unknown,value:unknown):unknown{
 const unsure=new Set<string>(isObj(value)&&Array.isArray(value[UNCERTAIN_KEY])?(value[UNCERTAIN_KEY] as unknown[]).filter((x):x is string=>typeof x==='string'):[]);
 return restore(schema,value,'',unsure);
}

export function countUnionFields(schema:unknown):number{
 if(Array.isArray(schema))return schema.reduce((n,s)=>n+countUnionFields(s),0);
 if(!isObj(schema))return 0;
 let n=(Array.isArray(schema.type)||Array.isArray(schema.anyOf))?1:0;
 for(const [k,v] of Object.entries(schema)){if(k==='enum'||k==='required'||k==='type')continue;n+=countUnionFields(v);}
 return n;
}
