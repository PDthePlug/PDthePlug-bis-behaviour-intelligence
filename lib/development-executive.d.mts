export type DevelopmentExecutive={status:string;participantCount:number|null;assessmentCount:number|null;growth:Array<{title:string;count:number;paired:number}>;priorities:Array<{title:string;understanding:number;missing:number;transfer:number;followup:number}>;evidenceLimit:string;nextAction:string};
export function buildDevelopmentExecutive(report:unknown):DevelopmentExecutive;
