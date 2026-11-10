import {flags} from '../flags.ts';
// Outlook calendar is OFF unless the owner switches it on AND provides every setting. Endpoints default to Microsoft's
// public cloud; they can be overridden (a national cloud, or a local stand-in in tests).
export interface CalendarConfig{ready:boolean;missing:string[];clientId:string|null;clientSecret:string|null;tenant:string;tokenKey:string|null;authority:string;graphBase:string}
export function calendarConfig(env:Record<string,string|undefined>=process.env):CalendarConfig{
 const clientId=env.BEAR_MS_CLIENT_ID||null,clientSecret=env.BEAR_MS_CLIENT_SECRET||null,tokenKey=env.BEAR_TOKEN_KEY||null;
 const tenant=env.BEAR_MS_TENANT||'common';
 const missing=[['BEAR_CALENDAR_ENABLED',flags.calendarIntegration(env)],['BEAR_MS_CLIENT_ID',!!clientId],['BEAR_MS_CLIENT_SECRET',!!clientSecret],['BEAR_TOKEN_KEY',keyOk(tokenKey)]].filter(([,ok])=>!ok).map(([n])=>n as string);
 return {ready:missing.length===0,missing,clientId,clientSecret,tenant,tokenKey,
  authority:(env.BEAR_MS_AUTHORITY||'https://login.microsoftonline.com').replace(/\/$/,''),graphBase:(env.BEAR_GRAPH_BASE_URL||'https://graph.microsoft.com/v1.0').replace(/\/$/,'')};
}
const keyOk=(k:string|null)=>!!k&&Buffer.from(k,'base64').length===32;
export const SCOPES=['offline_access','Calendars.ReadWrite'] as const;
