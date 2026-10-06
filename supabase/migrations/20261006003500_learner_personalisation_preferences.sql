-- BIS learner personalisation and context preferences
-- Adds non-sensitive presentation preferences to the learner profile.
-- Evidence, enrolments and authored responses remain versioned separately and are not rewritten.

alter table public.learners
  add column if not exists appearance_preference text not null default 'system',
  add column if not exists accent_preference text not null default 'bis',
  add column if not exists text_size_preference text not null default 'standard',
  add column if not exists reading_width_preference text not null default 'standard';

alter table public.learners
  drop constraint if exists learners_appearance_preference_check,
  add constraint learners_appearance_preference_check
    check (appearance_preference in ('system', 'light', 'warm', 'dark')),
  drop constraint if exists learners_accent_preference_check,
  add constraint learners_accent_preference_check
    check (accent_preference in ('bis', 'blue', 'amber', 'sage')),
  drop constraint if exists learners_text_size_preference_check,
  add constraint learners_text_size_preference_check
    check (text_size_preference in ('small', 'standard', 'large', 'extra_large')),
  drop constraint if exists learners_reading_width_preference_check,
  add constraint learners_reading_width_preference_check
    check (reading_width_preference in ('narrow', 'standard', 'wide'));

comment on column public.learners.appearance_preference is
  'Learner-selected BIS surface treatment. Presentation only; does not alter evidence or curriculum meaning.';
comment on column public.learners.accent_preference is
  'Learner-selected BIS accent token. Presentation only.';
comment on column public.learners.text_size_preference is
  'Learner-selected reading scale. Presentation only.';
comment on column public.learners.reading_width_preference is
  'Learner-selected workbook reading width. Presentation only.';
