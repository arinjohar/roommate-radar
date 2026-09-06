create or replace function public.clean_departing_member_templates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A household deletion already cascades through every related table. Avoid
  -- rewriting child rows after PostgreSQL has marked their parent for deletion.
  if not exists (
    select 1 from public.households where id = old.household_id
  ) then
    return old;
  end if;

  update public.chore_series series
  set template = jsonb_set(
    series.template,
    '{assigneeIds}',
    coalesce((
      select jsonb_agg(assignee.member_id)
      from jsonb_array_elements_text(coalesce(series.template->'assigneeIds', '[]'::jsonb)) assignee(member_id)
      where assignee.member_id <> old.id::text
    ), '[]'::jsonb),
    true
  )
  where series.household_id = old.household_id
    and series.template ? 'assigneeIds';

  update public.chore_board_settings settings
  set starters = coalesce((
    select jsonb_agg(
      case when starter.value ? 'assigneeIds' then jsonb_set(
        starter.value,
        '{assigneeIds}',
        coalesce((
          select jsonb_agg(assignee.member_id)
          from jsonb_array_elements_text(coalesce(starter.value->'assigneeIds', '[]'::jsonb)) assignee(member_id)
          where assignee.member_id <> old.id::text
        ), '[]'::jsonb),
        true
      ) else starter.value end
    )
    from jsonb_array_elements(coalesce(settings.starters, '[]'::jsonb)) starter(value)
  ), '[]'::jsonb)
  where settings.household_id = old.household_id;

  update public.chore_requests
  set approvals = approvals - old.id::text
  where household_id = old.household_id;

  return old;
end;
$$;
