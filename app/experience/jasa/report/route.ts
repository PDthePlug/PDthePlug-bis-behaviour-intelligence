import { renderProgrammeOutcomePdf } from '@/lib/programme-report-pdf';
import { leap9IllustrativeReport } from '@/lib/experience/leap9-report';

export async function GET() {
  const report = {
    ...leap9IllustrativeReport,
    cohort: { ...leap9IllustrativeReport.cohort, id: 'jasa-experience-fictional', name: 'JA South Africa - Illustrative Programme Experience' },
  };
  const pdf = await renderProgrammeOutcomePdf(report, new Date(), { illustrative: true });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="JA-South-Africa-BIS-Illustrative-Outcome-Report.pdf"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
