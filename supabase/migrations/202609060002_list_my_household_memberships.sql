create or replace function public.list_my_household_memberships()
returns table(
  household_id uuid,
  household_name text,
  invite_code text,
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
    households.created_at,
    members.id,
    members.display_name,
    members.avatar_color
  from public.members
  join public.households on households.id = members.household_id
  where members.user_id = auth.uid()
  order by households.created_at asc;
$$;

revoke all on function public.list_my_household_memberships() from public;
grant execute on function public.list_my_household_memberships() to authenticated;
