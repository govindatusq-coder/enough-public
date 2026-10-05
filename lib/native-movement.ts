import {Capacitor,registerPlugin} from '@capacitor/core';
import {snapshotSchema,movementEvidenceSchema,type Snapshot,type Evidence} from './movement';
interface Bridge {authorize():Promise<{available:boolean}>;read(options:{start?:string;end?:string}):Promise<unknown>;disconnect():Promise<void>}
const bridge=registerPlugin<Bridge>('EnoughMovement');
export const nativeMovementAvailable=()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('EnoughMovement');
export async function connectMovement(){await bridge.authorize();return readMovement();}
export async function readMovement():Promise<Snapshot>{return snapshotSchema.parse(await bridge.read({}));}
export async function readWindow(start:string,end:string):Promise<Evidence>{return movementEvidenceSchema.parse(await bridge.read({start,end}));}
export async function disconnectMovement(){await bridge.disconnect();}
