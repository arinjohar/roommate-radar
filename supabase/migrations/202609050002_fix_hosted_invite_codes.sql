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

  -- Use PostgreSQL built-ins rather than an extension function whose schema can
  -- differ between local and hosted Supabase projects. The loop protects the
  -- unique invite-code constraint even in the unlikely event of a collision.
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
