const decode = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Preserve Word's empty response rows and merged-cell geometry. */
export function readDocxTable(xml) {
  const rows = [];
  const vertical = new Map();
  let complex = false;
  for (const rowMatch of xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
    const row = [];
    let column = Number(rowMatch[0].match(/<w:gridBefore\b[^>]*w:val="(\d+)"/)?.[1] || 0);
    if (column) { complex = true; row.push({ text: '', colspan: column, rowspan: 1 }); }
    for (const cellMatch of rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)) {
      const cellXml = cellMatch[0];
      const colspan = Number(cellXml.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/)?.[1] || 1);
      const merge = cellXml.match(/<w:vMerge\b([^>]*)\/?\s*>/);
      const continuation = merge && !/w:val="restart"/.test(merge[1]);
      const text = [...cellXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(p => [...p[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(t => decode(t[1])).join('')).join('\n').trim();
      const cell = { text, colspan, rowspan: 1 };
      if (colspan > 1 || merge) complex = true;
      if (continuation && vertical.has(column)) vertical.get(column).rowspan += 1;
      else { row.push(cell); if (merge) vertical.set(column, cell); else vertical.delete(column); }
      column += colspan;
    }
    rows.push(row);
  }
  const tableRows = rows.map(row => row.map(cell => cell.text));
  const render = (row, index) => '<tr>' + row.map((cell, column) => {
    const tag = index === 0 ? 'th' : 'td';
    const label = !complex && index > 0 ? ' data-label="' + escape(tableRows[0]?.[column] || '') + '"' : '';
    return '<' + tag + (index === 0 ? cell.colspan > 1 ? ' scope="colgroup"' : ' scope="col"' : '') + label + (cell.colspan > 1 ? ' colspan="' + cell.colspan + '"' : '') + (cell.rowspan > 1 ? ' rowspan="' + cell.rowspan + '"' : '') + '>' + escape(cell.text).replace(/\n/g, '<br/>') + '</' + tag + '>';
  }).join('') + '</tr>';
  if (complex) return { tableRows, complex, html: '<table class="handbook-table"><tbody>' + rows.map(render).join('') + '</tbody></table>' };
  return { tableRows, complex, html: '<table class="handbook-table"><thead>' + (rows[0] ? render(rows[0], 0) : '') + '</thead><tbody>' + rows.slice(1).map((row, i) => render(row, i + 1)).join('') + '</tbody></table>' };
}
