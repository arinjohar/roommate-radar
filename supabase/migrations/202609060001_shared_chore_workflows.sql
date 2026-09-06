-- Shared chore workflows. All writes use authenticated RPCs; archived rows retain history.
alter table public.chores alter column due_at drop not null;
alter table public.chores add column archived_at timestamptz;
alter table public.chores add column version integer not null default 1;
alter table public.chores add column occurrence_order bigint generated always as identity;
alter table public.chores add column repeat_every integer check (repeat_every between 1 and 365);
alter table public.chores add column repeat_unit text check (repeat_unit in ('days','weeks','months'));
alter table public.chores add column due_interval_days integer;
alter table public.chores add column series_id uuid;
alter table public.chores add column scheduled_at timestamptz;
update public.chores set scheduled_at=due_at;
update public.chores set repeat_every = case recurrence when 'biweekly' then 2 when 'once' then null else 1 end,
  repeat_unit = case recurrence when 'daily' then 'days' when 'monthly' then 'months' when 'once' then null else 'weeks' end;
alter table public.chores add constraint chores_schedule_valid check
  ((repeat_every is null and repeat_unit is null) or (repeat_every is not null and repeat_unit is not null and due_at is not null));

create table public.chore_assignees (
  chore_id uuid not null references public.chores(id) on delete cascade,
  member_id uuid not null references public.members(id),
  primary key (chore_id, member_id)
);
insert into public.chore_assignees select id, assignee_id from public.chores where assignee_id is not null;

create table public.chore_series (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  template jsonb not null,
  stopped boolean not null default false
);
create table public.chore_board_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  trust_level text not null default 'everything-except-date' check (trust_level in ('open','points-and-new','everything-except-date')),
  retention_days integer not null default 7 check (retention_days in (7,14,30)),
  starters jsonb not null default '[]'
);
create table public.chore_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requested_by uuid not null references public.members(id),
  action text not null check (action in ('create','edit','archive','trust')),
  chore_id uuid references public.chores(id),
  payload jsonb not null,
  approvals jsonb not null,
  created_at timestamptz not null default now()
);
create unique index chore_one_pending_change on public.chore_requests(chore_id) where chore_id is not null;
create unique index chore_one_pending_trust on public.chore_requests(household_id) where action = 'trust';
create unique index chore_series_occurrence on public.chores(series_id, scheduled_at);

alter table public.chore_assignees enable row level security;
alter table public.chore_series enable row level security;
alter table public.chore_board_settings enable row level security;
alter table public.chore_requests enable row level security;
create policy assignments_read on public.chore_assignees for select to authenticated using
  (exists (select 1 from public.chores c where c.id = chore_id and public.is_household_member(c.household_id)));
create policy series_read on public.chore_series for select to authenticated using (public.is_household_member(household_id));
create policy settings_read on public.chore_board_settings for select to authenticated using (public.is_household_member(household_id));
create policy requests_read on public.chore_requests for select to authenticated using (public.is_household_member(household_id));
grant select on public.chore_assignees, public.chore_series, public.chore_board_settings, public.chore_requests to authenticated;
revoke insert, update, delete on public.chores from authenticated;

create function public.chore_json(c public.chores) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', c.id, 'householdId', c.household_id, 'title', c.title, 'points', c.points,
    'assigneeIds', coalesce((select jsonb_agg(a.member_id order by a.member_id) from public.chore_assignees a where a.chore_id=c.id),'[]'),
    'dueAt', coalesce(to_char(c.due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),''),
    'recurrence', case when c.repeat_every is null then 'one time' else 'every ' || c.repeat_every || ' ' || case when c.repeat_every=1 then rtrim(c.repeat_unit,'s') else c.repeat_unit end end,
    'repeatEvery', c.repeat_every, 'repeatUnit', c.repeat_unit, 'dueIntervalDays', c.due_interval_days,
    'seriesId', coalesce(c.series_id,c.id), 'scheduledAt', c.scheduled_at, 'version', c.version, 'archivedAt', c.archived_at, 'isPreApproved', true);
$$;

-- Private helper: validate and replace a chore plus all assignments atomically.
create function public.write_chore(p_household uuid, p_payload jsonb, p_id uuid default null, p_series uuid default null)
returns public.chores language plpgsql set search_path = public as $$
declare c public.chores; a uuid; due timestamptz; every_n integer; unit_name text;
begin
  due := nullif(p_payload->>'dueAt','')::timestamptz;
  every_n := (p_payload->>'repeatEvery')::integer;
  unit_name := p_payload->>'repeatUnit';
  if nullif(trim(p_payload->>'title'),'') is null or length(trim(p_payload->>'title')) > 120 then raise exception 'Choose a chore name between 1 and 120 characters'; end if;
  if (p_payload->>'points')::integer is null or (p_payload->>'points')::integer not between 1 and 10 then raise exception 'Choose 1 to 10 effort points'; end if;
  if (every_n is null) <> (unit_name is null) or (every_n is not null and (every_n not between 1 and 365 or unit_name not in ('days','weeks','months') or due is null)) then raise exception 'Invalid repeat schedule'; end if;
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

-- Private helper, called only after membership, policy and votes have been checked.
create function public.apply_chore_request(r public.chore_requests) returns jsonb language plpgsql set search_path = public as $$
declare c public.chores; s uuid; payload jsonb := r.payload; result jsonb; template_value jsonb;
begin
  if r.action='trust' then
    update public.chore_board_settings set trust_level=payload->>'nextTrustLevel' where household_id=r.household_id;
    return null;
  end if;
  if r.action='create' then
    insert into public.chore_series(household_id,template) values(r.household_id,payload) returning id into s;
    c := public.write_chore(r.household_id,payload,null,s);
  else
    select * into c from public.chores where id=r.chore_id and household_id=r.household_id for update;
    if not found or c.archived_at is not null or c.version <> (payload->>'expectedVersion')::integer
      or exists(select 1 from public.completions where chore_id=c.id) then raise exception 'This chore changed. Reject the request and refresh'; end if;
    s := c.series_id;
    if s is null then
      template_value := public.chore_json(c) || jsonb_build_object('dueInDays',c.due_interval_days);
      insert into public.chore_series(household_id,template) values(r.household_id,template_value) returning id into s;
      update public.chores set series_id=s where id=c.id;
    end if;
    if r.action='archive' then
      update public.chores set archived_at=now(),version=version+1 where id=c.id returning * into c;
      if payload->>'scope'='future' then update public.chore_series set stopped=true where id=s; end if;
    else
      c := public.write_chore(r.household_id,payload,c.id,s);
      if payload->>'scope'='future' then update public.chore_series set template=payload where id=s; end if;
    end if;
  end if;
  result := public.chore_json(c);
  if r.action <> 'archive' then
    update public.chore_board_settings set starters = coalesce((select jsonb_agg(item) from jsonb_array_elements(starters) item where lower(item->>'title')<>lower(c.title)),'[]')
      || jsonb_build_array(result || jsonb_build_object('dueInDays',c.due_interval_days)) where household_id=r.household_id;
  end if;
  return result;
end;
$$;

create function public.request_chore_change(p_household_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid; settings public.chore_board_settings; r public.chore_requests; c public.chores; needs_vote boolean; saved jsonb; due timestamptz;
begin
  -- Serialize household changes, including approvals and recurrence generation.
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
      if p_action='edit' and p_payload->>'scope'='occurrence' and
        ((p_payload->>'repeatEvery')::integer is distinct from c.repeat_every or p_payload->>'repeatUnit' is distinct from c.repeat_unit) then raise exception 'Choose This and future to change the repeat schedule'; end if;
    end if;
    if p_action <> 'archive' then
      due := nullif(p_payload->>'dueAt','')::timestamptz;
      if due::date < (now() at time zone 'UTC')::date and (p_action='create' or due::date is distinct from c.due_at::date) then raise exception 'Choose today or a future due date'; end if;
      -- Validate pending input without writing it; final application revalidates membership too.
      if nullif(trim(p_payload->>'title'),'') is null or length(trim(p_payload->>'title'))>120
        or (p_payload->>'points')::integer is null or (p_payload->>'points')::integer not between 1 and 10 then raise exception 'Invalid chore name or effort points'; end if;
      if jsonb_typeof(p_payload->'assigneeIds') is distinct from 'array' then raise exception 'Assignees must be an array'; end if;
      if exists(select 1 from jsonb_array_elements_text(p_payload->'assigneeIds') a where not exists(select 1 from public.members m where m.id=a.value::uuid and m.household_id=p_household_id)) then raise exception 'Assignee must belong to this household'; end if;
      if ((p_payload->>'repeatEvery') is null) <> ((p_payload->>'repeatUnit') is null)
        or ((p_payload->>'repeatEvery') is not null and ((p_payload->>'repeatEvery')::integer not between 1 and 365 or p_payload->>'repeatUnit' not in ('days','weeks','months') or due is null)) then raise exception 'Invalid repeat schedule'; end if;
    else
      r.payload := public.chore_json(c) || p_payload;
    end if;
    select item into saved from jsonb_array_elements(settings.starters) item where lower(item->>'title')=lower(p_payload->>'starterTitle') limit 1;
    needs_vote := case settings.trust_level when 'open' then false when 'points-and-new' then
      case when p_action='create' then saved is null or lower(saved->>'title') is distinct from lower(p_payload->>'title') or saved->>'points' is distinct from p_payload->>'points'
        when p_action='edit' then c.points is distinct from (p_payload->>'points')::integer else false end
      else case when p_action='create' then saved is null or
        lower(saved->>'title') is distinct from lower(p_payload->>'title') or saved->>'points' is distinct from p_payload->>'points' or
        saved->>'repeatEvery' is distinct from p_payload->>'repeatEvery' or saved->>'repeatUnit' is distinct from p_payload->>'repeatUnit' or
        saved->>'dueInDays' is distinct from p_payload->>'dueInDays' or not ((saved->'assigneeIds') @> (p_payload->'assigneeIds') and (p_payload->'assigneeIds') @> (saved->'assigneeIds'))
        else true end end;
  end if;
  if needs_vote and exists(select 1 from public.members where household_id=p_household_id and id<>actor) then
    insert into public.chore_requests(id,household_id,requested_by,action,chore_id,payload,approvals)
    values(r.id,r.household_id,r.requested_by,r.action,r.chore_id,r.payload,r.approvals);
    return jsonb_build_object('status','pending','pending',r.payload || jsonb_build_object('id',r.id,'householdId',r.household_id,'requestedById',actor,'approvals',r.approvals,'action',r.action));
  end if;
  return jsonb_build_object('status','created','chore',public.apply_chore_request(r));
end;
$$;

create function public.vote_chore_change(p_household_id uuid,p_request_id uuid,p_vote text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor uuid; r public.chore_requests; result jsonb;
begin
  perform 1 from public.households where id=p_household_id for update;
  select id into actor from public.members where household_id=p_household_id and user_id=auth.uid();
  if actor is null then raise exception 'Household membership required'; end if;
  if p_vote is null or p_vote not in ('approved','rejected') then raise exception 'Invalid vote'; end if;
  select * into r from public.chore_requests where id=p_request_id and household_id=p_household_id for update;
  if not found then raise exception 'That request is no longer pending'; end if;
  if p_vote='rejected' then delete from public.chore_requests where id=r.id; return null; end if;
  r.approvals := r.approvals || jsonb_build_object(actor,'approved');
  if exists(select 1 from public.members m where m.household_id=p_household_id and r.approvals->>m.id::text is distinct from 'approved') then
    update public.chore_requests set approvals=r.approvals where id=r.id; return null;
  end if;
  result := public.apply_chore_request(r);
  delete from public.chore_requests where id=r.id;
  return result;
end;
$$;

create function public.get_chore_board(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.chore_series; c public.chores; due timestamptz; settings public.chore_board_settings; payload jsonb;
begin
  perform 1 from public.households where id=p_household_id for update;
  if not public.is_household_member(p_household_id) then raise exception 'Household membership required'; end if;
  insert into public.chore_board_settings(household_id) values(p_household_id) on conflict do nothing;
  -- Give legacy recurring chores a series on their first hosted board read.
  for c in select * from public.chores where household_id=p_household_id and series_id is null and repeat_every is not null loop
    insert into public.chore_series(household_id,template) values(p_household_id,public.chore_json(c) || jsonb_build_object('dueInDays',c.due_interval_days)) returning * into s;
    update public.chores set series_id=s.id where id=c.id;
  end loop;
  for s in select * from public.chore_series where household_id=p_household_id and not stopped loop
    select * into c from public.chores where series_id=s.id order by occurrence_order desc limit 1;
    if c.id is null or c.scheduled_at is null or s.template->>'repeatEvery' is null then continue; end if;
    if c.archived_at is null and not exists(select 1 from public.completions where chore_id=c.id) then continue; end if;
    due := c.scheduled_at + ((s.template->>'repeatEvery') || ' ' || (s.template->>'repeatUnit'))::interval;
    if due>now() then continue; end if;
    if not exists(select 1 from public.chores where series_id=s.id and scheduled_at=due) then
      payload := s.template || jsonb_build_object('dueAt',due);
      perform public.write_chore(p_household_id,payload,null,s.id);
    end if;
  end loop;
  select * into settings from public.chore_board_settings where household_id=p_household_id;
  return jsonb_build_object(
    'chores',coalesce((select jsonb_agg(public.chore_json(ch) order by ch.due_at nulls last,ch.id) from public.chores ch where household_id=p_household_id),'[]'),
    'completions',coalesce((select jsonb_agg(jsonb_build_object('id',co.id,'choreId',co.chore_id,'memberId',co.member_id,'pointsAwarded',co.points_awarded,'completedAt',co.completed_at)) from public.completions co join public.chores ch on ch.id=co.chore_id where ch.household_id=p_household_id),'[]'),
    'trustLevel',settings.trust_level,'completedRetentionDays',settings.retention_days,'choreStarters',settings.starters,
    'pendingChores',coalesce((select jsonb_agg(r.payload || jsonb_build_object('id',r.id,'householdId',r.household_id,'requestedById',r.requested_by,'approvals',r.approvals,'action',r.action)) from public.chore_requests r where household_id=p_household_id and action<>'trust'),'[]'),
    'pendingTrustChanges',coalesce((select jsonb_agg(r.payload || jsonb_build_object('id',r.id,'householdId',r.household_id,'requestedById',r.requested_by,'approvals',r.approvals)) from public.chore_requests r where household_id=p_household_id and action='trust'),'[]'));
end;
$$;

create function public.update_chore_board_settings(p_household_id uuid,p_retention integer default null,p_remove_starter text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.households where id=p_household_id for update;
  if not public.is_household_member(p_household_id) then raise exception 'Household membership required'; end if;
  insert into public.chore_board_settings(household_id) values(p_household_id) on conflict do nothing;
  if p_retention is not null then update public.chore_board_settings set retention_days=p_retention where household_id=p_household_id; end if;
  if p_remove_starter is not null then update public.chore_board_settings set starters=coalesce((select jsonb_agg(item) from jsonb_array_elements(starters) item where item->>'title'<>p_remove_starter),'[]') where household_id=p_household_id; end if;
end;
$$;

create or replace function public.complete_chore(p_chore_id uuid,p_idempotency_key text) returns public.completions
language plpgsql security definer set search_path = public as $$
declare c public.chores; actor uuid; result public.completions;
begin
  select * into c from public.chores where id=p_chore_id;
  perform 1 from public.households where id=c.household_id for update;
  select * into c from public.chores where id=p_chore_id for update;
  select id into actor from public.members where household_id=c.household_id and user_id=auth.uid();
  if actor is null then raise exception 'Household membership required'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'Idempotency key required'; end if;
  select * into result from public.completions where chore_id=c.id order by completed_at limit 1;
  if found then return result; end if;
  if c.archived_at is not null then raise exception 'That chore was deleted'; end if;
  if exists(select 1 from public.completions where member_id=actor and client_request_id=p_idempotency_key) then raise exception 'Request key already used for another chore'; end if;
  insert into public.completions(chore_id,member_id,points_awarded,client_request_id) values(c.id,actor,c.points,p_idempotency_key) returning * into result;
  return result;
end;
$$;

revoke all on function public.chore_json(public.chores) from public;
revoke all on function public.write_chore(uuid,jsonb,uuid,uuid) from public;
revoke all on function public.apply_chore_request(public.chore_requests) from public;
revoke all on function public.request_chore_change(uuid,text,jsonb) from public;
revoke all on function public.vote_chore_change(uuid,uuid,text) from public;
revoke all on function public.get_chore_board(uuid) from public;
revoke all on function public.update_chore_board_settings(uuid,integer,text) from public;
grant execute on function public.request_chore_change(uuid,text,jsonb), public.vote_chore_change(uuid,uuid,text), public.get_chore_board(uuid), public.update_chore_board_settings(uuid,integer,text) to authenticated;

-- Derive totals from durable awards rather than maintaining a counter that can drift.
create view public.member_point_totals with (security_invoker=true) as
select m.id as member_id,m.household_id,coalesce(sum(c.points_awarded),0)::bigint as total_points
from public.members m left join public.completions c on c.member_id=m.id
group by m.id,m.household_id;
grant select on public.member_point_totals to authenticated;
