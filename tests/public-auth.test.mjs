import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturn,sameOrigin,bearerToken,trustedWrite} from '../lib/public-auth.ts';
test('callback cannot redirect to an external host and writes require matching origin',()=>{
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/\r\nevil',null])assert.equal(safeReturn(value),'/#moves');
 assert.equal(safeReturn('/update-password'),'/update-password');
 assert.equal(sameOrigin(new Request('https://enough.example/api/account',{headers:{origin:'https://evil.example'}})),false);
 assert.equal(sameOrigin(new Request('https://enough.example/api/account')),false);
 assert.equal(sameOrigin(new Request('https://enough.example/api/account',{headers:{origin:'https://enough.example'}})),true);
});
test('native clients authenticate with a bearer token and need no Origin header',()=>{
 const token='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abcdefghijklmnopqrstuvwxyz0123456789-_';
 assert.equal(bearerToken(new Request('https://enough.example/api/account',{headers:{authorization:'Bearer '+token}})),token);
 for(const value of ['','Bearer','Bearer short','Basic dXNlcjpwYXNz','Bearer '+token+' extra','bearer '+token,'Bearer '+'a'.repeat(5000)])assert.equal(bearerToken(new Request('https://enough.example/api/account',{headers:{authorization:value}})),null);
 assert.equal(trustedWrite(new Request('https://enough.example/api/account',{headers:{authorization:'Bearer '+token}})),true);
 assert.equal(trustedWrite(new Request('https://enough.example/api/account',{headers:{authorization:'Bearer '+token,origin:'https://evil.example'}})),true,'a bearer request is not a cookie request, so a foreign Origin cannot ride the session');
 assert.equal(trustedWrite(new Request('https://enough.example/api/account',{headers:{origin:'https://evil.example'}})),false);
 assert.equal(trustedWrite(new Request('https://enough.example/api/account')),false);
 assert.equal(trustedWrite(new Request('https://enough.example/api/account',{headers:{origin:'https://enough.example'}})),true);
});
