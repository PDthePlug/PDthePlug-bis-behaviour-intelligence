import type {DevelopmentFact} from '../development-intelligence.mjs';
import type {SponsorOutcome} from '../../app/programme-outcomes-view';
export const SCENARIO_BOUNDARY:string;
export const scenarioDefinitions:Array<{id:string;title:string;labs:string[]}>;
export type DevelopmentScenario={scenario:string;boundary:string;completedLabs:number;learners:Array<{id:string;name:string;group:string;facts:DevelopmentFact[];learning:{practiceNeed:number;entryControl:number;laterControl:number}}> ;outcomes:SponsorOutcome[]};
export function buildDevelopmentScenario(scenario?:string):DevelopmentScenario;
