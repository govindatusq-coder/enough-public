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
