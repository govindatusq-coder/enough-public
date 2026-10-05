import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturn,sameOrigin} from '../lib/public-auth.ts';
test('callback cannot redirect to an external host and writes require matching origin',()=>{
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/\r\nevil',null])assert.equal(safeReturn(value),'/#moves');
 assert.equal(safeReturn('/update-password'),'/update-password');
 assert.equal(sameOrigin(new Request('https://enough.example/api/account',{headers:{origin:'https://evil.example'}})),false);
 assert.equal(sameOrigin(new Request('https://enough.example/api/account')),false);
 assert.equal(sameOrigin(new Request('https://enough.example/api/account',{headers:{origin:'https://enough.example'}})),true);
});
