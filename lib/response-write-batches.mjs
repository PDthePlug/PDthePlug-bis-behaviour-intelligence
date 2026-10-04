/** Keep corrections and investigation transitions ordered while bounding independent writes. */
export async function writeResponseBatches(items, write) {
  let cursor = 0;
  while (cursor < items.length) {
    const batch = [];
    const fields = new Set();
    const investigation = Number(items[cursor].investigation ?? 0);
    while (cursor < items.length && batch.length < 4) {
      const item = items[cursor];
      const field = String(item.semanticFieldId ?? "");
      if (Number(item.investigation ?? 0) !== investigation || fields.has(field)) break;
      fields.add(field);
      batch.push(item);
      cursor += 1;
    }
    const results = await Promise.allSettled(batch.map(write));
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
}
