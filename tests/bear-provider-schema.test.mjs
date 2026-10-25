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
 const modelOutput={kind:'appointment',summary:'Dentist for Max',title:'Dentist for Max',area:'',when:'2026-11-03',timeOfDay:'15:00',person:'Max',location:'',isRecurring:'unknown',steps:[],estimatedMinutes:'45',extractedText:'',bill:null,uncertain:['when']};
 const restored=restoreNullables(generalOutputJsonSchema,modelOutput);
 assert.equal(restored.area.value,null);assert.equal(restored.area.confidence,0);assert.equal(restored.isRecurring.value,null);assert.equal(restored.estimatedMinutes,45);assert.equal(restored.extractedText,null);assert.equal(restored.bill,null);assert.equal(restored.person.value,'Max');assert.equal(restored.person.confidence,0.9);assert.equal(restored.when.confidence,0.45);assert.ok(!('uncertain' in restored));
 const wireText=JSON.stringify(wire);assert.ok(!wireText.includes('"evidence"')||wireText.split('"evidence"').length<=5,'traced evidence fields are not on the wire');assert.ok(wireText.length<7000,'wire schema is small: '+wireText.length);assert.ok(wireText.includes('"bill.biller"'),'uncertain enum lists nested traced paths');
 const {generalOutputSchema}=await import('../lib/bear/ai/general-schema.ts');
 assert.ok(generalOutputSchema.safeParse(restored).success,'restored output validates against zod');
 const billOut={...modelOutput,kind:'bill',uncertain:['bill.dueDate'],bill:{documentType:'bill',biller:'AGL',amountDueCents:'12345',dueDate:'2026-11-20',category:''}};
 const r2=restoreNullables(generalOutputJsonSchema,billOut);
 assert.equal(r2.bill.amountDueCents.value,12345);assert.equal(r2.bill.category.value,null);assert.equal(r2.bill.biller.evidence,null);assert.equal(r2.bill.dueDate.confidence,0.45);assert.equal(r2.bill.biller.confidence,0.9);
});
