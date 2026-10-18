import type {DevelopmentArea,ProgrammeDevelopmentArea} from './development-intelligence.mjs';
export function stageMeaning(code:string):string;
export function capabilityMeaning(id:string):string;
export function labName(code:string):string;
export type DevelopmentStory={title:string;summary:string;change:string;startingPoint:string;practice:string;transfer:string;confidence:string;recommendation:string;alignment:string;effectiveness:string;explained:number;applied:number;allTasks:boolean;strong:number;stageRows:Array<{label:string;count:number}>;baselineRows:Array<{label:string;count:number}>;changeRows:Array<{label:string;count:number}>};
export function buildDevelopmentStory(area:ProgrammeDevelopmentArea,n:number):DevelopmentStory;
export function learnerDevelopmentStory(area:DevelopmentArea):{summary:string;change:string;focus:string;next:string;alignment:string};
