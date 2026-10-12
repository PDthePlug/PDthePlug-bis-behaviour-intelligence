import { renderProgrammeOutcomePdf } from '@/lib/programme-report-pdf';
import { leap9IllustrativeReport } from '@/lib/experience/leap9-report';

export async function GET() {
  // Keep the public First Look report fictional, aggregate-only and isolated from live programme data.
  // Use the renderer's generic aggregate path rather than a sponsor-specific report contract.
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
