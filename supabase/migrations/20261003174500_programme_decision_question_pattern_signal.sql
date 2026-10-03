-- Programme decisions — structured question-pattern signal
-- Keeps the organisation decision register aligned with the governed Question Intelligence UI.

alter table public.programme_decisions
  drop constraint if exists programme_decisions_source_signal_check;

alter table public.programme_decisions
  add constraint programme_decisions_source_signal_check
  check (source_signal in (
    'PROGRAMME_TRANSITION',
    'SUPPORT_RESPONSE',
    'ADAPTATION',
    'EVIDENCE_STRENGTH',
    'LEARNING_JOURNEY',
    'DELIVERY_CONDITION',
    'QUESTION_PATTERN',
    'OTHER'
  ));
