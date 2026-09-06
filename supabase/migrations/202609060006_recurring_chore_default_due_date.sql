-- Repeating chores may omit dueAt. Give direct RPC clients the same deterministic
-- 18:00 UTC first occurrence that the local and hosted client services provide.
alter table public.chores drop constraint chores_schedule_valid;
alter table public.chores add constraint chores_schedule_valid check
  ((repeat_every is null and repeat_unit is null) or (repeat_every is not null and repeat_unit is not null));

create or replace function public.write_chore(p_household uuid, p_payload jsonb, p_id uuid default null, p_series uuid default null)
returns public.chores language plpgsql set search_path = public as $$
declare c public.chores; a uuid; due timestamptz; every_n integer; unit_name text;
begin
  due := nullif(p_payload->>'dueAt','')::timestamptz;
  every_n := (p_payload->>'repeatEvery')::integer;
  unit_name := p_payload->>'repeatUnit';
  if every_n is not null and due is null then
    due := (date_trunc('day', now() at time zone 'UTC') + interval '18 hours') at time zone 'UTC';
    if due <= now() then due := due + interval '1 day'; end if;
  end if;
  if nullif(trim(p_payload->>'title'),'') is null or length(trim(p_payload->>'title')) > 120 then raise exception 'Choose a chore name between 1 and 120 characters'; end if;
  if (p_payload->>'points')::integer is null or (p_payload->>'points')::integer not between 1 and 10 then raise exception 'Choose 1 to 10 effort points'; end if;
  if (every_n is null) <> (unit_name is null) or (every_n is not null and (every_n not between 1 and 365 or unit_name not in ('days','weeks','months'))) then raise exception 'Invalid repeat schedule'; end if;
  if jsonb_typeof(p_payload->'assigneeIds') is distinct from 'array' then raise exception 'Assignees must be an array'; end if;
  for a in select value::uuid from jsonb_array_elements_text(p_payload->'assigneeIds') loop
    if not exists(select 1 from public.members where id=a and household_id=p_household) then raise exception 'Assignee must belong to this household'; end if;
  end loop;
  if p_id is null then
    insert into public.chores(household_id,title,points,due_at,scheduled_at,recurrence,repeat_every,repeat_unit,due_interval_days,series_id)
    values(p_household,trim(p_payload->>'title'),(p_payload->>'points')::integer,due,due,'once',every_n,unit_name,(p_payload->>'dueInDays')::integer,p_series) returning * into c;
  else
    update public.chores set title=trim(p_payload->>'title'), points=(p_payload->>'points')::integer, due_at=due,
      repeat_every=every_n,repeat_unit=unit_name,due_interval_days=(p_payload->>'dueInDays')::integer,version=version+1,
      scheduled_at=case when p_payload->>'scope'='future' then due else scheduled_at end
    where id=p_id and household_id=p_household returning * into c;
    if not found then raise exception 'Chore not found'; end if;
    delete from public.chore_assignees where chore_id=p_id;
  end if;
  insert into public.chore_assignees select c.id,value::uuid from jsonb_array_elements_text(p_payload->'assigneeIds') on conflict do nothing;
  return c;
end;
$$;

create or replace function public.request_chore_change(p_household_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid; settings public.chore_board_settings; r public.chore_requests; c public.chores; needs_vote boolean; saved jsonb; due timestamptz; target_weekday integer;
begin
  perform 1 from public.households where id=p_household_id for update;
  select id into actor from public.members where household_id=p_household_id and user_id=auth.uid();
  if actor is null then raise exception 'Household membership required'; end if;
  if p_action is null or p_action not in ('create','edit','archive','trust') then raise exception 'Invalid action'; end if;
  insert into public.chore_board_settings(household_id) values(p_household_id) on conflict do nothing;
  select * into settings from public.chore_board_settings where household_id=p_household_id;
  r.household_id:=p_household_id; r.requested_by:=actor; r.action:=p_action; r.payload:=p_payload; r.id:=gen_random_uuid();
  select jsonb_object_agg(id,case when id=actor then 'approved' else 'pending' end) into r.approvals from public.members where household_id=p_household_id;
  if p_action='trust' then
    if p_payload->>'nextTrustLevel' is null or p_payload->>'nextTrustLevel' not in ('open','points-and-new','everything-except-date') then raise exception 'Invalid trust level'; end if;
    if exists(select 1 from public.chore_requests where household_id=p_household_id and action='trust') then raise exception 'A trust change is already pending'; end if;
    needs_vote := array_position(array['open','points-and-new','everything-except-date'],p_payload->>'nextTrustLevel') < array_position(array['open','points-and-new','everything-except-date'],settings.trust_level);
  else
    if p_action <> 'create' then
      r.chore_id:=(p_payload->>'choreId')::uuid;
      select * into c from public.chores where id=r.chore_id and household_id=p_household_id;
      if not found or c.archived_at is not null then raise exception 'Chore not found'; end if;
      if (p_payload->>'expectedVersion')::integer is distinct from c.version then raise exception 'This chore changed. Refresh before editing'; end if;
      if p_payload->>'scope' is null or p_payload->>'scope' not in ('occurrence','future') then raise exception 'Choose an occurrence scope'; end if;
      if exists(select 1 from public.chore_requests where chore_id=c.id) then raise exception 'A change for this chore is already pending'; end if;
      if exists(select 1 from public.completions where chore_id=c.id) then raise exception 'Completed chores keep their history'; end if;
      if p_action='edit' and p_payload->>'scope'='occurrence' and ((p_payload->>'repeatEvery')::integer is distinct from c.repeat_every or p_payload->>'repeatUnit' is distinct from c.repeat_unit) then raise exception 'Choose This and future to change the repeat schedule'; end if;
    end if;
    if p_action <> 'archive' then
      due := nullif(p_payload->>'dueAt','')::timestamptz;
      if due is null and (p_payload->>'repeatEvery') is not null then
        due := (date_trunc('day', now() at time zone 'UTC') + interval '18 hours') at time zone 'UTC';
        target_weekday := case lower(trim(p_payload->>'recurrence'))
          when 'every sunday' then 0 when 'every monday' then 1 when 'every tuesday' then 2
          when 'every wednesday' then 3 when 'every thursday' then 4 when 'every friday' then 5
          when 'every saturday' then 6 else null end;
        if target_weekday is not null then
          due := due + (((target_weekday - extract(dow from due)::integer + 7) % 7) * interval '1 day');
          if due <= now() then due := due + interval '7 days'; end if;
        elsif due <= now() then
          due := due + interval '1 day';
        end if;
        p_payload := p_payload || jsonb_build_object('dueAt',to_char(due at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
        r.payload := p_payload;
      end if;
      if due::date < (now() at time zone 'UTC')::date and (p_action='create' or due::date is distinct from c.due_at::date) then raise exception 'Choose today or a future due date'; end if;
      if nullif(trim(p_payload->>'title'),'') is null or length(trim(p_payload->>'title'))>120 or (p_payload->>'points')::integer is null or (p_payload->>'points')::integer not between 1 and 10 then raise exception 'Invalid chore name or effort points'; end if;
      if jsonb_typeof(p_payload->'assigneeIds') is distinct from 'array' then raise exception 'Assignees must be an array'; end if;
      if exists(select 1 from jsonb_array_elements_text(p_payload->'assigneeIds') a where not exists(select 1 from public.members m where m.id=a.value::uuid and m.household_id=p_household_id)) then raise exception 'Assignee must belong to this household'; end if;
      if ((p_payload->>'repeatEvery') is null) <> ((p_payload->>'repeatUnit') is null) or ((p_payload->>'repeatEvery') is not null and ((p_payload->>'repeatEvery')::integer not between 1 and 365 or p_payload->>'repeatUnit' not in ('days','weeks','months'))) then raise exception 'Invalid repeat schedule'; end if;
    else
      r.payload := public.chore_json(c) || p_payload;
    end if;
    select item into saved from jsonb_array_elements(settings.starters) item where lower(item->>'title')=lower(p_payload->>'starterTitle') limit 1;
    needs_vote := case settings.trust_level when 'open' then false when 'points-and-new' then case when p_action='create' then saved is null or lower(saved->>'title') is distinct from lower(p_payload->>'title') or saved->>'points' is distinct from p_payload->>'points' when p_action='edit' then c.points is distinct from (p_payload->>'points')::integer else false end else case when p_action='create' then saved is null or lower(saved->>'title') is distinct from lower(p_payload->>'title') or saved->>'points' is distinct from p_payload->>'points' or saved->>'repeatEvery' is distinct from p_payload->>'repeatEvery' or saved->>'repeatUnit' is distinct from p_payload->>'repeatUnit' or saved->>'dueInDays' is distinct from p_payload->>'dueInDays' or not ((saved->'assigneeIds') @> (p_payload->'assigneeIds') and (p_payload->'assigneeIds') @> (saved->'assigneeIds')) else true end end;
  end if;
  if needs_vote and exists(select 1 from public.members where household_id=p_household_id and id<>actor) then
    insert into public.chore_requests(id,household_id,requested_by,action,chore_id,payload,approvals) values(r.id,r.household_id,r.requested_by,r.action,r.chore_id,r.payload,r.approvals);
    return jsonb_build_object('status','pending','pending',r.payload || jsonb_build_object('id',r.id,'householdId',r.household_id,'requestedById',actor,'approvals',r.approvals,'action',r.action));
  end if;
  return jsonb_build_object('status','created','chore',public.apply_chore_request(r));
end;
$$;
