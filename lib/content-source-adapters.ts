import "server-only";
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
  if (/^(certificate|completion certificate)\b/.test(cleaned)) return "Certificate";
  const day = cleaned.match(/^day\s*(10|[1-9])\b/);
  if (day) return ("Day " + day[1]) as PageKey;
  return null;
}

type SourceBlock = {
  text: string;
  html: string;
  heading: boolean;
};

function pagesFromBlocks(blocks: SourceBlock[], sourceLabel: string) {
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
    throw new Error(sourceLabel + ": could not find all 13 BIS programme headings. Missing: " + missing.join(", ") + ".");
  }

  const ordered = PAGE_KEYS.map((key) => ({ key, index: found.get(key)! }));
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].index <= ordered[index - 1].index) {
      throw new Error(sourceLabel + ": programme headings are out of canonical order near " + ordered[index].key + ".");
    }
  }

  return ordered.map((boundary, index) => {
    const end = ordered[index + 1]?.index ?? blocks.length;
    const body = blocks.slice(boundary.index, end);
    const html = body.map((block) => block.html).join("\n").trim();
    if (!html) throw new Error(sourceLabel + ": " + boundary.key + " contains no authored content.");
    return {
      key: boundary.key,
      label: boundary.key,
      html,
    };
  });
}

function docxParagraph(block: string): SourceBlock | null {
  const texts = [...block.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1]));
  const text = texts.join("").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const style = block.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";
  const heading = /heading|title/i.test(style) || Boolean(canonicalPageKey(text) && text.length < 80);
  const tag = /heading1|title/i.test(style) ? "h2" : /heading2/i.test(style) ? "h3" : /heading3/i.test(style) ? "h4" : "p";
  return { text, heading, html: "<" + tag + ">" + escapeHtml(text) + "</" + tag + ">" };
}

function docxTable(block: string): SourceBlock | null {
  const rows = [...block.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((row) => {
    const cells = [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) => {
      const text = [...cell[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("").trim();
      return "<td>" + escapeHtml(text) + "</td>";
    }).join("");
    return cells ? "<tr>" + cells + "</tr>" : "";
  }).filter(Boolean);
  if (!rows.length) return null;
  return { text: "", heading: false, html: "<table><tbody>" + rows.join("") + "</tbody></table>" };
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
    const heading = tag.startsWith("h") || Boolean(canonicalPageKey(text) && text.length < 80);
    blocks.push({ text, heading, html: match[0] });
  }
  return blocks;
}

function markdownBlocks(markdown: string) {
  const blocks: SourceBlock[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];

  const flush = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    const heading = Boolean(canonicalPageKey(text) && text.length < 80);
    blocks.push({
      text,
      heading,
      html: heading ? "<h2>" + escapeHtml(text) + "</h2>" : "<p>" + escapeHtml(text) + "</p>",
    });
  };

  for (const line of lines) {
    const heading = line.match(/^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const text = heading[1].trim();
      const level = Math.min(4, Math.max(2, (line.match(/^#+/)?.[0].length ?? 1) + 1));
      blocks.push({ text, heading: true, html: "<h" + level + ">" + escapeHtml(text) + "</h" + level + ">" });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    paragraph.push(line.trim().replace(/^[-*+]\s+/, ""));
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
    const heading = Boolean(canonicalPageKey(line) && line.length < 100);
    return {
      text: line,
      heading,
      html: heading ? "<h2>" + escapeHtml(line) + "</h2>" : "<p>" + escapeHtml(line) + "</p>",
    };
  });
}

function encodedPackage(
  code: string,
  version: string,
  edition: DeliveryEdition,
  metadata: AdaptMetadata,
  pages: Array<{ key: PageKey; label: string; html: string }>,
  authority: string,
) {
  return new TextEncoder().encode(JSON.stringify({
    kind: "LEARNING_MODULE",
    schemaVersion: "2.0",
    identity: {
      code,
      version,
      title: metadata.title,
      subtitle: metadata.title + " · " + edition.replace("_", " "),
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
    return encodedPackage(code, version, edition, metadata, pagesFromBlocks(docxBlocks(bytes), edition + " DOCX"), edition + " DOCX");
  }

  if (sourceFormat === "HTML") {
    const html = new TextDecoder().decode(bytes);
    return encodedPackage(code, version, edition, metadata, pagesFromBlocks(htmlBlocks(html), edition + " HTML"), edition + " HTML");
  }

  if (sourceFormat === "MARKDOWN") {
    const markdown = new TextDecoder().decode(bytes);
    return encodedPackage(code, version, edition, metadata, pagesFromBlocks(markdownBlocks(markdown), edition + " Markdown"), edition + " Markdown");
  }

  if (sourceFormat === "PDF") {
    return encodedPackage(code, version, edition, metadata, pagesFromBlocks(pdfBlocks(bytes), edition + " PDF"), edition + " PDF");
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

export function adaptLabSource(bytes: Uint8Array, sourceFormat: ContentSourceFormat) {
  if (sourceFormat === "BIS_PACKAGE_JSON") return bytes;
  if (sourceFormat === "ZIP") {
    const entry = zipEntries(bytes).find((candidate) => candidate.name.toLowerCase().endsWith(".json"));
    if (!entry) throw new Error("Lab ZIP package must contain a Universal Lab JSON package.");
    return extractZipEntry(bytes, entry);
  }
  throw new Error(sourceFormat + " Lab sources are retained safely, but Universal Lab activation requires BIS JSON or a ZIP containing it.");
}
