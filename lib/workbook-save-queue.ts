export type WorkbookEdit = {
  semanticFieldId: string;
  semanticStepId: string;
  sourceFieldKey: string;
  value: string;
};

/** One writer per workbook. Acknowledgements only clear the exact revision sent. */
export class WorkbookSaveQueue {
  private revision = 0;
  private pending = new Map<string, WorkbookEdit & { revision: number }>();
  private running: Promise<boolean> | null = null;

  get size() { return this.pending.size; }

  edit(item: WorkbookEdit) {
    this.pending.set(item.semanticFieldId, { ...item, revision: ++this.revision });
  }

  flush(write: (items: WorkbookEdit[]) => Promise<void>): Promise<boolean> {
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        while (this.pending.size) {
          const batch = [...this.pending.values()].slice(0, 60);
          await write(batch.map(({ semanticFieldId, semanticStepId, sourceFieldKey, value }) =>
            ({ semanticFieldId, semanticStepId, sourceFieldKey, value })));
          for (const item of batch) {
            if (this.pending.get(item.semanticFieldId)?.revision === item.revision) {
              this.pending.delete(item.semanticFieldId);
            }
          }
        }
        return true;
      } catch {
        return false;
      }
    })();
    const active = this.running;
    void active.then(() => { if (this.running === active) this.running = null; });
    return active;
  }
}
