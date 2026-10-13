import { renderProgrammeOutcomePdf } from '@/lib/programme-report-pdf';
import { leap9IllustrativeReport } from '@/lib/experience/leap9-report';

export async function GET() {
  // Public First Look stays fictional, aggregate-only and isolated from live programme data.
  // Reuse the generic illustrative report renderer rather than widening any sponsor contract.
  const report = {
    ...leap9IllustrativeReport,
    cohort: {
      ...leap9IllustrativeReport.cohort,
      id: 'bis-first-look-fictional',
      name: 'BIS First Look - Illustrative Programme Experience',
    },
  };
  const pdf = await renderProgrammeOutcomePdf(report, new Date(), { illustrative: true });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="BIS-First-Look-Illustrative-Outcome-Report.pdf"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
