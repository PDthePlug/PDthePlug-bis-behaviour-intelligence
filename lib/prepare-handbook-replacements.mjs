/** Prepare complete replacement versions through normal Content Studio operations. */
export async function prepareHandbookReplacements({ items, editions, createDraft, loadSource, saveSource, compile, onProgress = () => {} }) {
  const results = [];
  for (const code of [...new Set(editions.map(entry => entry.code))]) {
    const item = items.find(entry => entry.kind === "LEARNING_MODULE" && entry.code === code && entry.status === "ACTIVE");
    if (!item) throw new Error(`The ${code} handbook shelf is unavailable.`);
    const draft = await createDraft(item);
    if (!draft || draft.status !== "DRAFT" || draft.sourceFiles.length) throw new Error("Use a new, empty update for the handbook replacement.");
    for (const edition of editions.filter(entry => entry.code === code)) {
      onProgress(`Preparing ${edition.title} · ${edition.edition.replace("_", " ")}`);
      const bytes = await loadSource(draft, edition);
      await saveSource(draft, edition, bytes);
    }
    await compile(draft);
    results.push({ code, versionId: draft.id, editions: editions.filter(entry => entry.code === code).map(entry => entry.edition) });
  }
  return results;
}
