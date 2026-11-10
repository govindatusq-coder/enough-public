// Which fields Bear may fill, and the rule that decisions and attestations are never touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyField,POLICY,REMEMBERABLE,normalise} from '../lib/bear/forms/classify.ts';

test('names are read the way people write them: camelCase, underscores, spaces',()=>{
 assert.equal(normalise('StudentFirstName'),'student first name');assert.equal(normalise('parent_guardian-name'),'parent guardian name');
 const cases={Student_Name:'student_name',StudentFirstName:'student_first','Student Surname':'student_last','Child last name':'student_last','Year level':'class_year',
  'Excursion name':'event_name','Camp date':'event_date','Parent/Guardian name':'parent_name','Parent mobile':'phone','Guardian email':'email','Home address':'address','School':'school'};
 for(const [name,role] of Object.entries(cases))assert.equal(classifyField(name),role,name);
});
test('decisions and attestations are NEVER filled, whatever else the name says',()=>{
 const never={Signature:'signature','Parent signature':'signature','Date signed':'date_signed','Consent given':'consent','I give permission for my child to attend':'consent','Permission':'consent',
  'Medical conditions':'medical','Medication':'medical','Asthma':'medical','Dietary requirements':'medical','Allergies':'allergy','Anaphylaxis action plan':'allergy',
  'Emergency contact name':'emergency','Emergency phone':'emergency','Next of kin':'emergency','Photo permission':'photo','Payment method':'payment','Card number':'payment','BSB':'payment'};
 for(const [name,role] of Object.entries(never)){assert.equal(classifyField(name),role,name);assert.equal(POLICY[role],'parent_decision',name);}
 assert.equal(classifyField('Anything','signature'),'signature','a signature field is a signature whatever it is called');
 for(const n of ['Tick here','Yes','Option 1','X1'])assert.equal(POLICY[classifyField(n,'checkbox')],'parent_decision','every tick box is the parent’s decision: '+n);
 assert.equal(POLICY[classifyField('Choice','radio')],'parent_decision');
});
test('health and safety win over contact details',()=>{
 assert.equal(classifyField('Emergency contact phone'),'emergency');assert.equal(classifyField('Doctor phone'),'medical');assert.equal(classifyField('Parent signature date'),'date_signed');
});
test('unknown fields are left alone, not guessed',()=>{
 for(const n of ['Text1','Field_12','Untitled','a','Box 3'])assert.equal(POLICY[classifyField(n)],'leave',n);
});
test('only plain contact details can be remembered for next time',()=>{
 assert.deepEqual([...REMEMBERABLE].sort(),['address','email','parent_name','phone']);
 for(const r of REMEMBERABLE)assert.equal(POLICY[r],'fill_remembered');
 for(const [r,p] of Object.entries(POLICY))if(p==='parent_decision')assert.ok(!REMEMBERABLE.includes(r),r+' must never be remembered');
});
