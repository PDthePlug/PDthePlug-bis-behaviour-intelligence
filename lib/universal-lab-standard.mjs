export const HABIT_LAB_STANDARD_VERSION = "habit-lab-standard-1.0";

export const HABIT_LAB_STAGES = Object.freeze([
  { number: 1, key: "HOOK", label: "The Hook", role: "Encounter a situation before the principle is explained." },
  { number: 2, key: "PATTERN", label: "The Pattern", role: "Identify a repeated pattern and anchor it in evidence." },
  { number: 3, key: "REVELATION", label: "The Revelation", role: "Introduce the principle only after the learner has committed to an initial explanation." },
  { number: 4, key: "MAPPING", label: "The Mapping", role: "Map the learner's own behaviour, thinking, environment or evidence." },
  { number: 5, key: "EQUATION", label: "The Equation", role: "Turn the pattern into a testable working explanation with a falsification condition." },
  { number: 6, key: "CONTRACT", label: "The Contract", role: "Define the real-world test, minimum version, accountability, failure signal and restart response." },
  { number: 7, key: "EXPERIMENT", label: "The Experiment", role: "Collect real-world evidence over the authored experiment window." },
  { number: 8, key: "EVIDENCE_REVIEW", label: "The Evidence Review", role: "Compare prediction with reality, review contradictions and test transfer." },
  { number: 9, key: "PROFILE", label: "The Profile", role: "Synthesize evidence without turning it into a personality label." },
]);

const stageByNumber = new Map(HABIT_LAB_STAGES.map((stage) => [stage.number, stage]));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function promptText(prompt) {
  return [prompt?.id, prompt?.label, prompt?.prompt, prompt?.group]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizedPrompt(prompt) {
  return String(prompt?.prompt ?? prompt?.label ?? "")
    .toLowerCase()
    .replace(/\b(the|a|an|your|my|this|that|from|in|of|to|and|or)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPrompt(investigation, patterns) {
  return asArray(investigation?.prompts).some((prompt) => {
    const value = promptText(prompt);
    return patterns.some((pattern) => pattern.test(value));
  });
}

function uniquePromptId(investigation, requested) {
  const ids = new Set(asArray(investigation?.prompts).map((prompt) => prompt.id));
  if (!ids.has(requested)) return requested;
  let suffix = 2;
  while (ids.has(`${requested}.${suffix}`)) suffix += 1;
  return `${requested}.${suffix}`;
}

function addStandardPrompt(investigation, code, spec) {
  if (!investigation || hasPrompt(investigation, spec.detect)) return false;
  investigation.prompts = asArray(investigation.prompts);
  const id = uniquePromptId(investigation, `${code}.I${investigation.number}.${spec.key}`);
  investigation.prompts.push({
    id,
    label: spec.label,
    prompt: spec.prompt,
    type: spec.type ?? "TEXT",
    sensitivity: spec.sensitivity ?? "P2",
    required: spec.required !== false,
    ...(spec.min == null ? {} : { min: spec.min }),
    ...(spec.max == null ? {} : { max: spec.max }),
    ...(spec.placeholder ? { placeholder: spec.placeholder } : {}),
    group: spec.group ?? "BIS Laboratory Standard",
    origin: "BIS_STANDARD",
    standardPurpose: spec.key,
  });
  return true;
}

function mergeTransferSubstage(investigations) {
  const review = investigations.find((item) => Number(item.number) === 8);
  if (!review) return investigations;
  const transfer = investigations.filter((item) => {
    const number = Number(item.number);
    return number > 8 && number < 9 || /transfer\s*test/i.test(String(item.title ?? ""));
  });
  if (!transfer.length) return investigations;

  review.prompts = asArray(review.prompts);
  review.blocks = asArray(review.blocks);
  for (const stage of transfer) {
    review.prompts.push(...asArray(stage.prompts));
    review.blocks.push(...asArray(stage.blocks));
    if (stage.introHtml) {
      review.blocks.push({ type: "HTML", html: String(stage.introHtml) });
    }
  }
  return investigations.filter((item) => !transfer.includes(item));
}


function isRepeatableExperimentPrompt(prompt) {
  if (Number.isInteger(prompt?.scheduleDay)) return true;
  return /^day\s+\d+$/i.test(String(prompt?.group ?? "").trim());
}

function promptReferencedInTable(investigation, promptId) {
  return asArray(investigation?.blocks).some((block) =>
    block?.type === "TABLE"
    && asArray(block.rows).some((row) =>
      asArray(row).some((cell) =>
        (cell?.kind === "PROMPT" || cell?.kind === "CHOICE")
        && cell?.promptId === promptId,
      ),
    ),
  );
}

function removePromptBlocks(investigation, promptIds) {
  if (!promptIds.size || !Array.isArray(investigation?.blocks)) return;
  investigation.blocks = investigation.blocks.filter((block) =>
    block?.type !== "PROMPT" || !promptIds.has(block.promptId),
  );
}

function suppressCrossStageDuplicatePrompts(next) {
  const investigations = asArray(next.investigations)
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number));
  const seen = new Map();

  next.normalizationNotes = asArray(next.normalizationNotes);

  for (const investigation of investigations) {
    const retained = [];
    const removedIds = new Set();

    for (const prompt of asArray(investigation.prompts)) {
      if (isRepeatableExperimentPrompt(prompt) || prompt?.readOnly === true || prompt?.computed) {
        retained.push(prompt);
        continue;
      }

      const normalized = normalizedPrompt(prompt);
      if (prompt?.origin !== "BIS_STANDARD") {
        retained.push(prompt);
        if (normalized && !seen.has(normalized)) {
          seen.set(normalized, {
            promptId: prompt.id,
            investigation: Number(investigation.number),
          });
        }
        continue;
      }
      if (!normalized || normalized.length < 14) {
        retained.push(prompt);
        continue;
      }

      const prior = seen.get(normalized);
      if (
        !prior
        || Number(prior.investigation) === Number(investigation.number)
        || promptReferencedInTable(investigation, prompt.id)
      ) {
        retained.push(prompt);
        if (!prior) {
          seen.set(normalized, {
            promptId: prompt.id,
            investigation: Number(investigation.number),
          });
        }
        continue;
      }

      removedIds.add(prompt.id);
      next.normalizationNotes.push({
        code: "DUPLICATE_PROMPT_SUPPRESSED",
        sourceInvestigation: Number(investigation.number),
        sourcePromptId: prompt.id,
        retainedPromptId: prior.promptId,
        retainedInvestigation: prior.investigation,
        message: `A repeated learner question was removed from Investigation ${Number(investigation.number)} because the same evidence request already appears in Investigation ${prior.investigation}. The earlier source prompt remains authoritative.`,
      });
    }

    investigation.prompts = retained;
    removePromptBlocks(investigation, removedIds);
  }
}


function lowInformationPrompt(prompt) {
  const text = String(prompt?.prompt ?? "").trim();
  return (
    /^(?:what did you learn|reflect on what you learned)\b/i.test(text)
    || /^what evidence .* matters most\b/i.test(text)
    || /^right now i feel like someone who\b/i.test(text)
    || /^what surprised me most so far\b/i.test(text)
  );
}

function suppressLowInformationPrompts(next) {
  next.normalizationNotes = asArray(next.normalizationNotes);

  for (const investigation of asArray(next.investigations)) {
    const prompts = asArray(investigation.prompts);
    const substantive = prompts.filter((prompt) =>
      !lowInformationPrompt(prompt)
      && prompt?.readOnly !== true
      && !prompt?.computed,
    );
    if (!substantive.length) continue;

    const removedIds = new Set();
    const retained = [];
    for (const prompt of prompts) {
      const suppressible =
        prompt?.origin === "BIS_STANDARD"
        && !prompt?.indicatorCode
        && !isRepeatableExperimentPrompt(prompt)
        && prompt?.readOnly !== true
        && !prompt?.computed
        && !promptReferencedInTable(investigation, prompt.id)
        && lowInformationPrompt(prompt);

      if (!suppressible) {
        retained.push(prompt);
        continue;
      }

      removedIds.add(prompt.id);
      next.normalizationNotes.push({
        code: "LOW_INFORMATION_PROMPT_SUPPRESSED",
        sourceInvestigation: Number(investigation.number),
        sourcePromptId: prompt.id,
        message: `A broad reflection question was removed from Investigation ${Number(investigation.number)} because stronger, decision-useful evidence prompts are already present in the same stage. The source wording remains represented in the migration trace rather than being used as another learner task.`,
      });
    }

    investigation.prompts = retained;
    removePromptBlocks(investigation, removedIds);
  }
}

function ensureStagePrompts(next) {
  const code = String(next.identity?.code || "LAB").toUpperCase();
  const byNumber = new Map(asArray(next.investigations).map((item) => [Number(item.number), item]));

  addStandardPrompt(byNumber.get(1), code, {
    key: "PREDICTION",
    label: "Your prediction",
    prompt: "Before the principle is explained, what do you think is happening here, and what do you predict will happen next?",
    detect: [/prediction/, /what do you think.*happen/, /expect.*happen/],
    placeholder: "Commit to your current explanation before the reveal…",
  });


  const pattern = byNumber.get(2);
  const authoredPatternPrompts = asArray(pattern?.prompts).filter((prompt) =>
    prompt?.origin !== "BIS_STANDARD"
    && prompt?.readOnly !== true
    && !prompt?.computed
  );
  const sparsePatternStage = authoredPatternPrompts.length <= 1;
  if (sparsePatternStage) {
    addStandardPrompt(pattern, code, {
      key: "PATTERN_TARGET",
      label: "Pattern to investigate",
      prompt: "What repeated pattern related to this Lab do you want to investigate in your own life, work or decisions?",
      detect: [/repeated pattern/, /pattern.*investigat/, /keeps happening/, /keeps repeating/],
      placeholder: "Name one specific pattern that repeats often enough to examine…",
    });
    addStandardPrompt(pattern, code, {
      key: "PATTERN_EVIDENCE",
      label: "One recent example",
      prompt: "What is one recent, specific example that shows this pattern is real?",
      detect: [/recent.*example/, /specific.*example/, /piece of evidence/, /evidence.*pattern/, /last seven days/],
      placeholder: "Describe one recent moment, record or observation…",
    });
  }

  addStandardPrompt(byNumber.get(5), code, {
    key: "FALSIFICATION",
    label: "Falsification test",
    prompt: "What would you need to observe for this working explanation to be wrong or incomplete?",
    detect: [/falsif/, /if .*wrong/, /prove .*wrong/, /evidence .*wrong/, /disprov/, /make .*revise/, /wrong or incomplete/],
    placeholder: "Name evidence that would force you to revise the equation…",
  });

  const contract = byNumber.get(6);
  addStandardPrompt(contract, code, {
    key: "WITNESS",
    label: "Witness or accountability",
    prompt: "Who or what will help you verify that the test actually happened?",
    detect: [/witness/, /accountab/, /verify.*test/],
  });
  addStandardPrompt(contract, code, {
    key: "MINIMUM_VERSION",
    label: "Minimum version",
    prompt: "What is the smallest version of the action that still counts as completing the test?",
    detect: [/minimum version/, /smallest version/, /minimum action/],
  });
  addStandardPrompt(contract, code, {
    key: "FAILURE_SIGNAL",
    label: "Failure signal",
    prompt: "What observable signal will tell you that the test did not happen as designed?",
    detect: [/failure signal/, /signal.*did not/, /counts as failure/],
  });
  addStandardPrompt(contract, code, {
    key: "RESTART",
    label: "Restart response",
    prompt: "If the test breaks, what will you do at the next opportunity instead of abandoning it?",
    detect: [/restart/, /if .*breaks/, /next opportunity/],
  });
  addStandardPrompt(contract, code, {
    key: "PREDICTED_ADHERENCE",
    label: "Predicted adherence",
    prompt: "Before the experiment begins, what percentage of real opportunities do you predict you will follow through on?",
    type: "INTEGER",
    min: 0,
    max: 100,
    detect: [/predicted adherence/, /predict.*percentage/, /predict.*follow through/],
  });

  const review = byNumber.get(8);
  addStandardPrompt(review, code, {
    key: "SUPPORTING_EVIDENCE",
    label: "Evidence that supported the explanation",
    prompt: "Which observation most strongly supported your original working explanation?",
    detect: [/supporting evidence/, /evidence.*supported/, /supported.*explanation/],
  });
  addStandardPrompt(review, code, {
    key: "CHALLENGING_EVIDENCE",
    label: "Evidence that challenged the explanation",
    prompt: "Which observation most strongly challenged, contradicted or complicated your original explanation?",
    detect: [/challenging evidence/, /evidence.*challeng/, /contradict/, /complicated.*explanation/],
  });
  addStandardPrompt(review, code, {
    key: "ASSUMPTION_REVISED",
    label: "Assumption to revise",
    prompt: "Which assumption from the beginning of the Lab is now harder to defend, and why?",
    detect: [/assumption.*harder/, /assumption.*revis/, /harder to defend/],
  });
  addStandardPrompt(review, code, {
    key: "TRANSFER",
    label: "Transfer test",
    prompt: "Where else would this pattern or principle need to hold before you would trust it beyond this experiment?",
    detect: [/transfer test/, /where else/, /beyond this experiment/, /another context/],
  });

  const profile = byNumber.get(9);
  addStandardPrompt(profile, code, {
    key: "OBSERVED",
    label: "What I observed",
    prompt: "What can you now say you actually observed, rather than assumed?",
    detect: [/what i observed/, /actually observed/, /rather than assumed/],
  });
  addStandardPrompt(profile, code, {
    key: "CHANGED",
    label: "What changed",
    prompt: "What changed between your starting prediction and the evidence you collected?",
    detect: [/what changed/, /starting prediction.*evidence/, /prediction.*changed/],
  });
  addStandardPrompt(profile, code, {
    key: "UNCERTAIN",
    label: "What remains uncertain",
    prompt: "What remains uncertain or untested after this Lab?",
    detect: [/remains uncertain/, /still uncertain/, /untested/],
  });
  addStandardPrompt(profile, code, {
    key: "NEXT_TEST",
    label: "What I will test next",
    prompt: "What is the next pattern, context or assumption worth testing?",
    detect: [/test next/, /next pattern/, /next.*assumption/],
  });
}

export function auditUniversalLabEditorialQuality(definition) {
  const investigations = asArray(definition?.investigations);
  const issues = [];
  const seen = new Map();

  const legacyPrediction = investigations.find((item) =>
    Number(item.number) === 2 && /\bprediction\b/i.test(String(item.title ?? ""))
  );
  if (legacyPrediction) {
    issues.push({
      code: "LEGACY_PREDICTION_STAGE",
      severity: "REVIEW",
      investigation: 2,
      message: "Source Investigation 2 is authored as The Prediction. Current digital Habit Lab captures prediction inside The Hook and uses Investigation 2 to establish a repeated pattern with evidence. Strengthen this stage before approval.",
    });
  }

  if (investigations.length !== 9) {
    issues.push({
      code: "STAGE_COUNT",
      severity: "ERROR",
      message: `Habit Lab standard requires 9 investigations; found ${investigations.length}.`,
    });
  }

  for (const stage of HABIT_LAB_STAGES) {
    if (!investigations.some((item) => Number(item.number) === stage.number)) {
      issues.push({
        code: "MISSING_STAGE",
        severity: "ERROR",
        investigation: stage.number,
        message: `Investigation ${stage.number} (${stage.label}) is missing.`,
      });
    }
  }

  for (const investigation of investigations) {
    for (const prompt of asArray(investigation.prompts)) {
      const normalized = normalizedPrompt(prompt);
      if (!normalized || normalized.length < 14) continue;
      const prior = seen.get(normalized);
      if (prior) {
        issues.push({
          code: "REPEATED_QUESTION",
          severity: "REVIEW",
          investigation: Number(investigation.number),
          promptId: prompt.id,
          message: `Question substantially repeats ${prior}.`,
        });
      } else {
        seen.set(normalized, prompt.id);
      }
      if (/^(what did you learn|what evidence .* matters most|reflect on what you learned)/i.test(String(prompt.prompt ?? "").trim())) {
        issues.push({
          code: "LOW_INFORMATION_PROMPT",
          severity: "REVIEW",
          investigation: Number(investigation.number),
          promptId: prompt.id,
          message: "Question is broad and may not produce decision-useful behavioural evidence.",
        });
      }
    }
  }

  return {
    standardVersion: HABIT_LAB_STANDARD_VERSION,
    status: issues.some((issue) => issue.severity === "ERROR") ? "BLOCKED" : issues.length ? "REVIEW" : "PASS",
    issues,
  };
}

export function applyHabitLabStandard(source) {
  const next = structuredClone(source);
  const authoredInvestigations = asArray(next.investigations);
  const transferStages = authoredInvestigations.filter((item) => {
    const number = Number(item.number);
    return (number > 8 && number < 9) || /transfer\s*test/i.test(String(item.title ?? ""));
  });
  next.normalizationNotes = asArray(next.normalizationNotes);
  for (const transfer of transferStages) {
    next.normalizationNotes.push({
      code: "TRANSFER_SUBSTAGE_FOLDED",
      sourceInvestigation: Number(transfer.number),
      targetInvestigation: 8,
      message: `Source ${String(transfer.title ?? "transfer stage")} was folded into Investigation 8 so transfer evidence remains inside the canonical nine-stage laboratory.`,
    });
  }
  next.investigations = mergeTransferSubstage(authoredInvestigations);

  for (const investigation of next.investigations) {
    const stage = stageByNumber.get(Number(investigation.number));
    if (!stage) continue;
    investigation.standardStage = {
      number: stage.number,
      key: stage.key,
      label: stage.label,
      role: stage.role,
    };
  }

  ensureStagePrompts(next);
  suppressCrossStageDuplicatePrompts(next);
  suppressLowInformationPrompts(next);
  next.standardVersion = HABIT_LAB_STANDARD_VERSION;
  next.editorialAudit = auditUniversalLabEditorialQuality(next);
  return next;
}
