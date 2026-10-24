// Structured outputs accept a JSON-schema subset. Two things matter here:
//  1. Value constraints (pattern, minimum, maximum, …) are rejected with a 400, so they are
//     stripped from the wire schema and enforced by zod afterwards.
//  2. At most 16 fields may be union-typed (anyOf / ["string","null"]). Bear's schema has
//     ~60 nullable fields, so nullable scalars are sent as plain types with an "unknown"
//     sentinel (empty string, "unknown" for booleans, "" for numbers-as-text) and the
//     sentinels are turned back into null with restoreNullables() before validation.
//     Nullable objects and arrays stay as unions; there are only a couple of those.
const STRIP=new Set(['pattern','minimum','maximum','minLength','maxLength','minItems','maxItems','format']);
type Node=Record<string,unknown>;
const isObj=(v:unknown):v is Node=>!!v&&typeof v==='object'&&!Array.isArray(v);

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

export function structuredOutputSchema(schema:unknown):unknown{
 if(Array.isArray(schema))return schema.map(structuredOutputSchema);
 if(!isObj(schema))return schema;
 const nullable=nullableScalar(schema);
 if(nullable){
  const {inner,kind}=nullable;const desc=typeof schema.description==='string'?schema.description:undefined;
  const base:Node={...inner};if(desc&&!base.description)base.description=desc;
  if(kind==='string')return structuredOutputSchema(withDesc(base,'Use an empty string when unknown or not present.'));
  if(kind==='enum')return structuredOutputSchema(withDesc({...base,enum:[...(base.enum as unknown[]),'']},'Use an empty string when unknown or not present.'));
  if(kind==='boolean')return withDesc({type:'string',enum:['true','false','unknown'],...(base.description?{description:base.description as string}:{})},'Use "unknown" when it cannot be told.');
  return withDesc({type:'string',...(base.description?{description:base.description as string}:{})},'Write the number as plain digits (for example 12 or 4550). Use an empty string when unknown.');
 }
 const out:Node={};
 for(const [k,v] of Object.entries(schema)){if(STRIP.has(k))continue;out[k]=structuredOutputSchema(v);}
 return out;
}

// Walk the ORIGINAL schema next to the model output and turn sentinels back into nulls / numbers / booleans.
export function restoreNullables(schema:unknown,value:unknown):unknown{
 if(!isObj(schema))return value;
 const nullable=nullableScalar(schema);
 if(nullable){
  const {kind}=nullable;
  if(value===null||value===undefined)return null;
  if(kind==='string'||kind==='enum')return typeof value==='string'&&value.trim()===''?null:value;
  if(kind==='boolean'){if(typeof value==='boolean')return value;if(value==='true')return true;if(value==='false')return false;return null;}
  if(typeof value==='number')return value;
  if(typeof value==='string'){const cleaned=value.replace(/[^0-9.-]/g,'');if(cleaned==='')return null;const n=Number(cleaned);return Number.isFinite(n)?(nullable.inner.type==='integer'?Math.round(n):n):null;}
  return null;
 }
 if(Array.isArray(schema.anyOf)){
  // Nullable object/array: pick the branch that matches the value's shape.
  if(value===null||value===undefined)return null;
  const branch=(schema.anyOf as unknown[]).find(b=>isObj(b)&&(Array.isArray(value)?b.type==='array':b.type==='object'));
  return branch?restoreNullables(branch,value):value;
 }
 if(schema.type==='object'&&isObj(schema.properties)&&isObj(value)){
  const out:Node={};const props=schema.properties as Record<string,unknown>;
  for(const [k,v] of Object.entries(value))out[k]=k in props?restoreNullables(props[k],v):v;
  return out;
 }
 if(schema.type==='array'&&Array.isArray(value))return value.map(v=>restoreNullables(schema.items,v));
 return value;
}

export function countUnionFields(schema:unknown):number{
 if(Array.isArray(schema))return schema.reduce((n,s)=>n+countUnionFields(s),0);
 if(!isObj(schema))return 0;
 let n=(Array.isArray(schema.type)||Array.isArray(schema.anyOf))?1:0;
 for(const [k,v] of Object.entries(schema)){if(k==='enum'||k==='required'||k==='type')continue;n+=countUnionFields(v);}
 return n;
}
