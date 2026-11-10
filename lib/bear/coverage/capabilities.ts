import {flags} from '../flags.ts';
import {calendarConfig} from '../calendar/config.ts';
import type {CapabilityKey} from './types.ts';

// The capability truth table. Bear may only claim what is `implemented && enabled`.
// Anything that needs an integration Bear doesn't have is listed as not supported, so packs,
// ownership and copy can check before they say "Bear will...".
export interface CapabilityRow{key:CapabilityKey;label:string;implemented:boolean;enabled:boolean;needsConfig:boolean}
export function capabilityTable(env:Record<string,string|undefined>=process.env):CapabilityRow[]{
 const inbound=flags.inboundEmail()&&!!env.BEAR_INBOUND_SECRET&&!!env.BEAR_INBOUND_DOMAIN;
 const row=(key:CapabilityKey,label:string,implemented:boolean,enabled=implemented,needsConfig=false):CapabilityRow=>({key,label,implemented,enabled,needsConfig});
 return [
  row('store','Keep information and documents',true),
  row('extract','Read notices, bills and documents into details',true),
  row('decompose','Break obligations into steps',true),
  row('prioritise','Work out what matters and when',true),
  row('remind','Plan reminders',true),
  row('notify','Send notifications',true,true,!env.BEAR_VAPID_PUBLIC_KEY),
  row('draft','Draft messages for you to copy',true),
  row('record_confirmation','Record what you tell Bear is done',true),
  row('inbound_email','Receive emails you forward to Bear',true,inbound,true),
  row('read_email','Read your email account',false,false),
  // Implemented only when the owner has switched Outlook calendar on and supplied every setting (still needs the person to connect).
  row('calendar','Add events to your Outlook calendar',calendarConfig(env).ready,calendarConfig(env).ready,!calendarConfig(env).ready),
  row('bank','See your bank account',false,false),
  row('pay','Make payments',false,false),
  row('contact_external','Contact schools or companies for you',false,false),
  row('submit_forms','Submit forms',false,false),
  row('book','Book appointments or interview times',false,false),
  row('verify_external','Check that something happened outside Bear',false,false),
 ];
}
export const can=(key:CapabilityKey,env?:Record<string,string|undefined>)=>capabilityTable(env).some(r=>r.key===key&&r.implemented&&r.enabled);
