import type {Case,Requirement,Baseline,Skill,Workspace} from './sbo-types';
export type Gap={requirementId:string;skillId:string;catalogue:string;profile:string;proficiency:string;coverage:string;severity:string;priority:string;needsClarification:boolean;ruleVersion:string};
export const ruleVersion:string;
export function priority(relevance:string,severity:string,critical?:boolean):string;
export function assessRequirement(requirement:Requirement,baseline:Baseline|undefined,skill:Skill|undefined,relevance:string):Gap;
export function assessCase(c:Case,skills:Skill[]):Gap[];
export function searchSkills(skills:Skill[],query:string,category?:string):Skill[];
export function reviewBlockers(c:Case,skills:Skill[]):string[];
export function tnaSnapshot(c:Case,workspace:Workspace):Record<string,unknown>;
