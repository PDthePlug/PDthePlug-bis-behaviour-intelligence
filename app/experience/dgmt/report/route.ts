import { renderProgrammeOutcomePdf } from '@/lib/programme-report-pdf';
import { leap9IllustrativeReport } from '@/lib/experience/leap9-report';

export async function GET() {
  // Reuse the same fixed fictional aggregate, without changing Leap9's report.
  const report = {
    ...leap9IllustrativeReport,
    cohort: { ...leap9IllustrativeReport.cohort, id: 'dgmt-experience-fictional', name: 'DGMT - Illustrative Programme Experience' },
  };
  const pdf = await renderProgrammeOutcomePdf(report, new Date(), { illustrative: true, experienceOrganisation: 'DGMT' });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="DGMT-BIS-Illustrative-Outcome-Report.pdf"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
