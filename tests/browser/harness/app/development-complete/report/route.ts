import {renderProgrammeOutcomePdf} from '../../../../../../lib/programme-report-pdf';
import {completeDevelopmentOutcome} from '../../../development-complete-fixture';
export async function GET(){return new Response(new Uint8Array(await renderProgrammeOutcomePdf(completeDevelopmentOutcome,new Date('2026-10-14'),{illustrative:true})),{headers:{'content-type':'application/pdf'}});}
