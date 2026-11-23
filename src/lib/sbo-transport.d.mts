import type {Workspace} from './sbo-types';
export function mergeTransportWorkspace(previous:Workspace|null,incoming:Workspace):Workspace;
export function retryableTransportStatus(status:number):boolean;
