// Owner-approved timing correction, recorded separately from the original DOCX.
export function applyApprovedHandbookRevision(bytes, revision) {
  const source = JSON.parse(new TextDecoder().decode(bytes));
  if (source.identity.code !== revision.code) return bytes;
  const escape = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  for (const page of source.treatment.pages) {
    for (const [before, after] of revision.replacements[page.key] ?? []) {
      page.html = page.html.replaceAll(escape(before), escape(after));
      page.label = page.label.replaceAll(before, after);
    }
    const note = revision.notes[page.key];
    if (note) page.html = `<p class="handbook-experiment-timing">${escape(note)}</p>\n${page.html}`;
  }
  source.experimentSchedule = revision.experimentSchedule;
  source.sourceTrace.rule += ` Owner-approved timing revision: ${revision.revision}.`;
  return new TextEncoder().encode(JSON.stringify(source));
}
