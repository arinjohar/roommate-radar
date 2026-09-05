create extension if not exists pgcrypto;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  invite_code text not null unique check (invite_code = upper(invite_code)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  avatar_color text not null check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  points integer not null check (points between 1 and 20),
  assignee_id uuid references public.members(id) on delete set null,
  due_at timestamptz not null,
  recurrence text not null check (recurrence in ('once', 'daily', 'weekly', 'biweekly', 'monthly')),
  created_at timestamptz not null default now()
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  points_awarded integer not null check (points_awarded between 1 and 20),
  completed_at timestamptz not null default now(),
  client_request_id text not null,
  unique (member_id, client_request_id)
);

create table public.pulse_responses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  week_start date not null,
  cleanliness integer not null check (cleanliness between 1 and 5),
  noise integer not null check (noise between 1 and 5),
  communication integer not null check (communication between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, week_start)
);

create index members_household_id_idx on public.members(household_id);
create index members_user_id_idx on public.members(user_id);
create index chores_household_due_idx on public.chores(household_id, due_at);
create index completions_chore_completed_idx on public.completions(chore_id, completed_at);
create index pulse_household_week_idx on public.pulse_responses(household_id, week_start);

create function public.validate_chore_assignee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.members
    where id = new.assignee_id and household_id = new.household_id
  ) then
    raise exception 'Chore assignee must belong to the same household';
  end if;
  return new;
end;
$$;

create trigger chores_validate_assignee
before insert or update of assignee_id, household_id on public.chores
for each row execute function public.validate_chore_assignee();

create function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;

create function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.households
    where id = p_household_id and created_by = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.chores enable row level security;
alter table public.completions enable row level security;
alter table public.pulse_responses enable row level security;

create policy households_select_member on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy households_update_owner on public.households
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy members_select_household on public.members
  for select to authenticated
  using (public.is_household_member(household_id));

create policy members_update_self on public.members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy chores_select_household on public.chores
  for select to authenticated
  using (public.is_household_member(household_id));

create policy chores_insert_owner on public.chores
  for insert to authenticated
  with check (public.is_household_owner(household_id));

create policy chores_update_owner on public.chores
  for update to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

create policy chores_delete_owner on public.chores
  for delete to authenticated
  using (public.is_household_owner(household_id));

create policy completions_select_household on public.completions
  for select to authenticated
  using (
    exists (
      select 1 from public.chores
      where chores.id = completions.chore_id
        and public.is_household_member(chores.household_id)
    )
  );

create policy pulse_select_household on public.pulse_responses
  for select to authenticated
  using (public.is_household_member(household_id));

create policy pulse_insert_self on public.pulse_responses
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.members
      where members.id = pulse_responses.member_id
        and members.household_id = pulse_responses.household_id
        and members.user_id = auth.uid()
    )
  );

create policy pulse_update_self on public.pulse_responses
  for update to authenticated
  using (
    exists (
      select 1 from public.members
      where members.id = pulse_responses.member_id
        and members.household_id = pulse_responses.household_id
        and members.user_id = auth.uid()
    )
  )
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.members
      where members.id = pulse_responses.member_id
        and members.household_id = pulse_responses.household_id
        and members.user_id = auth.uid()
    )
  );

create function public.create_household(
  p_name text,
  p_display_name text,
  p_avatar_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_household public.households;
  created_member public.members;
  generated_invite_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  loop
    generated_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 8));
    exit when not exists (
      select 1 from public.households where invite_code = generated_invite_code
    );
  end loop;

  insert into public.households(name, invite_code, created_by)
  values (trim(p_name), generated_invite_code, auth.uid())
  returning * into created_household;

  insert into public.members(household_id, user_id, display_name, avatar_color)
  values (created_household.id, auth.uid(), trim(p_display_name), p_avatar_color)
  returning * into created_member;

  return jsonb_build_object(
    'household', to_jsonb(created_household),
    'member', to_jsonb(created_member)
  );
end;
$$;

create function public.join_household(
  p_invite_code text,
  p_display_name text,
  p_avatar_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  joined_household public.households;
  joined_member public.members;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into joined_household
  from public.households
  where invite_code = upper(trim(p_invite_code));

  if not found then raise exception 'Invite code not found'; end if;

  insert into public.members(household_id, user_id, display_name, avatar_color)
  values (joined_household.id, auth.uid(), trim(p_display_name), p_avatar_color)
  on conflict (household_id, user_id) do update
    set display_name = excluded.display_name, avatar_color = excluded.avatar_color
  returning * into joined_member;

  return jsonb_build_object(
    'household', to_jsonb(joined_household),
    'member', to_jsonb(joined_member)
  );
end;
$$;

create function public.complete_chore(p_chore_id uuid, p_idempotency_key text)
returns public.completions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_chore public.chores;
  acting_member public.members;
  result public.completions;
begin
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key required';
  end if;
  select * into selected_chore from public.chores where id = p_chore_id;
  if not found or not public.is_household_member(selected_chore.household_id) then
    raise exception 'Chore not found';
  end if;

  select * into acting_member from public.members
  where household_id = selected_chore.household_id and user_id = auth.uid();

  insert into public.completions(chore_id, member_id, points_awarded, client_request_id)
  values (selected_chore.id, acting_member.id, selected_chore.points, p_idempotency_key)
  on conflict (member_id, client_request_id) do update
    set client_request_id = excluded.client_request_id
  returning * into result;

  return result;
end;
$$;

create function public.submit_pulse(
  p_household_id uuid,
  p_week_start date,
  p_cleanliness integer,
  p_noise integer,
  p_communication integer
)
returns public.pulse_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_member public.members;
  result public.pulse_responses;
begin
  select * into acting_member from public.members
  where household_id = p_household_id and user_id = auth.uid();
  if not found then raise exception 'Household membership required'; end if;
  if p_cleanliness not between 1 and 5
    or p_noise not between 1 and 5
    or p_communication not between 1 and 5 then
    raise exception 'Pulse scores must be between 1 and 5';
  end if;

  insert into public.pulse_responses(
    household_id, member_id, week_start, cleanliness, noise, communication
  ) values (
    p_household_id, acting_member.id, p_week_start, p_cleanliness, p_noise, p_communication
  )
  on conflict (member_id, week_start) do update set
    cleanliness = excluded.cleanliness,
    noise = excluded.noise,
    communication = excluded.communication,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

create function public.reset_my_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.completions
  where member_id in (select id from public.members where user_id = auth.uid());
  delete from public.pulse_responses
  where member_id in (select id from public.members where user_id = auth.uid());
end;
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.validate_chore_assignee() from public;
revoke all on function public.create_household(text, text, text) from public;
revoke all on function public.join_household(text, text, text) from public;
revoke all on function public.complete_chore(uuid, text) from public;
revoke all on function public.submit_pulse(uuid, date, integer, integer, integer) from public;
revoke all on function public.reset_my_demo_data() from public;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;
grant execute on function public.complete_chore(uuid, text) to authenticated;
grant execute on function public.submit_pulse(uuid, date, integer, integer, integer) to authenticated;
grant execute on function public.reset_my_demo_data() to authenticated;

grant select on public.households, public.members, public.chores, public.completions,
  public.pulse_responses to authenticated;
grant update on public.households, public.members to authenticated;
grant insert, update, delete on public.chores to authenticated;
grant insert, update on public.pulse_responses to authenticated;
