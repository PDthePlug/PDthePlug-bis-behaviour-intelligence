import { renderProgrammeOutcomePdf } from '@/lib/programme-report-pdf';
import { leap9IllustrativeReport } from '@/lib/experience/leap9-report';

export async function GET() {
  const report = {
    ...leap9IllustrativeReport,
    cohort: { ...leap9IllustrativeReport.cohort, id: 'sasol-experience-fictional', name: 'Sasol Foundation - Illustrative Programme Experience' },
  };
  const pdf = await renderProgrammeOutcomePdf(report, new Date(), { illustrative: true });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Sasol-Foundation-BIS-Illustrative-Outcome-Report.pdf"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
