alter table public.households
  add column if not exists creator_member_id uuid references public.members(id) on delete set null;

update public.households household
set creator_member_id = (
  select member.id
  from public.members member
  where member.household_id = household.id
  order by member.created_at asc, member.id asc
  limit 1
)
where household.creator_member_id is null;

create index if not exists households_creator_member_id_idx
  on public.households(creator_member_id);

create or replace function public.create_household(
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

  update public.households
  set creator_member_id = created_member.id
  where id = created_household.id
  returning * into created_household;

  return jsonb_build_object(
    'household', to_jsonb(created_household),
    'member', to_jsonb(created_member)
  );
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_member public.members;
  owner_member_id uuid;
begin
  select * into acting_member
  from public.members
  where household_id = p_household_id and user_id = auth.uid();
  if not found then raise exception 'Household membership required'; end if;

  select creator_member_id into owner_member_id
  from public.households where id = p_household_id for update;
  if owner_member_id = acting_member.id then
    raise exception 'Transfer ownership or delete the household before leaving';
  end if;

  delete from public.members where id = acting_member.id;
end;
$$;

create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_member_id uuid;
begin
  select id into acting_member_id
  from public.members
  where household_id = p_household_id and user_id = auth.uid();
  if not found then raise exception 'Household membership required'; end if;
  if not exists (
    select 1 from public.households
    where id = p_household_id and creator_member_id = acting_member_id
  ) then raise exception 'Only the household creator can delete this household'; end if;

  delete from public.households where id = p_household_id;
end;
$$;

create or replace function public.transfer_household_ownership_and_leave(
  p_household_id uuid,
  p_new_owner_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_member public.members;
  new_owner public.members;
begin
  select * into acting_member
  from public.members
  where household_id = p_household_id and user_id = auth.uid();
  if not found then raise exception 'Household membership required'; end if;

  perform 1 from public.households
  where id = p_household_id and creator_member_id = acting_member.id
  for update;
  if not found then raise exception 'Only the household creator can transfer ownership'; end if;

  select * into new_owner
  from public.members
  where id = p_new_owner_member_id
    and household_id = p_household_id
    and id <> acting_member.id
    and user_id is not null;
  if not found then raise exception 'Choose one other current household member'; end if;

  update public.households
  set creator_member_id = new_owner.id, created_by = new_owner.user_id
  where id = p_household_id;
  delete from public.members where id = acting_member.id;
end;
$$;

revoke all on function public.leave_household(uuid) from public;
revoke all on function public.delete_household(uuid) from public;
revoke all on function public.transfer_household_ownership_and_leave(uuid, uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.delete_household(uuid) to authenticated;
grant execute on function public.transfer_household_ownership_and_leave(uuid, uuid) to authenticated;

-- PostgreSQL cannot replace a function when its table-shaped return type changes.
drop function if exists public.list_my_household_memberships();

create or replace function public.list_my_household_memberships()
returns table(
  household_id uuid,
  household_name text,
  invite_code text,
  creator_member_id uuid,
  household_created_at timestamptz,
  member_id uuid,
  display_name text,
  avatar_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    households.id,
    households.name,
    households.invite_code,
    households.creator_member_id,
    households.created_at,
    members.id,
    members.display_name,
    members.avatar_color
  from public.members
  join public.households on households.id = members.household_id
  where members.user_id = auth.uid()
  order by households.created_at asc;
$$;
