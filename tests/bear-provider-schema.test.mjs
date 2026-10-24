import test from 'node:test';
import assert from 'node:assert/strict';
import {generalOutputJsonSchema} from '../lib/bear/ai/general-schema.ts';
test('the structured-output schema sent to the model carries no unsupported constraints',async()=>{
 // Import the pure helper without pulling in server-only.
 const src=await import('../lib/bear/ai/schema-subset.ts');
 const cleaned=JSON.stringify(src.structuredOutputSchema(generalOutputJsonSchema));
 for(const k of ['"pattern"','"minimum"','"maximum"','"minLength"','"maxLength"','"format"'])assert.ok(!cleaned.includes(k),k+' should be stripped');
 assert.ok(cleaned.includes('"additionalProperties":false'));assert.ok(cleaned.includes('"bill"'));
});
test('the wire schema stays under the 16 union-typed field limit and sentinels restore to nulls',async()=>{
 const {structuredOutputSchema,restoreNullables,countUnionFields}=await import('../lib/bear/ai/schema-subset.ts');
 const wire=structuredOutputSchema(generalOutputJsonSchema);
 assert.ok(countUnionFields(generalOutputJsonSchema)>16,'the original schema is over the limit (that is the point)');
 assert.ok(countUnionFields(wire)<=16,'wire schema has '+countUnionFields(wire)+' union fields');
 assert.ok(countUnionFields(wire)<=3,'only the nullable bill object and steps array stay as unions');
 const modelOutput={kind:'appointment',summary:'Dentist for Max',title:{value:'Dentist for Max',confidence:0.9,evidence:'heading'},area:{value:'',confidence:0.2,evidence:''},when:{value:'2026-11-03',confidence:0.8,evidence:'Tuesday 3 Nov'},timeOfDay:{value:'15:00',confidence:0.8,evidence:''},person:{value:'Max',confidence:0.9,evidence:''},location:{value:'',confidence:0,evidence:''},isRecurring:{value:'unknown',confidence:0.1,evidence:''},steps:[],estimatedMinutes:'45',extractedText:'',bill:null};
 const restored=restoreNullables(generalOutputJsonSchema,modelOutput);
 assert.equal(restored.area.value,null);assert.equal(restored.area.evidence,null);assert.equal(restored.isRecurring.value,null);assert.equal(restored.estimatedMinutes,45);assert.equal(restored.extractedText,null);assert.equal(restored.bill,null);assert.equal(restored.person.value,'Max');
 const {generalOutputSchema}=await import('../lib/bear/ai/general-schema.ts');
 assert.ok(generalOutputSchema.safeParse(restored).success,'restored output validates against zod');
 const billOut={...modelOutput,kind:'bill',bill:{documentType:'bill',biller:{value:'AGL',confidence:0.9,evidence:''},amountDueCents:{value:'12345',confidence:0.9,evidence:'$123.45'},dueDate:{value:'2026-11-20',confidence:0.9,evidence:''},category:{value:'',confidence:0.1,evidence:''}}};
 const r2=restoreNullables(generalOutputJsonSchema,billOut);
 assert.equal(r2.bill.amountDueCents.value,12345);assert.equal(r2.bill.category.value,null);assert.equal(r2.bill.biller.evidence,null);
});
