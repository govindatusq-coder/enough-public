import {ProviderError,type ExtractInput,type ExtractResult,type StructuredModelProvider} from './provider.ts';
// Test double. Returns scripted outputs or throws scripted failures; records calls.
export class FakeProvider implements StructuredModelProvider{
 readonly name='fake';readonly model='fake-1';readonly supportsVision=true;calls:ExtractInput[]=[];
 private script:(input:ExtractInput)=>unknown;constructor(script:(input:ExtractInput)=>unknown){this.script=script;}
 async extract(input:ExtractInput):Promise<ExtractResult>{
  this.calls.push(input);const output=this.script(input);
  if(output instanceof ProviderError)throw output;
  return {output,raw:{fake:true},provider:this.name,model:this.model,latencyMs:1};
 }
}
