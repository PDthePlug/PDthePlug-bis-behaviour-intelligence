-- BIS reporting demonstration cohort
-- 20 synthetic participants; no auth accounts and no real participant data.
-- Idempotent: all rows use DEMO-prefixed stable IDs.

do $$
declare
  v_owner_id text;
  v_cohort_id constant text := 'BIS-DEMO-HAB-20';
  v_release_id constant text := 'HAB:workplace:1.4:cd25fa48';
  i integer;
  d integer;
  v_user_id text;
  v_email text;
  v_experiment_id text;
  v_step integer;
  v_opp integer;
  v_score integer;
  v_value text;
  v_pre numeric;
  v_post numeric;
begin
  select user_id into v_owner_id
  from public.learners
  where lower(email)='pdmpofu@gmail.com'
  limit 1;

  if v_owner_id is null then
    raise exception 'BIS demo seed requires the existing administrator learner identity.';
  end if;

  insert into public.pilot_cohorts (
    id,name,lab_code,lab_version,facilitator_email,status,starts_on,ends_on,created_by
  ) values (
    v_cohort_id,
    'BIS Demonstration — 20-person Habit Lab',
    'HAB','4.5.2','pdmpofu@gmail.com','ACTIVE','2026-09-07','2026-09-18',v_owner_id
  )
  on conflict (id) do update set
    name=excluded.name,
    lab_code=excluded.lab_code,
    lab_version=excluded.lab_version,
    facilitator_email=excluded.facilitator_email,
    status='ACTIVE',
    starts_on=excluded.starts_on,
    ends_on=excluded.ends_on,
    updated_at=now();

  for i in 1..20 loop
    v_user_id := 'DEMO-HAB-' || lpad(i::text,2,'0');
    v_email := 'demo.habit.' || lpad(i::text,2,'0') || '@bis.invalid';
    v_step := case
      when i <= 4 then 9
      when i <= 8 then 8
      when i <= 12 then 7
      when i <= 18 then 6
      when i = 19 then 5
      else 3
    end;

    insert into public.learners (
      user_id,email,display_name,age_band,mode,language,timezone,status,
      delivery_edition,delivery_context
    ) values (
      v_user_id,v_email,'Demo Participant ' || lpad(i::text,2,'0'),
      '18-25','FACILITATED','en','Africa/Johannesburg','ACTIVE',
      'workplace','workplace_programme'
    )
    on conflict (user_id) do update set
      email=excluded.email,
      display_name=excluded.display_name,
      mode='FACILITATED',
      status='ACTIVE',
      delivery_edition='workplace',
      delivery_context='workplace_programme',
      updated_at=now();

    insert into public.cohort_members (
      id,cohort_id,learner_user_id,learner_email,status,added_by,joined_at
    ) values (
      'DEMO-MEMBER-' || lpad(i::text,2,'0'),
      v_cohort_id,v_user_id,v_email,'ACTIVE',v_owner_id,'2026-09-07 08:00:00+02'
    )
    on conflict (cohort_id,learner_user_id) do update set
      learner_email=excluded.learner_email,
      status='ACTIVE',
      added_by=v_owner_id,
      joined_at=excluded.joined_at,
      removed_at=null;

    insert into public.lab_enrollments (
      id,user_id,lab_code,lab_version,status,current_investigation,
      started_at,phase_a_completed_at,experiment_started_at,completed_at,updated_at,content_release_id
    ) values (
      'DEMO-ENROL-' || lpad(i::text,2,'0'),
      v_user_id,'HAB','4.5.2',
      case when i <= 4 then 'COMPLETED' else 'IN_PROGRESS' end,
      v_step,
      '2026-09-07 08:30:00+02',
      case when v_step >= 6 then '2026-09-09 12:00:00+02'::timestamptz else null end,
      case when i <= 16 then '2026-09-10 09:00:00+02'::timestamptz else null end,
      case when i <= 4 then '2026-09-17 15:00:00+02'::timestamptz else null end,
      ('2026-09-' || lpad(least(17,7+v_step)::text,2,'0') || ' 15:00:00+02')::timestamptz,
      v_release_id
    )
    on conflict (user_id,lab_code,lab_version) do update set
      status=excluded.status,
      current_investigation=excluded.current_investigation,
      phase_a_completed_at=excluded.phase_a_completed_at,
      experiment_started_at=excluded.experiment_started_at,
      completed_at=excluded.completed_at,
      updated_at=excluded.updated_at,
      content_release_id=excluded.content_release_id;

    -- Programme progress: deliberately uneven Day 1-10 reach.
    insert into public.handbook_progress (
      id,user_id,lab_code,delivery_edition,content_release_id,semantic_step_id,status,
      sync_state,first_seen_at,last_seen_at,completed_at,updated_at
    ) values (
      'DEMO-HP-WELCOME-' || lpad(i::text,2,'0'),
      v_user_id,'HAB','workplace',v_release_id,'HAB.PROGRAMME.WELCOME','COMPLETED',
      'SYNCED','2026-09-07 08:00:00+02','2026-09-07 08:20:00+02','2026-09-07 08:20:00+02','2026-09-07 08:20:00+02'
    )
    on conflict (user_id,content_release_id,semantic_step_id) do update set
      status='COMPLETED',sync_state='SYNCED',last_seen_at=excluded.last_seen_at,
      completed_at=excluded.completed_at,updated_at=excluded.updated_at;

    for d in 1..10 loop
      if i <= (case d
        when 1 then 20 when 2 then 20 when 3 then 18 when 4 then 16 when 5 then 15
        when 6 then 14 when 7 then 12 when 8 then 10 when 9 then 8 else 6 end)
      then
        insert into public.handbook_progress (
          id,user_id,lab_code,delivery_edition,content_release_id,semantic_step_id,status,
          sync_state,first_seen_at,last_seen_at,completed_at,updated_at
        ) values (
          'DEMO-HP-D' || d::text || '-' || lpad(i::text,2,'0'),
          v_user_id,'HAB','workplace',v_release_id,'HAB.PROGRAMME.DAY' || d::text,
          case when i <= greatest(1,(case d
            when 1 then 20 when 2 then 19 when 3 then 17 when 4 then 15 when 5 then 14
            when 6 then 13 when 7 then 11 when 8 then 9 when 9 then 7 else 5 end)) then 'COMPLETED' else 'STARTED' end,
          'SYNCED',
          ('2026-09-' || lpad(least(17,6+d)::text,2,'0') || ' 09:00:00+02')::timestamptz,
          ('2026-09-' || lpad(least(17,6+d)::text,2,'0') || ' 15:00:00+02')::timestamptz,
          case when i <= (case d
            when 1 then 20 when 2 then 19 when 3 then 17 when 4 then 15 when 5 then 14
            when 6 then 13 when 7 then 11 when 8 then 9 when 9 then 7 else 5 end)
            then ('2026-09-' || lpad(least(17,6+d)::text,2,'0') || ' 15:00:00+02')::timestamptz
            else null end,
          ('2026-09-' || lpad(least(17,6+d)::text,2,'0') || ' 15:00:00+02')::timestamptz
        )
        on conflict (user_id,content_release_id,semantic_step_id) do update set
          status=excluded.status,sync_state='SYNCED',last_seen_at=excluded.last_seen_at,
          completed_at=excluded.completed_at,updated_at=excluded.updated_at;
      end if;
    end loop;

    -- Structured baseline themes; values are fixed response options, never free text.
    for d in 1..10 loop
      v_score := case d
        when 1 then case when i<=6 then 4 when i<=14 then 3 when i<=18 then 2 else 1 end -- procrastination
        when 2 then case when i<=5 then 4 when i<=13 then 3 else 2 end -- phone
        when 3 then case when i<=2 then 4 when i<=8 then 3 when i<=15 then 2 else 1 end -- late sleep
        when 4 then case when i<=4 then 4 when i<=12 then 3 when i<=18 then 2 else 1 end -- commitments
        when 5 then case when i<=2 then 4 when i<=5 then 3 when i<=13 then 2 else 1 end -- impulse
        when 6 then case when i<=3 then 4 when i<=9 then 3 when i<=16 then 2 else 1 end -- stress
        when 7 then case when i<=2 then 4 when i<=6 then 3 when i<=15 then 2 else 1 end -- give up
        when 8 then case when i<=3 then 4 when i<=10 then 3 when i<=17 then 2 else 1 end -- unfinished
        when 9 then case when i<=2 then 4 when i<=7 then 3 when i<=16 then 2 else 1 end -- self care
        else case when i<=1 then 4 when i<=4 then 3 when i<=12 then 2 else 1 end -- eating
      end;
      v_value := case v_score when 4 then 'Always' when 3 then 'Often' when 2 then 'Sometimes' when 1 then 'Rarely' else 'Never' end;

      insert into public.responses (
        id,user_id,prompt_id,semantic_field_id,lab_version,value,response_status,language,
        occurred_at,lab_code,content_release_id,delivery_edition,prompt_version,privacy_class,provenance
      ) values (
        'DEMO-BASE-' || d::text || '-' || lpad(i::text,2,'0'),
        v_user_id,'DEMO.BASELINE.' || d::text,
        case d
          when 1 then 'HAB.BASELINE.PROCRASTINATION'
          when 2 then 'HAB.BASELINE.PHONE_CHECKING'
          when 3 then 'HAB.BASELINE.LATE_SLEEP'
          when 4 then 'HAB.BASELINE.MISSED_COMMITMENTS'
          when 5 then 'HAB.BASELINE.IMPULSE_BUYING'
          when 6 then 'HAB.BASELINE.STRESS_REACTION'
          when 7 then 'HAB.BASELINE.GIVE_UP'
          when 8 then 'HAB.BASELINE.UNFINISHED_PROJECTS'
          when 9 then 'HAB.BASELINE.SKIP_SELF_CARE'
          else 'HAB.BASELINE.EATING_NOT_HUNGRY'
        end,
        '4.5.2',v_value,'ANSWERED','en','2026-09-07 10:00:00+02',
        'HAB',v_release_id,'workplace','1','P2','SR'
      )
      on conflict (id) do update set value=excluded.value,recorded_at=now();
    end loop;

    -- Paired structured measures for group-level pre/post reporting.
    if i <= 16 then
      v_pre := 2 + (i % 3);
      v_post := least(5,v_pre + case when i % 4 = 0 then 0 else 1 end);
      insert into public.responses (id,user_id,prompt_id,semantic_field_id,lab_version,value,response_status,language,occurred_at,lab_code,content_release_id,delivery_edition,prompt_version,privacy_class,provenance)
      values
        ('DEMO-CTRL-PRE-'||lpad(i::text,2,'0'),v_user_id,'DEMO.CONTROL.PRE','HAB.CONTROL.PRE','4.5.2',v_pre::text,'ANSWERED','en','2026-09-07 11:00:00+02','HAB',v_release_id,'workplace','1','P2','SR'),
        ('DEMO-CTRL-POST-'||lpad(i::text,2,'0'),v_user_id,'DEMO.CONTROL.POST','HAB.CONTROL.POST','4.5.2',v_post::text,'ANSWERED','en','2026-09-17 11:00:00+02','HAB',v_release_id,'workplace','1','P2','SR')
      on conflict (id) do update set value=excluded.value,recorded_at=now();

      v_pre := 4 + (i % 3);
      v_post := least(10,v_pre + case when i % 5 = 0 then 1 else 2 end);
      insert into public.responses (id,user_id,prompt_id,semantic_field_id,lab_version,value,response_status,language,occurred_at,lab_code,content_release_id,delivery_edition,prompt_version,privacy_class,provenance)
      values
        ('DEMO-CONF-PRE-'||lpad(i::text,2,'0'),v_user_id,'DEMO.CONFIDENCE.PRE','HAB.EQUATION.CONFIDENCE_PRE','4.5.2',v_pre::text,'ANSWERED','en','2026-09-08 11:00:00+02','HAB',v_release_id,'workplace','1','P2','SR'),
        ('DEMO-CONF-POST-'||lpad(i::text,2,'0'),v_user_id,'DEMO.CONFIDENCE.POST','HAB.EQUATION.CONFIDENCE_POST','4.5.2',v_post::text,'ANSWERED','en','2026-09-17 11:30:00+02','HAB',v_release_id,'workplace','1','P2','SR')
      on conflict (id) do update set value=excluded.value,recorded_at=now();
    end if;

    -- Sixteen participants enter the real-world experiment.
    if i <= 16 then
      v_experiment_id := 'DEMO-HAB-EXP-' || lpad(i::text,2,'0');
      v_opp := case
        when i <= 10 then 4
        when i <= 12 then 3
        when i <= 14 then 2
        when i = 15 then 1
        else 0
      end;

      insert into public.experiments (
        id,user_id,lab_version,status,target_pattern,target_condition,alternative_behaviour,
        expected_reward,witness,restart_plan,minimum_version,failure_signal,impact_domains,
        predicted_value,prediction_unit,start_date,planned_end_date,actual_end_date,
        minimum_evidence_threshold,parameter_version,lab_code,content_release_id,
        delivery_edition,experiment_protocol,protocol_version
      ) values (
        v_experiment_id,v_user_id,'4.5.2',
        case when i<=4 then 'COMPLETED' else 'ACTIVE' end,
        'Synthetic demo pattern '||i::text,
        'Synthetic demo condition',
        'Synthetic alternative response',
        'Synthetic expected reward',
        null,'Restart at next eligible opportunity','Minimum version: one deliberate alternative',
        'No eligible situation recorded for three days',
        case
          when i<=6 then '["Work","Mental wellbeing"]'
          when i<=10 then '["School","Work"]'
          when i<=13 then '["Money","Work"]'
          else '["Relationships","Mental wellbeing"]'
        end,
        55 + (i % 5) * 8,
        'PERCENT','2026-09-10','2026-09-16',
        case when i<=4 then '2026-09-16'::date else null end,
        3,1,'HAB',v_release_id,'workplace','HABIT_REPLACEMENT','1'
      )
      on conflict (id) do update set
        status=excluded.status,impact_domains=excluded.impact_domains,predicted_value=excluded.predicted_value,
        updated_at=now();

      for d in 1..5 loop
        insert into public.experiment_events (
          id,experiment_id,user_id,day_number,occurred_at,eligible_opportunity,
          target_condition_occurred,alternative_used,notes,source
        ) values (
          'DEMO-EVENT-' || lpad(i::text,2,'0') || '-' || d::text,
          v_experiment_id,v_user_id,d,
          ('2026-09-' || lpad((9+d)::text,2,'0') || ' 17:00:00+02')::timestamptz,
          d <= v_opp,
          d <= v_opp,
          case
            when d > v_opp then null
            when i in (1,2,3,4,5,6,7,11,12,13) then case when d=1 then false else true end
            when i in (8,9,14) then true
            when i=10 then case when d=1 then true else false end
            else false
          end,
          null,'LEARNER'
        )
        on conflict (experiment_id,day_number) do update set
          eligible_opportunity=excluded.eligible_opportunity,
          target_condition_occurred=excluded.target_condition_occurred,
          alternative_used=excluded.alternative_used,
          notes=null,
          recorded_at=now();
      end loop;

      -- Calculated outcomes used by the sponsor report.
      insert into public.measurement_values (
        id,user_id,experiment_id,code,value,status,evidence_strength,formula_version
      )
      select
        'DEMO-MV06-' || lpad(i::text,2,'0'),
        v_user_id,v_experiment_id,'HAB.BEI06',
        case when v_opp=0 then null else round(
          100.0 * count(*) filter (where eligible_opportunity and alternative_used=true)
          / nullif(count(*) filter (where eligible_opportunity),0),1
        )::text end,
        case when v_opp=0 then 'N_A' else 'VALUE' end,
        case when v_opp>=3 then 'SUFFICIENT' when v_opp>0 then 'LIMITED' else 'NONE' end,
        '1.0'
      from public.experiment_events
      where experiment_id=v_experiment_id
      on conflict (user_id,experiment_id,code) do update set
        value=excluded.value,status=excluded.status,evidence_strength=excluded.evidence_strength,calculated_at=now();

      insert into public.measurement_values (
        id,user_id,experiment_id,code,value,status,evidence_strength,formula_version
      )
      select
        'DEMO-MV03-' || lpad(i::text,2,'0'),
        v_user_id,v_experiment_id,'HAB.BEI03',
        case when actual_rate is null then null else greatest(0,100-abs((55 + (i % 5) * 8)-actual_rate))::text end,
        case when actual_rate is null then 'N_A' else 'VALUE' end,
        case when v_opp>=3 then 'SUFFICIENT' when v_opp>0 then 'LIMITED' else 'NONE' end,
        '1.0'
      from (
        select case when v_opp=0 then null else round(
          100.0 * count(*) filter (where eligible_opportunity and alternative_used=true)
          / nullif(count(*) filter (where eligible_opportunity),0),1
        ) end as actual_rate
        from public.experiment_events
        where experiment_id=v_experiment_id
      ) a
      on conflict (user_id,experiment_id,code) do update set
        value=excluded.value,status=excluded.status,evidence_strength=excluded.evidence_strength,calculated_at=now();
    end if;
  end loop;

  -- Learner-initiated support requests: aggregate existence only appears in organisation reporting.
  foreach i in array array[2,5,9,13,17] loop
    v_user_id := 'DEMO-HAB-' || lpad(i::text,2,'0');
    v_email := 'demo.habit.' || lpad(i::text,2,'0') || '@bis.invalid';
    insert into public.safeguarding_cases (
      id,learner_user_id,learner_email,cohort_id,source_type,category,summary,status,severity,
      opened_by,opened_by_email,opened_at
    ) values (
      'DEMO-HELP-'||lpad(i::text,2,'0'),v_user_id,v_email,v_cohort_id,
      'LEARNER_REQUEST','PROGRAMME_SUPPORT',
      'Synthetic demonstration support request.','OPEN','UNASSESSED',
      v_user_id,v_email,'2026-09-12 12:00:00+02'
    )
    on conflict (id) do update set status='OPEN',severity='UNASSESSED',summary=excluded.summary;
  end loop;

  -- Facilitator-side notes and two explicit referrals to exercise the support workspace.
  foreach i in array array[3,7,11,15] loop
    v_user_id := 'DEMO-HAB-' || lpad(i::text,2,'0');
    insert into public.facilitator_notes (
      id,cohort_id,learner_user_id,author_id,author_email,category,content,visibility,created_at
    ) values (
      'DEMO-NOTE-'||lpad(i::text,2,'0'),v_cohort_id,v_user_id,v_owner_id,'pdmpofu@gmail.com',
      case when i in (3,11) then 'EXPERIMENT_SUPPORT' else 'CHECK_IN' end,
      case when i in (3,11) then 'Synthetic demo note: clarified the minimum experiment and agreed the next check-in.'
           else 'Synthetic demo note: brief programme check-in completed; next action confirmed.' end,
      'FACILITATOR_TEAM','2026-09-13 14:00:00+02'
    )
    on conflict (id) do update set content=excluded.content,created_at=excluded.created_at;
  end loop;

  foreach i in array array[6,18] loop
    v_user_id := 'DEMO-HAB-' || lpad(i::text,2,'0');
    v_email := 'demo.habit.' || lpad(i::text,2,'0') || '@bis.invalid';
    insert into public.safeguarding_cases (
      id,learner_user_id,learner_email,cohort_id,source_type,category,summary,status,severity,
      opened_by,opened_by_email,opened_at
    ) values (
      'DEMO-REF-'||lpad(i::text,2,'0'),v_user_id,v_email,v_cohort_id,
      'FACILITATOR_REFERRAL','WELLBEING_CONCERN',
      'Synthetic demonstration referral for facilitator workflow testing.','OPEN','UNASSESSED',
      v_owner_id,'pdmpofu@gmail.com','2026-09-14 10:00:00+02'
    )
    on conflict (id) do update set status='OPEN',severity='UNASSESSED',summary=excluded.summary;
  end loop;
end
$$;
