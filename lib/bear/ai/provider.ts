// Model provider abstraction. The application only ever talks to StructuredModelProvider,
// so the vendor can be swapped without touching services. Keys live server-side only.
export interface ExtractInput{schema:Record<string,unknown>;system:string;text:string|null;images:{mime:string;bytes:Uint8Array}[];documents:{mime:string;bytes:Uint8Array}[];maxOutputTokens?:number}
export interface ExtractResult{output:unknown;raw:unknown;provider:string;model:string;latencyMs:number}
export interface StructuredModelProvider{readonly name:string;readonly model:string;readonly supportsVision:boolean;extract(input:ExtractInput):Promise<ExtractResult>}
export type ProviderErrorKind='unavailable'|'refused'|'invalid_output'|'rate_limited'|'network'|'unsupported';
export class ProviderError extends Error{readonly kind:ProviderErrorKind;constructor(message:string,kind:ProviderErrorKind='unavailable'){super(message);this.name='ProviderError';this.kind=kind;}}

// No provider configured. Services detect this and keep text/manual paths working.
export const noProvider:StructuredModelProvider|null=null;
export function providerFromEnv():StructuredModelProvider|null{
 const key=process.env.ANTHROPIC_API_KEY;if(!key)return null;
 // Lazy import keeps the SDK out of the client bundle and out of tests that never use it.
 return new LazyAnthropicProvider(key,process.env.BEAR_MODEL||'claude-opus-5-5');
}
class LazyAnthropicProvider implements StructuredModelProvider{
 readonly name='anthropic';readonly supportsVision=true;
 private key:string;readonly model:string;
 constructor(key:string,model:string){this.key=key;this.model=model;}
 async extract(input:ExtractInput){const {AnthropicProvider}=await import('./anthropic.ts');return new AnthropicProvider(this.key,this.model).extract(input);}
}
