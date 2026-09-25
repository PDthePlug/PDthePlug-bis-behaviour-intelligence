import { inflateRawSync, inflateSync } from "node:zlib";
import type { ContentSourceFormat } from "./content-studio";
import type { DeliveryEdition } from "./learning-foundation";

type AdaptMetadata = {
  title: string;
  slug: string;
};

const PAGE_KEYS = [
  "Welcome",
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Weekend",
  "Day 6",
  "Day 7",
  "Day 8",
  "Day 9",
  "Day 10",
  "Certificate",
] as const;

type PageKey = (typeof PAGE_KEYS)[number];

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function findEocd(bytes: Uint8Array) {
  const floor = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= floor; offset -= 1) {
    if (readU32(bytes, offset) === 0x06054b50) return offset;
  }
  return -1;
}

function zipEntries(bytes: Uint8Array) {
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error("The ZIP/DOCX source is not a readable ZIP archive.");
  const total = readU16(bytes, eocd + 10);
  let offset = readU32(bytes, eocd + 16);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let index = 0; index < total; index += 1) {
    if (readU32(bytes, offset) !== 0x02014b50) throw new Error("The ZIP directory is damaged.");
    const method = readU16(bytes, offset + 10);
    const compressedSize = readU32(bytes, offset + 20);
    const nameLength = readU16(bytes, offset + 28);
    const extraLength = readU16(bytes, offset + 30);
    const commentLength = readU16(bytes, offset + 32);
    const localOffset = readU32(bytes, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extractZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  const offset = entry.localOffset;
  if (readU32(bytes, offset) !== 0x04034b50) throw new Error("ZIP entry " + entry.name + " is damaged.");
  const nameLength = readU16(bytes, offset + 26);
  const extraLength = readU16(bytes, offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(compressed));
  throw new Error("ZIP entry " + entry.name + " uses unsupported compression method " + entry.method + ".");
}

function extractZipByName(bytes: Uint8Array, name: string) {
  const entry = zipEntries(bytes).find((candidate) => candidate.name === name);
  return entry ? extractZipEntry(bytes, entry) : null;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function canonicalPageKey(value: string): PageKey | null {
  const cleaned = value
    .replace(/[–—:|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (/^welcome\b/.test(cleaned)) return "Welcome";
  if (/^weekend\b/.test(cleaned)) return "Weekend";
  if (/\b(?:investigation|completion)?\s*certificate\b/.test(cleaned)) return "Certificate";
  const day = cleaned.match(/^day\s*(10|[1-9])\b/);
  if (day) return ("Day " + day[1]) as PageKey;
  return null;
}

function strictProgrammePageKey(value: string): PageKey | null {
  const cleaned = value.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  if (/^WELCOME$/i.test(cleaned)) return "Welcome";
  if (/^WEEKEND$/i.test(cleaned)) return "Weekend";
  const day = cleaned.match(/^DAY\s+(10|[1-9])(?:\s+OF\s+10)?$/i);
  if (day) return ("Day " + day[1]) as PageKey;
  if (/^(?:[A-Z][A-Z0-9 &®™'()/-]+\s+)?(?:INVESTIGATION\s+)?CERTIFICATE$/u.test(cleaned.toUpperCase())) {
    return "Certificate";
  }
  return null;
}

type SourceBlock = {
  text: string;
  html: string;
  heading: boolean;
  tableRows?: string[][];
  answerColumn?: number;
  lines?: string[];
  kind?: "paragraph" | "table";
};

const sectionNoise = /^(big idea|why this matters|explanation|examples?|worked example|stop\s*&\s*check|checkpoint|common mistake|try it yourself|evidence connection|key words?|chapter summary|answers?|what to do|what happens next)$/i;

function sourceToken(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toLowerCase();
}

function handbookQuestionPrompts(value: string) {
  const rendered = value.replace(/\r\n?/g, "\n").trim();
  if (!rendered) return [] as string[];
  const numbered = [...rendered.matchAll(/(?:^|\n|\s)(?:[1-9]|1\d)[.)]\s*([^?]{4,700}\?)/g)]
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  const plain = rendered.replace(/\s+/g, " ").trim();
  const lastQuestion = plain.lastIndexOf("?");
  if (lastQuestion < 0 || lastQuestion < plain.length - 3 || plain.length > 900) return [];

  const before = plain.slice(0, lastQuestion + 1).replace(/^\d+[.)]\s*/, "").trim();
  if (/^["“].*\?$/.test(before)) return [];
  if (/\b(?:asks?|says?|said|writes?|thinks?|thought|remembers?|types?)\s*:\s*["“].*\?$/i.test(before)) return [];
  return [before];
}

function handbookOption(value: string) {
  const match = value.replace(/\s+/g, " ").trim().match(/^☐\s*(.+)$/u);
  return match?.[1]?.trim() || "";
}

function handbookFieldCue(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (/^(answers?|question|equation|frame|session|time|mode|difficulty|today you will|you will need|experiment position)\s*:?$/i.test(text)) return false;
  if (/^📌\s*carry forward/i.test(text) || /^📖|^💭|^✍️|^✅|^🏠|^📂|^🔎|^⚡|^🔬|^🎯|^🧪|^📊|^🤝/u.test(text)) return false;
  if (/_{3,}/.test(text) || /\.{5,}/.test(text)) return true;
  if (/^(confidence|my rating|shift|observation days completed|missing \/ unrecorded days|eligible target opportunities observed|checks initiated|risk check initiation rate|full checks completed|full risk check completion rate|minimum checks completed|opportunity coverage|completed risk checks|usable events for prediction testing|protection criterion occurred in these events|observed protection criterion rate|predicted protection criterion rate|difference|protection criterion prediction accuracy)\s*:/i.test(text)) return true;
  if (/^(the protection pattern i want to investigate|why i chose this one|my intended protection position|my recurring protective opportunity|my protective action|my observable protection criterion|i will count the protection criterion as occurred when|my working risk equation|my target condition|my check-in person|my restart plan|my revision signal|what i noticed|what i collected|who i asked|what they said|where i will keep my tracker|what i can now do|who i showed|the most important thing learned)\s*:/i.test(text)) return true;
  if (/^(risk context|intended protection position|actual protection position at start|protection gap|action relationship|protective action implemented\?|protection coverage relationship|protective action tested|family of protection|observable protection criterion|what actually happened so far|trade-off observed\?|constraint observed\?|what surprised you)\s*:\s*_{2,}/i.test(text)) return true;
  return false;
}

function handbookShortControl(sourceKey: string, label: string, raw = label) {
  const lower = (label + " " + raw).toLowerCase();
  const attrs = [
    'class="response workbook-short-response"',
    'data-source-key="' + escapeHtml(sourceKey) + '"',
    'data-purpose="LEARNING_RESPONSE"',
    'data-privacy-class="P3"',
    'aria-label="' + escapeHtml(label || "Your answer") + '"',
  ];
  if (/\bdate\s*:/.test(lower)) {
    return "<input type=\"date\" " + attrs.join(" ") + " />";
  }
  const range = raw.match(/\/\s*(10|7|100)\b/);
  if (range || /\bconfidence\b|\bmy rating\b/i.test(label) || /(?:rate|accuracy|difference|shift)\s*:/i.test(label) || /%\s*$/.test(raw)) {
    const max = range ? Number(range[1]) : /\bconfidence\b|\bmy rating\b/i.test(label) ? 10 : 100;
    const min = max === 10 ? 1 : 0;
    return "<input type=\"number\" min=\"" + min + "\" max=\"" + max + "\" " + attrs.join(" ") + " />";
  }
  return "<input type=\"text\" " + attrs.join(" ") + " />";
}

function handbookTextarea(sourceKey: string, prompt: string) {
  return (
    '<textarea class="response compiled-workbook-response" rows="4" maxlength="20000"' +
    ' data-source-key="' + escapeHtml(sourceKey) + '"' +
    ' data-purpose="LEARNING_RESPONSE" data-privacy-class="P3"' +
    ' aria-label="' + escapeHtml("Your answer: " + prompt) + '"' +
    ' placeholder="Write your answer…"></textarea>'
  );
}

function handbookChoice(sourceKey: string, prompt: string, options: string[]) {
  return (
    '<select class="response workbook-choice-response"' +
    ' data-source-key="' + escapeHtml(sourceKey) + '"' +
    ' data-purpose="LEARNING_RESPONSE" data-privacy-class="P3"' +
    ' aria-label="' + escapeHtml("Your answer: " + prompt) + '">' +
    '<option value="">Choose…</option>' +
    options.map((option) => '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + "</option>").join("") +
    "</select>"
  );
}

function handbookBlockHtml(block: SourceBlock) {
  return block.html.trim();
}

function renderHandbookPage(blocks: SourceBlock[], key: PageKey) {
  const html: string[] = [];
  let inAnswers = false;
  const occurrences = new Map<string, number>();
  const nextSourceKey = (prompt: string) => {
    const normalized = prompt.replace(/\s+/g, " ").trim();
    const occurrence = (occurrences.get(normalized) ?? 0) + 1;
    occurrences.set(normalized, occurrence);
    return key.replace(/\s+/g, "").toLowerCase() + "-" + sourceToken(normalized) + "-" + occurrence;
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = block.text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (/^(answers?|suggested answers?)\s*:?$/i.test(text)) {
      inAnswers = true;
      html.push(handbookBlockHtml(block));
      continue;
    }
    if (inAnswers && (block.heading || strictProgrammePageKey(text) || /^📌\s*carry forward|^⚡|^📂|^🏠|^✅/u.test(text))) {
      inAnswers = false;
    }

    if (!inAnswers) {
      const questions = handbookQuestionPrompts(block.lines?.join("\n") || block.text);
      if (questions.length) {
        const optionRows: string[] = [];
        let cursor = index + 1;
        while (cursor < blocks.length) {
          const option = handbookOption(blocks[cursor].text);
          if (!option) break;
          optionRows.push(option);
          cursor += 1;
        }

        html.push(handbookBlockHtml(block));
        if (questions.length === 1 && optionRows.length) {
          html.push(handbookChoice(nextSourceKey(questions[0]), questions[0], optionRows));
          index = cursor - 1;
          continue;
        }

        const nextText = blocks[index + 1]?.text.replace(/\s+/g, " ").trim() || "";
        const hasAuthoredFieldImmediatelyAfter = questions.length === 1 && handbookFieldCue(nextText);
        if (!hasAuthoredFieldImmediatelyAfter) {
          for (const question of questions) {
            const sourceKey = nextSourceKey(question);
            if (questions.length > 1) {
              html.push('<label class="compiled-workbook-question"><span>' + escapeHtml(question) + "</span>" + handbookTextarea(sourceKey, question) + "</label>");
            } else {
              html.push(handbookTextarea(sourceKey, question));
            }
          }
        }
        continue;
      }

      if (handbookFieldCue(text)) {
        html.push(handbookBlockHtml(block));
        const stripped = text.replace(/_{3,}.*$/, "").replace(/\s+/g, " ").trim();
        const previousQuestion = handbookQuestionPrompts(blocks[index - 1]?.lines?.join("\n") || blocks[index - 1]?.text || "")[0] || "";
        const label = stripped || previousQuestion || text;
        const sourceKey = nextSourceKey(label);
        const short = /_{3,}|\/\s*(?:7|10|100)\b|%\s*$|^(?:date|signed|effective from day|confidence|my rating|shift)\s*:/i.test(text);
        html.push(short ? handbookShortControl(sourceKey, label, text) : handbookTextarea(sourceKey, label));
        continue;
      }
    }

    html.push(handbookBlockHtml(block));
  }
  return html.join("\n").trim();
}

function programmeLabel(key: PageKey, body: SourceBlock[]) {
  if (key === "Welcome") return "Welcome";
  if (key === "Certificate") {
    return body.find((block) => strictProgrammePageKey(block.text) === "Certificate")?.text.replace(/\s+/g, " ").trim()
      || body.find((block) => /\bcertificate\b/i.test(block.text))?.text.replace(/\s+/g, " ").trim()
      || key;
  }
  const boundary = body.findIndex((block) => strictProgrammePageKey(block.text) === key);
  const candidates = body.slice(Math.max(0, boundary + 1), Math.max(0, boundary + 8));
  const label = candidates.find((block) => {
    const text = block.text.replace(/\s+/g, " ").trim();
    return text.length >= 3
      && text.length <= 120
      && !strictProgrammePageKey(text)
      && !/^[┌│└]/u.test(text)
      && !/^(session|time|mode|difficulty|today you will|you will need|experiment position)\s*:/i.test(text);
  })?.text.replace(/\s+/g, " ").trim();
  if (label) return label;
  if (key === "Certificate") {
    return body.find((block) => /\bcertificate\b/i.test(block.text))?.text.replace(/\s+/g, " ").trim() || key;
  }
  return key;
}

function programmeExperimentPosition(body: SourceBlock[]) {
  const joined = body
    .flatMap((block) => block.lines?.length ? block.lines : [block.text])
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (let index = 0; index < joined.length; index += 1) {
    const inline = joined[index].match(/^EXPERIMENT POSITION\s*:\s*(.+)$/i);
    if (inline?.[1]) return inline[1].trim();
    if (/^EXPERIMENT POSITION\s*:?$/i.test(joined[index])) {
      return joined[index + 1]?.trim() || null;
    }
  }
  return null;
}

type ManufacturedProgrammePage = {
  key: PageKey;
  label: string;
  html: string;
  experimentPosition?: string | null;
};

function programmePage(key: PageKey, body: SourceBlock[]): ManufacturedProgrammePage {
  const html = renderHandbookPage(body, key);
  if (!html) throw new Error(key + " contains no authored content.");
  return {
    key,
    label: programmeLabel(key, body),
    html,
    experimentPosition: programmeExperimentPosition(body),
  };
}

function balancedProgrammePages(blocks: SourceBlock[], sourceLabel: string) {
  const usable = blocks.filter((block) => block.html.trim());
  if (usable.length < 26) {
    throw new Error(sourceLabel + ": I could read the document, but it is too short to build the full BIS learning journey.");
  }

  const candidates = usable
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) =>
      index > 0 &&
      block.heading &&
      block.text.length >= 3 &&
      block.text.length <= 120 &&
      !sectionNoise.test(block.text),
    )
    .map(({ index }) => index);

  const totalWeight = usable.reduce((sum, block) => sum + Math.max(1, block.text.length), 0);
  const cumulative: number[] = [];
  let running = 0;
  for (const block of usable) {
    running += Math.max(1, block.text.length);
    cumulative.push(running);
  }

  const boundaries = [0];
  for (let page = 1; page < PAGE_KEYS.length; page += 1) {
    const target = (totalWeight * page) / PAGE_KEYS.length;
    let targetIndex = cumulative.findIndex((weight) => weight >= target);
    if (targetIndex < 0) targetIndex = usable.length - 1;
    const minIndex = boundaries[boundaries.length - 1] + 1;
    const maxIndex = usable.length - (PAGE_KEYS.length - page);
    const nearby = candidates
      .filter((index) => index >= minIndex && index <= maxIndex)
      .sort((a, b) => Math.abs(a - targetIndex) - Math.abs(b - targetIndex))[0];
    boundaries.push(Math.max(minIndex, Math.min(maxIndex, nearby ?? targetIndex)));
  }

  return PAGE_KEYS.map((key, index) => {
    const start = boundaries[index];
    const end = boundaries[index + 1] ?? usable.length;
    return programmePage(key, usable.slice(start, end));
  });
}

function pagesFromBlocks(blocks: SourceBlock[], sourceLabel: string) {
  const strictBoundaries: Array<{ key: PageKey; index: number }> = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const key = strictProgrammePageKey(blocks[index].text);
    if (key && !strictBoundaries.some((boundary) => boundary.key === key)) {
      strictBoundaries.push({ key, index });
    }
  }

  const strictFound = new Map(strictBoundaries.map((boundary) => [boundary.key, boundary.index]));
  if (PAGE_KEYS.every((key) => strictFound.has(key))) {
    const ordered = PAGE_KEYS.map((key) => ({ key, index: strictFound.get(key)! }));
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].index <= ordered[index - 1].index) {
        throw new Error(sourceLabel + ": programme headings are out of canonical order near " + ordered[index].key + ".");
      }
    }
    return ordered.map((boundary, index) => {
      const start = index === 0 ? 0 : boundary.index;
      const end = ordered[index + 1]?.index ?? blocks.length;
      return programmePage(boundary.key, blocks.slice(start, end));
    });
  }

  const boundaries: Array<{ key: PageKey; index: number }> = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block.heading) continue;
    const key = canonicalPageKey(block.text);
    if (key) boundaries.push({ key, index });
  }

  const found = new Map(boundaries.map((boundary) => [boundary.key, boundary.index]));
  const missing = PAGE_KEYS.filter((key) => !found.has(key));
  if (missing.length) {
    return balancedProgrammePages(blocks, sourceLabel);
  }

  const ordered = PAGE_KEYS.map((key) => ({ key, index: found.get(key)! }));
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].index <= ordered[index - 1].index) {
      throw new Error(sourceLabel + ": programme headings are out of canonical order near " + ordered[index].key + ".");
    }
  }

  return ordered.map((boundary, index) => {
    const start = index === 0 ? 0 : boundary.index;
    const end = ordered[index + 1]?.index ?? blocks.length;
    return programmePage(boundary.key, blocks.slice(start, end));
  });
}

function tableHtml(rows: string[][]) {
  if (!rows.length) return "";
  const header = rows[0];
  return (
    '<table class="handbook-table"><thead><tr>' +
    header.map((cell) => '<th scope="col">' + escapeHtml(cell) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows.slice(1).map((row) =>
      "<tr>" + row.map((cell, index) =>
        '<td data-label="' + escapeHtml(header[index] ?? "") + '">' + escapeHtml(cell) + "</td>",
      ).join("") + "</tr>",
    ).join("") +
    "</tbody></table>"
  );
}

function splitRowsByKeys(lines: string[], headers: string[], keys: string[]) {
  const rows: string[][] = [headers];
  for (const line of lines.slice(1)) {
    const key = keys.find((candidate) => line === candidate || line.startsWith(candidate + " "));
    if (!key) return null;
    rows.push([key, line.slice(key.length).trim()]);
  }
  return rows;
}

function pseudoTableBlock(lines: string[]): SourceBlock | null {
  if (lines.length < 2) return null;
  const head = lines[0];

  if (head === "Icon Meaning") {
    const rows = [["Icon", "Meaning"], ...lines.slice(1).map((line) => {
      const match = line.match(/^(\S+)\s+(.+)$/u);
      return match ? [match[1], match[2]] : [line, ""];
    })];
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (head === "Icon Level Meaning") {
    const rows = [["Icon", "Level", "Meaning"], ...lines.slice(1).map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+(.+)$/u);
      return match ? [match[1], match[2], match[3]] : [line, "", ""];
    })];
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (["Element My Answer", "Element What Happened", "Element What Was Recorded"].includes(head)) {
    const headers = head === "Element My Answer"
      ? ["Element", "My Answer"]
      : head === "Element What Was Recorded"
        ? ["Element", "What Was Recorded"]
        : ["Element", "What Happened"];
    const rows = [headers, ...lines.slice(1).map((line) => [line, ""])];
    return {
      text: lines.join(" "),
      heading: false,
      lines,
      kind: "table",
      tableRows: rows,
      answerColumn: 1,
      html: tableHtml(rows),
    };
  }

  if (head === "Day Current version backed up?") {
    const rows = [["Day", "Current version backed up?"], ...lines.slice(1).map((line) => {
      const match = line.match(/^(\S+)\s+(.+)$/);
      return match ? [match[1], match[2]] : [line, ""];
    })];
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (head === "Observation Interpretation") {
    const rows = [["Observation", "Interpretation"], ...lines.slice(1).map((line) => {
      const match = line.match(/^(".*?")\s+(".*")$/);
      return match ? [match[1], match[2]] : [line, ""];
    })];
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (head === "Instead of saying Say") {
    const rows = [["Instead of saying", "Say"], ...lines.slice(1).map((line) => {
      const match = line.match(/^(".*?")\s+(".*")$/);
      return match ? [match[1], match[2]] : [line, ""];
    })];
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  const keyed: Record<string, { headers: string[]; keys: string[] }> = {
    "Kind of Evidence Example": {
      headers: ["Kind of Evidence", "Example"],
      keys: ["Written observation", "Witness account", "Recorded data", "Approved artefact", "Approved record"],
    },
    "Concept What It Means": {
      headers: ["Concept", "What It Means"],
      keys: ["Full Risk Check", "Minimum Risk Check", "Full Pause", "Minimum Pause"],
    },
    "State Meaning": {
      headers: ["State", "Meaning"],
      keys: ["SUFFICIENT FOR LAB", "SINGLE-SOURCE", "TRIANGULATED", "REPEATED", "LIMITED", "NONE", "SINGLE OBSERVATION"],
    },
    "If you find Consider": {
      headers: ["If you find", "Consider"],
      keys: [
        "The target context is too rare",
        "The target context is too common",
        "You keep forgetting to check",
        "The check feels too long",
        "The Protective Action is not implemented",
        "The target condition does not appear often",
        "The target condition appears too often",
        "You forget to pause",
        "The Spending Pause feels too long",
        "You missed a day",
        "The pause feels too long",
        "The pause does not change what you notice",
      ],
    },
    "Daily Evidence Card Example": {
      headers: ["Element", "Example"],
      keys: [
        "Time / context",
        "Risk context",
        "Intended Protection Position",
        "Actual Protection Position at start",
        "Protective Action",
        "Observed Protection State after opportunity",
        "Observed Protection State",
        "Action Relationship",
        "Protective Action Implemented?",
        "Protection Coverage Relationship",
        "Protection Criterion Outcome",
        "Trade-off / constraint",
      ],
    },
  };
  const keyedSpec = keyed[head];
  if (keyedSpec) {
    const rows = splitRowsByKeys(lines, keyedSpec.headers, keyedSpec.keys);
    if (rows) return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (head === "What one experiment gives What it does not give") {
    const endings = ["Permanent change", "Automatic new behaviour", "A final answer", "Certainty"];
    const rows = [["What one experiment gives", "What it does not give"]];
    for (let index = 1; index < lines.length; index += 1) {
      const ending = endings[index - 1];
      if (!ending || !lines[index].endsWith(ending)) return null;
      rows.push([lines[index].slice(0, -ending.length).trim(), ending]);
    }
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (head === "Kind of Pattern Observable Criterion I Could Investigate") {
    const rows = [["Kind of Pattern", "Observable Criterion I Could Investigate"]];
    for (const line of lines.slice(1)) {
      const match = line.match(/^(.*?)\s+(".*")$/);
      if (!match) return null;
      rows.push([match[1].trim(), match[2].trim()]);
    }
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  if (head === "Barrier What It Feels Like What to Do") {
    const rows = [["Barrier", "What It Feels Like", "What to Do"]];
    for (const line of lines.slice(1)) {
      const match = line.match(/^(.*?)\s+(".*?")\s+(.+)$/);
      if (!match) return null;
      rows.push([match[1].trim(), match[2].trim(), match[3].trim()]);
    }
    return { text: lines.join(" "), heading: false, lines, kind: "table", tableRows: rows, html: tableHtml(rows) };
  }

  return null;
}

function docxParagraph(block: string): SourceBlock | null {
  const tokens = [...block.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\b[^>]*\/?\s*>|<w:tab\b[^>]*\/?\s*>/g)];
  let raw = "";
  for (const token of tokens) {
    if (token[1] !== undefined) raw += decodeXml(token[1]);
    else if (/^<w:br/i.test(token[0])) raw += "\n";
    else raw += " ";
  }
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const style = block.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";
  const pageBoundary = strictProgrammePageKey(text);
  const iconHeading = /^(📖|💭|✍️|✅|🏠|📂|🔎|⚡|🔬|🎯|🧪|📊|🤝|📌)\s*\S/u.test(text);
  const upperHeading = text.length <= 110
    && /[A-Z]/.test(text)
    && text === text.toUpperCase()
    && !/[.!?]$/.test(text)
    && !/^[┌│└]/u.test(text);
  const heading = /heading|title/i.test(style) || Boolean(pageBoundary) || iconHeading || upperHeading;

  const inferredTable = pseudoTableBlock(lines);
  if (inferredTable) return inferredTable;

  if (lines.some((line) => /[┌┐└┘│─]/u.test(line))) {
    const cleaned = lines
      .map((line) => line.replace(/[┌┐└┘│─]+/gu, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return {
      text,
      heading: false,
      lines: cleaned,
      kind: "paragraph",
      html: '<div class="authored-lines handbook-callout">' + cleaned.map(escapeHtml).join("<br/>") + "</div>",
    };
  }

  if (lines.length >= 2 && lines.every((line) => /^(?:·|•|[-–—]\s)\s*/u.test(line))) {
    const items = lines
      .map((line) => line.replace(/^(?:·|•|[-–—]\s)\s*/u, "").trim())
      .filter(Boolean);
    return {
      text,
      heading: false,
      lines,
      kind: "paragraph",
      html: "<ul>" + items.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>",
    };
  }

  if (lines.length > 1) {
    return {
      text,
      heading,
      lines,
      kind: "paragraph",
      html: (heading ? "<h3>" : '<div class="authored-lines">') +
        lines.map(escapeHtml).join("<br/>") +
        (heading ? "</h3>" : "</div>"),
    };
  }

  const tag = pageBoundary
    ? "h1"
    : /heading1|title/i.test(style)
      ? "h2"
      : /heading2/i.test(style)
        ? "h3"
        : /heading3/i.test(style)
          ? "h4"
          : heading
            ? "h2"
            : "p";
  return { text, heading, lines, kind: "paragraph", html: "<" + tag + ">" + escapeHtml(text) + "</" + tag + ">" };
}

function docxTable(block: string): SourceBlock | null {
  const tableRows = [...block.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) =>
      [...cell[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  ).filter((row) => row.some(Boolean));
  if (!tableRows.length) return null;
  const htmlRows = tableRows.map((row, index) => {
    const tag = index === 0 ? "th" : "td";
    return "<tr>" + row.map((cell) => "<" + tag + ">" + escapeHtml(cell) + "</" + tag + ">").join("") + "</tr>";
  });
  return {
    text: tableRows.map((row) => row.join(" | ")).join(" \n "),
    heading: false,
    html: "<table><tbody>" + htmlRows.join("") + "</tbody></table>",
    tableRows,
    kind: "table",
  };
}

function docxBlocks(bytes: Uint8Array) {
  const documentXml = extractZipByName(bytes, "word/document.xml");
  if (!documentXml) throw new Error("DOCX source does not contain word/document.xml.");
  const xml = new TextDecoder().decode(documentXml);
  const blocks: SourceBlock[] = [];
  for (const match of xml.matchAll(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g)) {
    const block = match[0];
    const converted = match[1] === "tbl" ? docxTable(block) : docxParagraph(block);
    if (converted) blocks.push(converted);
  }
  return blocks;
}

function htmlBlocks(html: string) {
  if (/<\s*(script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:/i.test(html)) {
    throw new Error("HTML source contains executable content that BIS will not compile.");
  }
  const blocks: SourceBlock[] = [];
  const blockPattern = /<(h[1-4]|p|li|blockquote|table)\b[^>]*>[\s\S]*?<\/\1>/gi;
  for (const match of html.matchAll(blockPattern)) {
    const tag = match[1].toLowerCase();
    const text = stripTags(match[0]);
    if (!text) continue;
    const heading = tag.startsWith("h")
      || Boolean(strictProgrammePageKey(text))
      || /^(📖|💭|✍️|✅|🏠|📂|🔎|⚡|🔬|🎯|🧪|📊|🤝|📌)\s*\S/u.test(text);
    blocks.push({ text, heading, html: match[0], kind: tag === "table" ? "table" : "paragraph" });
  }
  return blocks;
}

function markdownBlocks(markdown: string) {
  const blocks: SourceBlock[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];

  const pushText = (text: string, heading = false) => {
    const cleaned = text.trim().replace(/^[-*+]\s+/, "");
    if (!cleaned) return;
    blocks.push({
      text: cleaned,
      heading,
      html: heading ? "<h3>" + escapeHtml(cleaned) + "</h3>" : "<p>" + escapeHtml(cleaned) + "</p>",
    });
  };
  const flush = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    const heading = Boolean(canonicalPageKey(text) && text.length < 80);
    pushText(text, heading);
  };

  for (const line of lines) {
    const explicitHeading = line.match(/^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$/);
    if (explicitHeading) {
      flush();
      pushText(explicitHeading[1], true);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const structural =
      Boolean(strictProgrammePageKey(trimmed))
      || /^investigation\s*[1-9]\b/i.test(trimmed)
      || /^(phase\s+[ab]|mission\s*:|you will produce\s*:|time\s*:|difficulty\s*:)/i.test(trimmed)
      || /^(bei-\d+|step\s+\d+|✍️|☐|⭐|🌱|⏸|🔎|🤔|📖|🧠|🤝|💭|✅|🏠|📂|⚡|🔬|🎯|🧪|📊|📌)/u.test(trimmed)
      || /^(answers?|suggested answers?)\s*:?$/i.test(trimmed)
      || /\?["”]?\s*$/.test(trimmed)
      || handbookFieldCue(trimmed)
      || looksLikeBlank(trimmed);

    if (structural) {
      flush();
      pushText(
        trimmed,
        Boolean(strictProgrammePageKey(trimmed))
          || /^investigation\s*[1-9]\b/i.test(trimmed)
          || /^phase\s+[ab]\b/i.test(trimmed)
          || /^(📖|💭|✍️|✅|🏠|📂|🔎|⚡|🔬|🎯|🧪|📊|🤝|📌)/u.test(trimmed),
      );
      continue;
    }
    paragraph.push(trimmed.replace(/^[-*+]\s+/, ""));
  }
  flush();
  return blocks;
}

function pdfString(value: string) {
  const inner = value.slice(1, -1);
  return inner
    .replace(/\\([nrtbf()\\])/g, (_, code: string) => ({
      n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\",
    })[code] ?? code)
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function pdfTextFromStream(content: string) {
  const chunks: string[] = [];
  for (const bt of content.matchAll(/BT([\s\S]*?)ET/g)) {
    const body = bt[1];
    for (const token of body.matchAll(/\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]+)>/g)) {
      if (token[0].startsWith("(")) chunks.push(pdfString(token[0]));
      else if (token[1]) {
        const hex = token[1].replace(/\s+/g, "");
        if (hex.length % 2 === 0) {
          const pairs = hex.match(/../g) ?? [];
          const decoded = Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
          chunks.push(new TextDecoder().decode(decoded));
        }
      }
    }
    chunks.push("\n");
  }
  return chunks.join(" ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n");
}

function pdfBlocks(bytes: Uint8Array) {
  const raw = Buffer.from(bytes).toString("latin1");
  const extracted: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const start = match.index ?? 0;
    const dict = raw.slice(Math.max(0, start - 700), start);
    const payload = Buffer.from(match[1], "latin1");
    try {
      const decoded = /\/FlateDecode/.test(dict) ? inflateSync(payload).toString("latin1") : payload.toString("latin1");
      const text = pdfTextFromStream(decoded);
      if (text.trim()) extracted.push(text);
    } catch {
      // Image streams and unsupported filters are ignored by this conservative text adapter.
    }
  }

  const text = extracted.join("\n");
  if (!text.trim()) {
    throw new Error("PDF source contains no extractable text. Scanned/image PDFs need a BIS JSON edition package.");
  }

  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  return lines.map((line): SourceBlock => {
    const heading = Boolean(strictProgrammePageKey(line))
      || /^(📖|💭|✍️|✅|🏠|📂|🔎|⚡|🔬|🎯|🧪|📊|🤝|📌)\s*\S/u.test(line);
    return {
      text: line,
      heading,
      kind: "paragraph",
      html: heading ? "<h2>" + escapeHtml(line) + "</h2>" : "<p>" + escapeHtml(line) + "</p>",
    };
  });
}

function programmeSourceSubtitle(blocks: SourceBlock[], metadata: AdaptMetadata, edition: DeliveryEdition) {
  const welcomeIndex = blocks.findIndex((block) => strictProgrammePageKey(block.text) === "Welcome");
  const preface = blocks.slice(0, welcomeIndex >= 0 ? welcomeIndex : Math.min(blocks.length, 16));
  const authored = preface.find((block) =>
    /\bhandbook\b/i.test(block.text)
    && !/^volume\b/i.test(block.text)
    && block.text.length <= 120,
  )?.text.replace(/\s+/g, " ").trim();
  return authored || metadata.title + " · " + edition.replace("_", " ");
}

function encodedPackage(
  code: string,
  version: string,
  edition: DeliveryEdition,
  metadata: AdaptMetadata,
  pages: Array<{ key: PageKey; label: string; html: string; experimentPosition?: string | null }>,
  authority: string,
  subtitle?: string,
) {
  return new TextEncoder().encode(JSON.stringify({
    kind: "LEARNING_MODULE",
    schemaVersion: "2.0",
    identity: {
      code,
      version,
      title: metadata.title,
      subtitle: subtitle || metadata.title + " · " + edition.replace("_", " "),
      slug: metadata.slug,
      handbookId: metadata.slug + "-volume-1",
    },
    edition,
    runtimeVersion: "programme-player-3",
    sourceTrace: {
      authority,
      prototype: authority,
      rule: "Content Studio source adapter preserved extracted authored order; learner responses remain private.",
    },
    treatment: {
      label: edition,
      sourceId: code + "-" + version + "-" + edition,
      privacySummary: "Private learning responses",
      pages,
    },
  }));
}

export async function adaptLearningSource(
  bytes: Uint8Array,
  sourceFormat: ContentSourceFormat,
  code: string,
  version: string,
  edition: DeliveryEdition,
  metadata: AdaptMetadata,
): Promise<Uint8Array> {
  if (sourceFormat === "BIS_PACKAGE_JSON") return bytes;

  if (sourceFormat === "DOCX") {
    const blocks = docxBlocks(bytes);
    return encodedPackage(
      code,
      version,
      edition,
      metadata,
      pagesFromBlocks(blocks, edition + " DOCX"),
      edition + " DOCX",
      programmeSourceSubtitle(blocks, metadata, edition),
    );
  }

  if (sourceFormat === "HTML") {
    const blocks = htmlBlocks(new TextDecoder().decode(bytes));
    return encodedPackage(
      code,
      version,
      edition,
      metadata,
      pagesFromBlocks(blocks, edition + " HTML"),
      edition + " HTML",
      programmeSourceSubtitle(blocks, metadata, edition),
    );
  }

  if (sourceFormat === "MARKDOWN") {
    const blocks = markdownBlocks(new TextDecoder().decode(bytes));
    return encodedPackage(
      code,
      version,
      edition,
      metadata,
      pagesFromBlocks(blocks, edition + " Markdown"),
      edition + " Markdown",
      programmeSourceSubtitle(blocks, metadata, edition),
    );
  }

  if (sourceFormat === "PDF") {
    const blocks = pdfBlocks(bytes);
    return encodedPackage(
      code,
      version,
      edition,
      metadata,
      pagesFromBlocks(blocks, edition + " PDF"),
      edition + " PDF",
      programmeSourceSubtitle(blocks, metadata, edition),
    );
  }

  if (sourceFormat === "ZIP") {
    const entries = zipEntries(bytes);
    const preferred = [
      edition + ".json",
      code.toLowerCase() + "-" + edition + ".json",
      metadata.slug + "-" + edition + ".json",
    ];
    const jsonEntry = preferred
      .map((name) => entries.find((entry) => entry.name.toLowerCase().endsWith(name.toLowerCase())))
      .find(Boolean)
      ?? entries.find((entry) => entry.name.toLowerCase().endsWith(".json"));
    if (jsonEntry) return extractZipEntry(bytes, jsonEntry);

    const docxEntry = entries.find((entry) => entry.name.toLowerCase().endsWith(".docx"));
    if (docxEntry) {
      return adaptLearningSource(extractZipEntry(bytes, docxEntry), "DOCX", code, version, edition, metadata);
    }
    throw new Error(edition + ": ZIP package must contain a BIS JSON edition package or DOCX source.");
  }

  throw new Error(edition + ": " + sourceFormat + " has no approved learning adapter.");
}

function labInvestigationNumber(value: string) {
  const cleaned = value.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  if (/^investigation\s*[1-9]\s*of\s*9\s*$/i.test(cleaned)) return null;
  const match = cleaned.match(/^investigation\s*([1-9])(?:\s*of\s*9)?\b/i);
  return match ? Number(match[1]) : null;
}

function labInvestigationTitle(value: string, number: number) {
  return value
    .replace(/[–—]/g, "-")
    .replace(new RegExp("^investigation\\s*" + number + "(?:\\s*of\\s*9)?\\s*(?:[-:·|]\\s*)?", "i"), "")
    .replace(/\s*\([^)]*\)\s*[|·]\s*[^\s]+$/u, "")
    .trim();
}

function cleanAuthoredText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[“"]|[”"]$/g, "")
    .trim();
}

function stableLabToken(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function labPromptId(code: string, investigation: number, seed: string, occurrence = 1) {
  return code + ".I" + investigation + "." + stableLabToken(seed) + (occurrence > 1 ? "." + occurrence : "");
}

function checkboxOptions(value: string) {
  return [...value.matchAll(/☐\s*([^☐]+)/g)]
    .map((match) => cleanAuthoredText(match[1] ?? ""))
    .map((item) => item.replace(/^[-–—:|]+\s*/, "").trim())
    .filter(Boolean);
}

function looksLikeBlank(value: string) {
  return /_{3,}|\.{5,}|_{2,}\s*\/\s*\d+/u.test(value);
}

function formLabel(value: string) {
  return cleanAuthoredText(value)
    .replace(/^✍️\s*/u, "")
    .replace(/\s*_{3,}.*$/u, "")
    .replace(/\s*☐.*$/u, "")
    .replace(/\s*:\s*$/u, "")
    .trim();
}

function looksLikeAnswerMarker(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (/^["“]I,\s*_{3}/i.test(text)) return false;
  if (/^✍️\s*Complete this sentence\s*:?$/iu.test(text)) return false;
  if (/^✍️/u.test(text) || looksLikeBlank(text) || /☐/.test(text)) return true;
  if (/^(signed|date|from me, in grade)\s*:/i.test(text)) return true;
  if (/^(bei-\d+[^:]*:).*(?:___|\/\s*\d+)/i.test(text)) return true;
  return false;
}

function promptQuestions(value: string) {
  const text = cleanAuthoredText(value);
  if (!text) return [] as string[];
  const numbered = [...text.matchAll(/(?:^|\s)(?:[1-9]|1\d)[.)]\s*([^?]{5,700}\?)/g)]
    .map((match) => cleanAuthoredText(match[1] ?? ""))
    .filter(Boolean);
  if (numbered.length) return numbered;
  const questionMark = text.lastIndexOf("?");
  if (questionMark >= 0 && text.length <= 900) {
    return [text.slice(0, questionMark + 1).replace(/^\d+[.)]\s*/, "").trim()];
  }
  return [] as string[];
}

type ImportedPromptSpec = {
  label: string;
  type: "TEXT" | "INTEGER" | "BOOLEAN" | "CATEGORICAL" | "MULTI_SELECT" | "DATE";
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
};

function promptSpecFromMarker(marker: string, question: string): ImportedPromptSpec {
  const options = checkboxOptions(marker);
  const label = formLabel(marker) || formLabel(question) || "Your answer";
  if (options.length) {
    const yesNo = options.length === 2
      && options.map((item) => item.toLowerCase()).sort().join("|") === "no|yes";
    const multi = /tick all|all that apply|affects|select all/i.test(question + " " + marker);
    return {
      label,
      type: yesNo ? "BOOLEAN" as const : multi ? "MULTI_SELECT" as const : "CATEGORICAL" as const,
      options: yesNo ? undefined : options,
      placeholder: undefined,
    };
  }
  const range = marker.match(/\/\s*(10|7|5)\b/);
  if (range) {
    return {
      label,
      type: "INTEGER" as const,
      options: undefined,
      placeholder: undefined,
      min: range[1] === "10" ? 1 : 0,
      max: Number(range[1]),
    };
  }
  if (/^date\s*:/i.test(marker)) {
    return { label: label || "Date", type: "DATE" as const, options: undefined, placeholder: undefined };
  }
  return {
    label,
    type: "TEXT" as const,
    options: undefined,
    placeholder: /equation/i.test(label) ? "Write your working equation…" : "Write your answer…",
  };
}

type ImportedPrompt = {
  id: string;
  label: string;
  prompt: string;
  type: "TEXT" | "INTEGER" | "BOOLEAN" | "CATEGORICAL" | "MULTI_SELECT" | "DATE";
  placeholder?: string;
  sensitivity: "P2" | "P3";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  group?: string;
};

type ImportedRenderBlock =
  | { type: "HTML"; html: string }
  | { type: "PROMPT"; promptId: string };

function addPrompt(
  prompts: ImportedPrompt[],
  renderBlocks: ImportedRenderBlock[],
  code: string,
  investigation: number,
  prompt: Omit<ImportedPrompt, "id">,
) {
  const seed = prompt.prompt + "|" + prompt.label + "|" + (prompt.group ?? "");
  const sameSeed = prompts.filter((item) => item.id.startsWith(code + ".I" + investigation + "." + stableLabToken(seed))).length;
  const id = labPromptId(code, investigation, seed, sameSeed + 1);
  prompts.push({ id, ...prompt });
  renderBlocks.push({ type: "PROMPT", promptId: id });
  return id;
}

function promptsFromTable(
  block: SourceBlock,
  code: string,
  investigation: number,
  prompts: ImportedPrompt[],
  renderBlocks: ImportedRenderBlock[],
) {
  const rows = block.tableRows;
  if (!rows || rows.length < 2) return false;
  const headers = rows[0].map((cell) => cleanAuthoredText(cell).replace(/\*\*/g, ""));
  const joined = headers.join(" | ").toLowerCase();

  if (joined.includes("behaviour") && headers.some((header) => /^never$/i.test(header))) {
    const options = headers.slice(1).filter(Boolean);
    for (const row of rows.slice(1)) {
      const behaviour = cleanAuthoredText(row[0] ?? "");
      if (!behaviour) continue;
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: behaviour,
        prompt: behaviour,
        type: "CATEGORICAL",
        options,
        sensitivity: "P2",
        required: true,
        group: "Risk baseline",
      });
    }
    return true;
  }

  if (joined.includes("day") && joined.includes("action") && joined.includes("notes")) {
    for (const row of rows.slice(1)) {
      const day = cleanAuthoredText(row[0] ?? "");
      if (!day) continue;
      const group = "Day " + day;
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " date",
        prompt: "Date",
        type: "DATE",
        sensitivity: "P2",
        required: false,
        group,
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " action",
        prompt: headers[2] || "Action I took",
        type: "TEXT",
        placeholder: "What action did you take or notice?",
        sensitivity: "P2",
        required: true,
        group,
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " action check",
        prompt: headers[3] || "Did I take action?",
        type: "BOOLEAN",
        sensitivity: "P2",
        required: true,
        group,
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " notes",
        prompt: headers[4] || "Notes",
        type: "TEXT",
        sensitivity: "P2",
        required: false,
        group,
      });
    }
    return true;
  }

  if (joined.includes("risk") && joined.includes("probability") && joined.includes("magnitude")) {
    for (const row of rows.slice(1)) {
      const index = cleanAuthoredText(row[0] ?? "") || String(rows.indexOf(row));
      const group = "Risk " + index.replace(/[.\s]+$/g, "");
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group,
        prompt: "Name the risk",
        type: "TEXT",
        sensitivity: "P2",
        required: true,
        group,
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " probability",
        prompt: "Probability (1–5)",
        type: "INTEGER",
        min: 1,
        max: 5,
        sensitivity: "P2",
        required: true,
        group,
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " magnitude",
        prompt: "Magnitude (1–5)",
        type: "INTEGER",
        min: 1,
        max: 5,
        sensitivity: "P2",
        required: true,
        group,
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: group + " score",
        prompt: "Risk Score (Probability × Magnitude)",
        type: "INTEGER",
        min: 1,
        max: 25,
        sensitivity: "P2",
        required: true,
        group,
      });
    }
    return true;
  }

  if (joined.includes("element") && joined.includes("your answer")) {
    for (const row of rows.slice(1)) {
      const label = cleanAuthoredText(row[0] ?? "");
      if (!label) continue;
      addPrompt(prompts, renderBlocks, code, investigation, {
        label,
        prompt: label,
        type: "TEXT",
        sensitivity: "P2",
        required: false,
        group: "Behaviour Profile Summary",
      });
    }
    return true;
  }

  return false;
}

function valueAfterLabel(blocks: SourceBlock[], label: RegExp) {
  for (const block of blocks) {
    const match = block.text.match(label);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function isLabMetadataLine(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return (
    /^■+□*\s*\d\/9$/u.test(text)
    || /^mission\s*:/i.test(text)
    || /^you will produce\s*:?\s*$/i.test(text)
    || /^time\s*:/i.test(text)
    || /^difficulty\s*:/i.test(text)
    || /^phase [ab]\s*:/i.test(text)
  );
}

function isProduceLine(value: string) {
  return /^[●•-]?\s*☐\s*/u.test(value.trim());
}

function isStandaloneField(value: string) {
  const text = cleanAuthoredText(value);
  if (!text) return false;
  if (/^["“]I,\s*_{3}/i.test(value.trim())) return false;
  if (/^✍️\s*Complete this sentence\s*:?$/iu.test(value.trim())) return false;
  if (/^✍️/u.test(value.trim())) return true;
  if (looksLikeBlank(text)) return true;
  if (/^(one risk i will address|my protection action|my witness|what i will do if|my failure signal|my biggest risk|my current protection|my priority risk|the cost|the gap|avoided risk|most expensive risk|reducible risk|unprotected risks|my equation|signed|date|from me, in grade)\b/i.test(text)) return true;
  if (/^dear future me\b/i.test(text)) return true;
  return false;
}

function labBodyToRuntime(
  body: SourceBlock[],
  code: string,
  investigation: number,
) {
  const prompts: ImportedPrompt[] = [];
  const renderBlocks: ImportedRenderBlock[] = [];
  let html: string[] = [];

  const flushHtml = () => {
    const content = html.join("\n").trim();
    html = [];
    if (content) renderBlocks.push({ type: "HTML", html: content });
  };

  for (let index = 0; index < body.length; index += 1) {
    const block = body[index];
    const text = block.text.replace(/\s+/g, " ").trim();
    if (!text || isLabMetadataLine(text) || isProduceLine(text)) continue;

    if (block.tableRows) {
      flushHtml();
      if (!promptsFromTable(block, code, investigation, prompts, renderBlocks)) {
        renderBlocks.push({ type: "HTML", html: block.html });
      }
      continue;
    }

    if (/^dear future me\b/i.test(cleanAuthoredText(text))) {
      flushHtml();
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: "Letter to My Future Self",
        prompt: "Write your letter to Future Me.",
        type: "TEXT",
        placeholder: "Dear Future Me…",
        sensitivity: "P3",
        required: true,
      });
      continue;
    }

    if (/days completed\s*:.*risk actions taken\s*:/i.test(text)) {
      flushHtml();
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: "Days Completed",
        prompt: "How many of the seven days did you complete?",
        type: "INTEGER",
        min: 0,
        max: 7,
        sensitivity: "P2",
        required: true,
        group: "BEI-06",
      });
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: "Risk Actions Taken",
        prompt: "On how many of the seven days did you take a risk action?",
        type: "INTEGER",
        min: 0,
        max: 7,
        sensitivity: "P2",
        required: true,
        group: "BEI-06",
      });
      continue;
    }

    if (isStandaloneField(text)) {
      flushHtml();
      const spec = promptSpecFromMarker(text, formLabel(text));
      const previousHeading = [...body.slice(Math.max(0, index - 4), index)]
        .reverse()
        .find((candidate) => candidate.heading)?.text;
      const ownLabel = formLabel(text);
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: ownLabel || previousHeading || "Your answer",
        prompt: ownLabel || previousHeading || "Write your answer",
        type: spec.type,
        options: spec.options,
        min: spec.min,
        max: spec.max,
        placeholder: spec.placeholder,
        sensitivity: /future self|identity|health|relationship/i.test((previousHeading ?? "") + " " + text) ? "P3" : "P2",
        required: !/^(date|signed|from me, in grade)\b/i.test(ownLabel),
      });
      continue;
    }

    const inlineOptions = checkboxOptions(text);
    const inlineQuestion = promptQuestions(text);
    if (inlineOptions.length && inlineQuestion.length) {
      flushHtml();
      const question = inlineQuestion[0];
      const spec = promptSpecFromMarker(text, question);
      addPrompt(prompts, renderBlocks, code, investigation, {
        label: spec.label || question,
        prompt: question,
        type: spec.type,
        options: spec.options,
        min: spec.min,
        max: spec.max,
        placeholder: spec.placeholder,
        sensitivity: /future self|identity|health|relationship/i.test(question) ? "P3" : "P2",
        required: true,
      });
      continue;
    }

    const questions = promptQuestions(text);
    const markers: SourceBlock[] = [];
    let cursor = index + 1;
    while (cursor < body.length && markers.length < 8) {
      const candidate = body[cursor];
      const candidateText = candidate.text.replace(/\s+/g, " ").trim();
      if (!candidateText) {
        cursor += 1;
        continue;
      }
      if (candidate.tableRows || candidate.heading || !looksLikeAnswerMarker(candidateText)) break;
      markers.push(candidate);
      cursor += 1;
    }
    const promptLead = questions[0]
      || (
        markers.length
        && text.length <= 700
        && !/^continue your (?:journey|investigation)/i.test(cleanAuthoredText(text))
        && !/^I,\s*_{3}.*commit to/i.test(cleanAuthoredText(text))
        ? cleanAuthoredText(text)
        : ""
      );
    if (promptLead && markers.length) {
      flushHtml();
      if (markers.length === 1) {
        const marker = markers[0].text;
        const spec = promptSpecFromMarker(marker, promptLead);
        addPrompt(prompts, renderBlocks, code, investigation, {
          label: spec.label || promptLead,
          prompt: promptLead,
          type: spec.type,
          options: spec.options,
          min: spec.min,
          max: spec.max,
          placeholder: spec.placeholder,
          sensitivity: /future self|identity|health|relationship/i.test(promptLead) ? "P3" : "P2",
          required: true,
        });
      } else {
        for (const marker of markers) {
          const spec = promptSpecFromMarker(marker.text, promptLead);
          addPrompt(prompts, renderBlocks, code, investigation, {
            label: spec.label || promptLead,
            prompt: spec.label && spec.label !== "Your answer"
              ? promptLead + " — " + spec.label
              : promptLead,
            type: spec.type,
            options: spec.options,
            min: spec.min,
            max: spec.max,
            placeholder: spec.placeholder,
            sensitivity: "P2",
            required: true,
          });
        }
      }
      index = cursor - 1;
      continue;
    }

    html.push(block.html);
  }
  flushHtml();

  return { prompts, renderBlocks };
}

function labPackageFromBlocks(
  blocks: SourceBlock[],
  code: string,
  version: string,
  metadata: AdaptMetadata,
) {
  const facilitatorIndex = blocks.findIndex((block) => /\bfacilitator guide\b/i.test(block.text));
  const certificateIndex = blocks.findIndex((block) => /\b(?:transformation|completion) certificate\b/i.test(block.text));
  const learnerEndCandidates = [facilitatorIndex, certificateIndex].filter((index) => index > 0);
  const learnerEnd = learnerEndCandidates.length ? Math.min(...learnerEndCandidates) : blocks.length;
  const learnerBlocks = blocks.slice(0, learnerEnd);

  const boundaries: Array<{ number: number; index: number; title: string }> = [];
  for (let index = 0; index < learnerBlocks.length; index += 1) {
    const number = labInvestigationNumber(learnerBlocks[index].text);
    if (!number) continue;
    if (boundaries.some((boundary) => boundary.number === number)) continue;
    boundaries.push({
      number,
      index,
      title: labInvestigationTitle(learnerBlocks[index].text, number),
    });
  }
  boundaries.sort((a, b) => a.number - b.number);

  const expected = Array.from({ length: 9 }, (_, index) => index + 1);
  const found = boundaries.map((boundary) => boundary.number);
  const missing = expected.filter((number) => !found.includes(number));
  if (missing.length) {
    throw new Error(
      "I could read the Lab, but I could not find all nine investigation sections. " +
      "Keep the learner headings “Investigation 1” through “Investigation 9”. Missing: " +
      missing.join(", ") + ".",
    );
  }

  const baselineStart = learnerBlocks.findIndex((block) => /\bbaseline\b.*\bpre\b/i.test(block.text));
  const investigations = boundaries.map((boundary, boundaryIndex) => {
    const end = boundaries[boundaryIndex + 1]?.index ?? learnerBlocks.length;
    const authoredBody = learnerBlocks.slice(boundary.index + 1, end);
    const body = boundary.number === 1 && baselineStart >= 0 && baselineStart < boundary.index
      ? [...learnerBlocks.slice(baselineStart, boundary.index), ...authoredBody]
      : authoredBody;

    const mission = valueAfterLabel(authoredBody, /^mission\s*[:\-]\s*(.+)$/i)
      || authoredBody.find((block) => block.text && !block.heading)?.text
      || "Investigate what the evidence shows.";
    const time = valueAfterLabel(authoredBody, /^(?:time|duration)\s*[:\-]\s*(.+)$/i) || "10 minutes";
    const difficulty = valueAfterLabel(authoredBody, /^difficulty\s*[:\-]\s*(.+)$/i) || "Observe";
    const producesIndex = authoredBody.findIndex((block) => /^you will produce\s*:?$/i.test(block.text));
    const produced: string[] = [];
    if (producesIndex >= 0) {
      for (let cursor = producesIndex + 1; cursor < authoredBody.length; cursor += 1) {
        const text = authoredBody[cursor].text.trim();
        if (!text) continue;
        if (/^(?:time|difficulty|mission)\s*:/i.test(text) || authoredBody[cursor].heading) break;
        if (isProduceLine(text)) produced.push(text.replace(/^[●•-]?\s*☐\s*/u, "").trim());
        else if (produced.length) break;
      }
    }

    const runtime = labBodyToRuntime(body, code, boundary.number);
    if (!runtime.prompts.length) {
      throw new Error(
        "Investigation " + boundary.number +
        ": I found the learner section, but I could not find an answer field. " +
        "Keep the learner question together with its checkbox, writing line, table or answer label.",
      );
    }

    return {
      number: boundary.number,
      title: boundary.title || "Investigation " + boundary.number,
      mission: mission.replace(/^mission\s*[:\-]\s*/i, ""),
      phase: boundary.number === 7
        ? "Experiment"
        : boundary.number === 8
          ? "Review"
          : boundary.number === 9
            ? "Synthesis"
            : "Investigation",
      time,
      difficulty,
      produces: produced,
      blocks: runtime.renderBlocks,
      prompts: runtime.prompts,
    };
  });

  return new TextEncoder().encode(JSON.stringify({
    kind: "LAB",
    schemaVersion: "universal-lab-v1",
    runtimeProfile: "UNIVERSAL_V1",
    identity: {
      code,
      version,
      title: metadata.title,
      shortTitle: metadata.title.replace(/\s*Learning Module$/i, ""),
      accent: "#2f8276",
      focus: "A private behavioural investigation.",
    },
    investigations,
  }));
}

export async function adaptLabSource(
  bytes: Uint8Array,
  sourceFormat: ContentSourceFormat,
  code: string,
  version: string,
  metadata: AdaptMetadata,
) {
  if (sourceFormat === "BIS_PACKAGE_JSON") return bytes;
  if (sourceFormat === "ZIP") {
    const entries = zipEntries(bytes);
    const jsonEntry = entries.find((candidate) => candidate.name.toLowerCase().endsWith(".json"));
    if (jsonEntry) return extractZipEntry(bytes, jsonEntry);
    const docxEntry = entries.find((candidate) => candidate.name.toLowerCase().endsWith(".docx"));
    if (docxEntry) {
      return adaptLabSource(extractZipEntry(bytes, docxEntry), "DOCX", code, version, metadata);
    }
    throw new Error("The ZIP does not contain a Lab JSON package or Word document.");
  }

  if (sourceFormat === "DOCX") {
    return labPackageFromBlocks(docxBlocks(bytes), code, version, metadata);
  }
  if (sourceFormat === "PDF") {
    return labPackageFromBlocks(pdfBlocks(bytes), code, version, metadata);
  }
  if (sourceFormat === "HTML") {
    return labPackageFromBlocks(htmlBlocks(new TextDecoder().decode(bytes)), code, version, metadata);
  }
  if (sourceFormat === "MARKDOWN") {
    return labPackageFromBlocks(markdownBlocks(new TextDecoder().decode(bytes)), code, version, metadata);
  }

  throw new Error("I can store this Lab source, but I cannot read this file type yet.");
}
