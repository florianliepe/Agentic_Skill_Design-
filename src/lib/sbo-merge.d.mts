import type {Case} from './sbo-types';
export function mergeCaseDraft(base:Case|undefined,local:Case,remote:Case,choices?:Record<string,string>):{merged:Case;conflicts:{field:string;local:unknown;remote:unknown}[]};
