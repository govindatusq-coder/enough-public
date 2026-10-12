export type HealthPermissionState='not-requested'|'requested'|'readable'|'unconfirmed'|'stopped';
export const healthPermissionLabels:Record<HealthPermissionState,string>={
 'not-requested':'Not requested in this app session.',
 requested:'Permission requested. Waiting for a readable result.',
 readable:'Readable records returned. Only those data types can be confirmed; permissions may change in phone settings.',
 unconfirmed:'No readable result to confirm access. Your health app may have no records, or permission may be off.',
 stopped:'Reading stopped in ENOUGH. Revoke health permission in your phone settings if you want to.'
};
export function movementReadError(error:unknown){
 const raw=error instanceof Error?error.message:typeof error==='object'&&error!==null&&'message' in error?String(error.message):'';
 if(/not granted|denied|permission|authoriz|connect health data first/i.test(raw))return {retry:'connect' as const,message:'Health access could not be confirmed. Check ENOUGH’s read permissions in your phone’s health settings, then retry. Manual check-ins are available.'};
 if(/install|update|unavailable|not implemented/i.test(raw))return {retry:'connect' as const,message:'Health data is unavailable on this device. On Android, check that Health Connect is installed and up to date. Manual check-ins are available.'};
 if(/untrusted origin/i.test(raw))return {retry:'connect' as const,message:'This app build is not connected to its approved ENOUGH website. Use the current ENOUGH app build. Manual check-ins are available.'};
 return {retry:'read' as const,message:'Movement data could not be read. Check health permissions in your phone settings, then retry. Manual check-ins are available.'};
}
