import { sanitizeContentHtml } from "./content-html.mjs";
import { DELIVERY_EDITIONS, type DeliveryEdition } from "./learning-foundation";
import type { LabFactoryCapabilities } from "./lab-factory-capabilities.mjs";
import {
  upgradeUniversalLabV2,
  type UniversalComputedField,
  type UniversalExperimentContract,
  type UniversalIndicatorBinding,
  type UniversalProfileEntry,
} from "./universal-lab-v2.mjs";
import { sha256Hex } from "./content-studio";

export const CONTENT_COMPILER_VERSION = "bis-content-compiler-2";
export const LEARNING_EDITION_KEYS = [...DELIVERY_EDITIONS] as const;

export type RuntimeArtifact = {
  artifactKey: string;
  deliveryEdition: DeliveryEdition | null;
  content: string;
  hash: string;
  bytes: number;
  mimeType: "application/json";
};

export type LearningEditionSource = {
  kind?: string;
  schemaVersion?: string;
  identity?: {
    code?: string;
    version?: string;
    title?: string;
    subtitle?: string;
    slug?: string;
    handbookId?: string;
  };
  labCode?: string;
  contentVersion?: string;
  title?: string;
  subtitle?: string;
  slug?: string;
  handbookId?: string;
  edition?: string;
  runtimeVersion?: string;
  sourceTrace?: {
    authority?: string;
    prototype?: string;
    rule?: string;
  };
  treatment?: {
    label?: string;
    sourceId?: string;
    contentHash?: string;
    privacySummary?: string;
    pages?: unknown[];
  };
  pages?: unknown[];
};

export type UniversalLabPrompt = {
  id: string;
  label: string;
  prompt: string;
  type?: "TEXT" | "INTEGER" | "BOOLEAN" | "CATEGORICAL" | "MULTI_SELECT" | "DATE";
  readOnly?: boolean;
  scheduleDay?: number;
  computed?: UniversalComputedField;
  indicatorCode?: string;
  indicatorLabel?: string;
  placeholder?: string;
  sensitivity?: "P1" | "P2" | "P3";
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  group?: string;
};

export type UniversalLabRenderBlock =
  | { type: "HTML"; html: string }
  | { type: "PROMPT"; promptId: string };

export type UniversalLabInvestigation = {
  number: number;
  title: string;
  mission: string;
  phase: string;
  time: string;
  difficulty: string;
  produces: string[];
  introHtml?: string;
  blocks?: UniversalLabRenderBlock[];
  prompts: UniversalLabPrompt[];
};

export type UniversalLabPackage = {
  kind: "LAB";
  schemaVersion: "universal-lab-v1" | "universal-lab-v2";
  runtimeProfile: "UNIVERSAL_V1" | "UNIVERSAL_V2";
  identity: {
    code: string;
    version: string;
    title: string;
    shortTitle: string;
    accent: string;
    focus?: string;
  };
  factoryCapabilities?: LabFactoryCapabilities;
  computedFields?: UniversalComputedField[];
  indicatorRegistry?: UniversalIndicatorBinding[];
  experiment?: UniversalExperimentContract | null;
  profile?: null | { investigation: number; entries: UniversalProfileEntry[] };
  investigations: UniversalLabInvestigation[];
};

const pageKeys = [
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

const unsafeHtml = /<\s*(script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:/i;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJson(bytes: Uint8Array) {
  try {
    return object(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function programmeStep(code: string, key: string) {
  if (key === "Welcome") return `${code}.PROGRAMME.WELCOME`;
  if (key === "Weekend") return `${code}.PROGRAMME.WEEKEND`;
  if (key === "Certificate") return `${code}.PROGRAMME.CERTIFICATE`;
  return `${code}.PROGRAMME.DAY${key.replace("Day ", "")}`;
}

function programmeDay(key: string) {
  if (!key.startsWith("Day ")) return null;
  const value = Number(key.slice(4));
  return Number.isFinite(value) ? value : null;
}

function defaultPhase(key: string) {
  if (key === "Welcome") return "ORIENTATION";
  if (key === "Day 3") return "LAB";
  if (key === "Day 4" || key === "Day 5") return "LEARN_EXPERIMENT";
  if (key === "Weekend" || key === "Day 6" || key === "Day 7") return "EXPERIMENT";
  if (key === "Day 8") return "REVIEW";
  if (key === "Day 9") return "TRANSFER";
  if (key === "Day 10") return "INTEGRATE";
  if (key === "Certificate") return "CERTIFICATE";
  return "LEARN";
}

function stableWorkbookToken(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function ensureWorkbookBindings(html: string, code: string, edition: DeliveryEdition, pageKey: string) {
  let counter = 0;
  return html.replace(/<(textarea|input|select)\b([^>]*)>/gi, (match, tagName: string, attributes: string) => {
    counter += 1;
    if (unsafeHtml.test(match)) throw new Error(`${pageKey}: unsafe workbook control markup.`);
    const hasId = /\bdata-field-id\s*=/.test(attributes);
    const sourceMatch = attributes.match(/\bdata-source-key\s*=\s*["']([^"']+)["']/i);
    const hasSource = Boolean(sourceMatch);
    const hasPurpose = /\bdata-purpose\s*=/.test(attributes);
    const hasPrivacy = /\bdata-privacy-class\s*=/.test(attributes);
    const sourceKey = sourceMatch?.[1] || `${pageKey.replace(/\s+/g, "").toLowerCase()}-${counter}`;
    let next = tagName.toLowerCase() === "input" ? attributes.replace(/\/\s*$/, "") : attributes;
    if (!hasId) {
      const token = stableWorkbookToken(`${pageKey}|${sourceKey}`);
      next += ` data-field-id="${code}.WB.${edition.toUpperCase()}.${pageKey.replace(/\s+/g, "").toUpperCase()}.AUTO.${token}"`;
    }
    if (!hasSource) next += ` data-source-key="${sourceKey}"`;
    if (!hasPurpose) next += ' data-purpose="LEARNING_RESPONSE"';
    if (!hasPrivacy) next += ' data-privacy-class="P3"';
    if (tagName.toLowerCase() === "textarea" && !/\bmaxlength\s*=/.test(attributes)) next += ' maxlength="20000"';
    return `<${tagName}${next}>`;
  });
}

function validatePageHtml(html: string, key: string) {
  if (!html.trim()) throw new Error(`${key}: page content is empty.`);
  if (unsafeHtml.test(html)) throw new Error(`${key}: executable HTML is not allowed.`);
}

async function canonicalHash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return sha256Hex(bytes);
}

export async function compileLearningEdition(
  bytes: Uint8Array,
  expectedCode: string,
  expectedVersion: string,
  edition: DeliveryEdition,
): Promise<RuntimeArtifact> {
  const source = parseJson(bytes) as LearningEditionSource | null;
  if (!source) throw new Error(`${edition}: source must be a BIS JSON edition package.`);

  const identity = object(source.identity);
  const code = text(identity?.code) || text(source.labCode);
  const version = text(identity?.version) || text(source.contentVersion);
  if (code !== expectedCode) throw new Error(`${edition}: package code ${code || "missing"} does not match ${expectedCode}.`);
  if (version !== expectedVersion) throw new Error(`${edition}: package version ${version || "missing"} does not match ${expectedVersion}.`);
  if (source.edition && source.edition !== edition) throw new Error(`${edition}: uploaded package identifies itself as ${source.edition}.`);

  const treatment = object(source.treatment);
  const rawPages = Array.isArray(treatment?.pages)
    ? treatment.pages
    : Array.isArray(source.pages)
      ? source.pages
      : [];
  if (rawPages.length !== pageKeys.length) {
    throw new Error(`${edition}: every BIS learning edition must contain all 13 programme positions.`);
  }

  const compiledPages = rawPages.map((raw, index) => {
    const page = object(raw);
    if (!page) throw new Error(`${edition}: page ${index + 1} is invalid.`);
    const key = text(page.key);
    const expectedKey = pageKeys[index];
    if (key !== expectedKey) {
      throw new Error(`${edition}: programme position ${index + 1} must be "${expectedKey}", received "${key || "missing"}".`);
    }
    const html = sanitizeContentHtml(ensureWorkbookBindings(text(page.html), expectedCode, edition, key));
    validatePageHtml(html, key);
    const id = programmeStep(expectedCode, key);
    const authoredId = text(page.id);
    if (authoredId && authoredId !== id) throw new Error(`${edition}: ${key} must use semantic step ID ${id}.`);
    return {
      id,
      key,
      label: text(page.label) || key,
      phase: text(page.phase) || defaultPhase(key),
      programmeDay: typeof page.programmeDay === "number" ? page.programmeDay : programmeDay(key),
      experimentPosition: page.experimentPosition == null ? null : String(page.experimentPosition),
      html,
      ...(object(page.labHandoff)
        ? { labHandoff: {
            startMarker: text(object(page.labHandoff)?.startMarker),
            endMarker: text(object(page.labHandoff)?.endMarker),
          } }
        : {}),
    };
  });

  const dayThree = compiledPages.find((page) => page.key === "Day 3");
  if (
    !dayThree?.labHandoff?.startMarker ||
    !dayThree.labHandoff.endMarker ||
    !dayThree.html.includes(dayThree.labHandoff.startMarker) ||
    !dayThree.html.includes(dayThree.labHandoff.endMarker)
  ) {
    throw new Error(`${edition}: Day 3 must include authored labHandoff startMarker and endMarker anchors inside the Day 3 content.`);
  }

  const fieldIds = compiledPages.flatMap((page) => [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]));
  if (new Set(fieldIds).size !== fieldIds.length) throw new Error(`${edition}: duplicate workbook field IDs were found.`);
  const editionNamespace = `${expectedCode}.WB.${edition.toUpperCase()}.`;
  if (fieldIds.some((id) => !id.startsWith(editionNamespace))) {
    throw new Error(`${edition}: workbook fields must stay inside the ${editionNamespace}* namespace.`);
  }

  const title = text(identity?.title) || text(source.title) || `${expectedCode} Learning Module`;
  const slug = text(identity?.slug) || text(source.slug) || slugify(title.replace(/lab/i, "")) || expectedCode.toLowerCase();
  const programme = {
    schemaVersion: "2.0",
    handbookId: text(identity?.handbookId) || text(source.handbookId) || `${slug}-lab-volume-1`,
    labCode: expectedCode,
    slug,
    title,
    subtitle: text(identity?.subtitle) || text(source.subtitle) || "Behaviour Intelligence learning module",
    contentVersion: expectedVersion,
    runtimeVersion: "programme-player-3",
    sourceTrace: {
      authority: text(source.sourceTrace?.authority) || "BIS Content Studio",
      prototype: text(source.sourceTrace?.prototype) || "Edition source package",
      rule: text(source.sourceTrace?.rule) || "Authored wording and page order preserved; learner responses remain private.",
    },
    edition,
    treatment: {
      label: text(treatment?.label) || edition,
      sourceId: text(treatment?.sourceId) || `${expectedCode}-${expectedVersion}-${edition}`,
      contentHash: await canonicalHash(compiledPages),
      privacySummary: text(treatment?.privacySummary) || "Private learning responses",
      pages: compiledPages,
    },
  };

  const content = JSON.stringify(programme);
  const encoded = new TextEncoder().encode(content);
  return {
    artifactKey: `learning:${edition}`,
    deliveryEdition: edition,
    content,
    hash: await sha256Hex(encoded),
    bytes: encoded.byteLength,
    mimeType: "application/json",
  };
}

function validatePrompt(prompt: unknown, code: string, investigation: number): UniversalLabPrompt {
  const value = object(prompt);
  if (!value) throw new Error(`Investigation ${investigation}: invalid prompt.`);
  const id = text(value.id);
  const label = text(value.label);
  const question = text(value.prompt);
  if (!id.startsWith(`${code}.`) || id.length < code.length + 4) {
    throw new Error(`Investigation ${investigation}: prompt IDs must use the ${code}.* namespace.`);
  }
  if (!label || !question) throw new Error(`Investigation ${investigation}: every prompt needs a label and question.`);
  const type = text(value.type) || "TEXT";
  if (!["TEXT","INTEGER","BOOLEAN","CATEGORICAL","MULTI_SELECT","DATE"].includes(type)) {
    throw new Error(`Investigation ${investigation}: unsupported prompt type ${type}.`);
  }
  const options = Array.isArray(value.options) ? value.options.map(String).map((item) => item.trim()).filter(Boolean) : undefined;
  if (["CATEGORICAL","MULTI_SELECT"].includes(type) && (!options || !options.length)) {
    throw new Error(`Investigation ${investigation}: ${type === "MULTI_SELECT" ? "multi-select" : "categorical"} prompts need options.`);
  }
  const min = typeof value.min === "number" && Number.isFinite(value.min) ? value.min : undefined;
  const max = typeof value.max === "number" && Number.isFinite(value.max) ? value.max : undefined;
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error(`Investigation ${investigation}: prompt ${id} has an invalid numeric range.`);
  }
  return {
    id,
    label,
    prompt: question,
    type: type as UniversalLabPrompt["type"],
    placeholder: text(value.placeholder) || undefined,
    sensitivity: (["P1","P2","P3"].includes(text(value.sensitivity)) ? text(value.sensitivity) : "P2") as UniversalLabPrompt["sensitivity"],
    required: value.required !== false,
    options,
    min,
    max,
    group: text(value.group) || undefined,
    readOnly: value.readOnly === true || undefined,
    scheduleDay: Number.isInteger(value.scheduleDay) ? Number(value.scheduleDay) : undefined,
    computed: object(value.computed) as UniversalComputedField | undefined,
    indicatorCode: text(value.indicatorCode) || undefined,
    indicatorLabel: text(value.indicatorLabel) || undefined,
  };
}

export async function compileUniversalLab(
  bytes: Uint8Array,
  expectedCode: string,
  expectedVersion: string,
): Promise<RuntimeArtifact> {
  let source = parseJson(bytes);
  if (!source) throw new Error("Lab source must be a BIS JSON package.");
  if (text(source.kind) !== "LAB") throw new Error('Lab package kind must be "LAB".');

  const factoryCapabilities = object(source.factoryCapabilities) as LabFactoryCapabilities | null;
  const authoredV2 = text(source.schemaVersion) === "universal-lab-v2" || text(source.runtimeProfile) === "UNIVERSAL_V2";
  if (factoryCapabilities?.requiresBehaviourRuntimeV2 && !authoredV2) {
    source = upgradeUniversalLabV2(source) as Record<string, unknown>;
  }

  const schemaVersion = text(source.schemaVersion);
  const runtimeProfile = text(source.runtimeProfile);
  const v2 = schemaVersion === "universal-lab-v2" && runtimeProfile === "UNIVERSAL_V2";
  const v1 = schemaVersion === "universal-lab-v1" && runtimeProfile === "UNIVERSAL_V1";
  if (!v1 && !v2) {
    const needs = factoryCapabilities?.requiresBehaviourRuntimeV2
      ? " This source needs the Universal V2 behaviour runtime."
      : "";
    throw new Error('Use a matching Universal Lab schema/runtime profile.' + needs);
  }

  const identity = object(source.identity);
  const code = text(identity?.code);
  const version = text(identity?.version);
  if (code !== expectedCode) throw new Error(`Lab package code ${code || "missing"} does not match ${expectedCode}.`);
  if (version !== expectedVersion) throw new Error(`Lab package version ${version || "missing"} does not match ${expectedVersion}.`);
  const title = text(identity?.title);
  const shortTitle = text(identity?.shortTitle) || title;
  const accent = text(identity?.accent) || "#2f8276";
  if (!title) throw new Error("Lab title is required.");

  const rawInvestigations = Array.isArray(source.investigations) ? source.investigations : [];
  if (rawInvestigations.length !== 9) throw new Error("Universal BIS Labs require exactly 9 investigations.");

  const seen = new Set<string>();
  const investigations = rawInvestigations.map((raw, index) => {
    const item = object(raw);
    if (!item || Number(item.number) !== index + 1) throw new Error(`Investigation ${index + 1} is out of sequence.`);
    const introHtml = sanitizeContentHtml(text(item.introHtml));
    if (introHtml && unsafeHtml.test(introHtml)) throw new Error(`Investigation ${index + 1}: executable HTML is not allowed.`);
    const prompts = (Array.isArray(item.prompts) ? item.prompts : []).map((prompt) => validatePrompt(prompt, expectedCode, index + 1));
    if (!prompts.length) throw new Error(`Investigation ${index + 1}: add at least one learner prompt.`);
    for (const prompt of prompts) {
      if (seen.has(prompt.id)) throw new Error(`Duplicate Lab prompt ID: ${prompt.id}.`);
      seen.add(prompt.id);
    }
    const promptIds = new Set(prompts.map((prompt) => prompt.id));
    const rawBlocks = Array.isArray(item.blocks) ? item.blocks : [];
    const blocks = rawBlocks.map((rawBlock, blockIndex) => {
      const block = object(rawBlock);
      if (!block) throw new Error(`Investigation ${index + 1}: content block ${blockIndex + 1} is invalid.`);
      const type = text(block.type);
      if (type === "HTML") {
        const html = sanitizeContentHtml(text(block.html));
        if (!html || unsafeHtml.test(html)) throw new Error(`Investigation ${index + 1}: unsafe or empty content block.`);
        return { type: "HTML" as const, html };
      }
      if (type === "PROMPT") {
        const promptId = text(block.promptId);
        if (!promptIds.has(promptId)) throw new Error(`Investigation ${index + 1}: content block points to an unknown prompt ${promptId || "missing"}.`);
        return { type: "PROMPT" as const, promptId };
      }
      throw new Error(`Investigation ${index + 1}: unsupported content block type ${type || "missing"}.`);
    });
    return {
      number: index + 1,
      title: text(item.title),
      mission: text(item.mission),
      phase: text(item.phase) || (index === 6 ? "Experiment" : index === 7 ? "Review" : index === 8 ? "Synthesis" : "Investigation"),
      time: text(item.time) || "10 minutes",
      difficulty: text(item.difficulty) || "Observe",
      produces: Array.isArray(item.produces) ? item.produces.map(String).map((value) => value.trim()).filter(Boolean) : [],
      introHtml: introHtml || undefined,
      blocks: blocks.length ? blocks : undefined,
      prompts,
    };
  });
  if (investigations.some((item) => !item.title || !item.mission)) throw new Error("Every investigation needs a title and mission.");

  const computedFields = Array.isArray(source.computedFields)
    ? source.computedFields as unknown as UniversalComputedField[]
    : [];
  const indicatorRegistry = Array.isArray(source.indicatorRegistry)
    ? source.indicatorRegistry as unknown as UniversalIndicatorBinding[]
    : [];
  const experiment = object(source.experiment) as unknown as UniversalExperimentContract | null;
  const profile = object(source.profile) as unknown as { investigation: number; entries: UniversalProfileEntry[] } | null;

  if (v2) {
    const promptIds = new Set(investigations.flatMap((item) => item.prompts.map((prompt) => prompt.id)));
    const requiredIndicatorCodes = new Set(factoryCapabilities?.indicatorCodes ?? []);
    const registeredIndicatorCodes = new Set(indicatorRegistry.map((indicator) => indicator.code));
    const missingIndicatorCodes = [...requiredIndicatorCodes].filter((code) => !registeredIndicatorCodes.has(code));
    const unboundIndicatorCodes = indicatorRegistry.filter((indicator) =>
      requiredIndicatorCodes.has(indicator.code) && (!indicator.promptIds.length || indicator.status !== "BOUND")
    ).map((indicator) => indicator.code);
    if (missingIndicatorCodes.length || unboundIndicatorCodes.length) {
      const codes = [...new Set([...missingIndicatorCodes, ...unboundIndicatorCodes])];
      throw new Error(`Universal V2 could not bind authored Behaviour Evidence Indicators to learner evidence fields: ${codes.join(", ")}.`);
    }
    for (const indicator of indicatorRegistry) {
      for (const promptId of indicator.promptIds) {
        if (!promptIds.has(promptId)) throw new Error(`${indicator.code}: indicator registry points to an unknown learner field ${promptId}.`);
      }
      if (indicator.primaryPromptId && !promptIds.has(indicator.primaryPromptId)) {
        throw new Error(`${indicator.code}: primary indicator field is not registered.`);
      }
    }
    if (factoryCapabilities?.derivedSignatures?.length && !computedFields.length) {
      throw new Error("Universal V2 requires declarative calculations for the derived measures in this Lab.");
    }
    for (const field of computedFields) {
      if (!field?.id || !promptIds.has(field.id)) throw new Error("A Universal V2 calculation points to an unknown output field.");
      if (!Array.isArray(field.inputs) || !field.inputs.length) throw new Error(`${field.id}: add at least one calculation input.`);
      for (const input of field.inputs) {
        if (!promptIds.has(input) && !computedFields.some((candidate) => candidate.id === input)) {
          throw new Error(`${field.id}: calculation input ${input} is not registered.`);
        }
      }
    }
    if (factoryCapabilities?.experiment?.detected) {
      if (!experiment || Number(experiment.days) < 1 || Number(experiment.investigation) !== 7) {
        throw new Error("Universal V2 requires a valid real-world experiment contract for this Lab.");
      }
      for (const scheduled of experiment.scheduledPromptIds ?? []) {
        if (!promptIds.has(scheduled.promptId) || scheduled.day < 1 || scheduled.day > experiment.days) {
          throw new Error("Universal V2 experiment scheduling contains an invalid field or day.");
        }
      }
    }
    if (factoryCapabilities?.profileSummary && (!profile || !Array.isArray(profile.entries) || !profile.entries.length)) {
      throw new Error("Universal V2 requires a Behaviour Profile projection contract for this Lab.");
    }
  }

  const runtimePackage: UniversalLabPackage = {
    kind: "LAB",
    schemaVersion: v2 ? "universal-lab-v2" : "universal-lab-v1",
    runtimeProfile: v2 ? "UNIVERSAL_V2" : "UNIVERSAL_V1",
    identity: {
      code: expectedCode,
      version: expectedVersion,
      title,
      shortTitle,
      accent,
      focus: text(identity?.focus) || undefined,
    },
    investigations,
    ...(v2 ? {
      factoryCapabilities: factoryCapabilities ?? undefined,
      computedFields,
      indicatorRegistry,
      experiment,
      profile,
    } : {}),
  };
  const content = JSON.stringify(runtimePackage);
  const encoded = new TextEncoder().encode(content);
  return {
    artifactKey: "lab:universal",
    deliveryEdition: null,
    content,
    hash: await sha256Hex(encoded),
    bytes: encoded.byteLength,
    mimeType: "application/json",
  };
}

export function compilerRequiresThreeEditions() {
  return [...LEARNING_EDITION_KEYS];
}
