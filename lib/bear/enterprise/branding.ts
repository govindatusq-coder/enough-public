// White-label configuration. Load Bear's own branding is the default and is never changed by a tenant
// setting; a tenant can only override these fields, and only with safe values.
export interface BrandConfig{appName:string;primary:string;accent:string;logoUrl:string|null;features:{bearIdeas:boolean;forwardToBear:boolean;myWins:boolean};notifications:{push:boolean;quietHoursStart:number;quietHoursEnd:number}}
export const LOAD_BEAR_BRAND:BrandConfig={appName:'Load Bear',primary:'#102A43',accent:'#FF5147',logoUrl:null,features:{bearIdeas:true,forwardToBear:false,myWins:true},notifications:{push:true,quietHoursStart:21,quietHoursEnd:7}};
const HEX=/^#[0-9a-f]{6}$/i;
export function brandFor(override:Partial<BrandConfig>|null|undefined):BrandConfig{
 const o=override||{};const b={...LOAD_BEAR_BRAND,features:{...LOAD_BEAR_BRAND.features},notifications:{...LOAD_BEAR_BRAND.notifications}};
 if(typeof o.appName==='string'&&o.appName.trim().length>0&&o.appName.length<=40)b.appName=o.appName.trim();
 if(typeof o.primary==='string'&&HEX.test(o.primary))b.primary=o.primary;
 if(typeof o.accent==='string'&&HEX.test(o.accent))b.accent=o.accent;
 if(typeof o.logoUrl==='string'&&/^https:\/\/[^\s"'<>]+$/.test(o.logoUrl))b.logoUrl=o.logoUrl;
 if(o.features)for(const k of Object.keys(b.features) as (keyof BrandConfig['features'])[])if(typeof o.features[k]==='boolean')b.features[k]=o.features[k];
 if(o.notifications){const n=o.notifications;if(typeof n.push==='boolean')b.notifications.push=n.push;for(const k of ['quietHoursStart','quietHoursEnd'] as const)if(Number.isInteger(n[k])&&n[k]>=0&&n[k]<=23)b.notifications[k]=n[k];}
 return b;
}
