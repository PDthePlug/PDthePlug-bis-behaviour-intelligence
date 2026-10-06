import { learnerHeadingText } from "./learner-heading-presentation.mjs";

// Describes the published calculation contract. It never evaluates or changes
// evidence, and uses this edition's presented prompt names rather than IDs.
export function learnerCalculationContexts(definition) {
  const prompts = new Map([
    ...(definition?.presentationBaseline?.items ?? []),
    ...(definition?.presentationBaseline?.metric ? [definition.presentationBaseline.metric] : []),
    ...(definition?.investigations ?? []).flatMap(stage => stage.prompts ?? []),
  ].map(prompt => [prompt.id, prompt]));
  const label = prompt => {
    const readable = value => learnerHeadingText(value).replace(/\b(?:BEI|TEI)-\d{2}(?:-(?:pre|post))?\s*:?\s*/gi, "").trim();
    return readable(prompt?.label) || readable(prompt?.indicatorLabel) || readable(prompt?.prompt) || "An earlier recorded answer";
  };
  return (definition?.computedFields ?? []).flatMap(field => {
    const sources = field.inputs.map(id => ({ id, label: label(prompts.get(id)) }));
    const names = sources.map(source => source.label);
    let calculation;
    let meaning;
    if (field.operation === "DIFFERENCE") {
      calculation = `${names[0]} minus ${names[1]}.`;
      const inputs = field.inputs.map(id => prompts.get(id));
      const rating = inputs.every(prompt => prompt?.controlRole === "RATING" && Number.isFinite(prompt.min) && Number.isFinite(prompt.max));
      const sameScale = rating && inputs.every(prompt => prompt.min === inputs[0].min && prompt.max === inputs[0].max);
      meaning = sameScale
        ? `The difference is in points on the original ${inputs[0].min}–${inputs[0].max} rating scale. A positive value means the first rating is higher; zero means the ratings are equal; a negative value means it is lower. These are your own ratings, not an assessment of skill or proof of programme effect.`
        : "A positive value means the first recorded number is higher; zero means they are equal; a negative value means it is lower. Use the original questions and their scales to interpret the difference. It does not establish the cause of a change.";
    } else if (field.operation === "PRODUCT") {
      calculation = `${names.join(" multiplied by ")}.`;
      meaning = "Read this value within the original task and input scales. It is a calculation from your answers, not an independently assessed ability.";
    } else if (field.operation === "COUNT_PRESENT") {
      calculation = "Counts how many of the listed answers have a recorded value.";
      meaning = "This is a response count, not a success rate. An available answer counts even when it records no action or no opportunity. Missing answers remain missing.";
    } else if (field.operation === "COUNT_TRUE") {
      calculation = "Counts affirmative answers among the listed responses.";
      meaning = "This is a count of recorded affirmative answers. No opportunity, a passed question and missing evidence do not count as affirmative answers. The count alone does not show whether every response is recorded.";
    } else if (field.operation === "MAX") {
      calculation = "Uses the highest available number among the listed answers.";
      meaning = "Missing inputs are excluded. This is the highest recorded value on the original scales, not an overall performance score.";
    } else if (field.operation === "COPY") {
      calculation = `Repeats your recorded answer to “${names[0]}”.`;
      meaning = "This keeps an earlier answer available for review. It adds no new observation or assessment.";
    } else if (field.operation === "PAIR") {
      calculation = `Shows “${names[0]}” followed by “${names[1]}”.`;
      meaning = "Compare the two original answers on their own scales. A missing answer stays unavailable; the comparison does not explain the cause of a difference.";
    } else if (field.operation === "COLLECTION") {
      calculation = "Brings the listed recorded answers together in their original order.";
      meaning = "This is a collection of answers, not a combined score. Missing items remain missing; an earlier retained collection can supply the result where the published calculation allows it.";
    } else return [];
    return [{ id: field.id, label: label(prompts.get(field.id) ?? field), calculation, meaning, sources }];
  });
}
