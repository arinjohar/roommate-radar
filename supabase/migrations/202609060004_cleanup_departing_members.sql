alter table public.chore_assignees
  drop constraint chore_assignees_member_id_fkey,
  add constraint chore_assignees_member_id_fkey
    foreign key (member_id) references public.members(id) on delete cascade;

alter table public.chore_requests
  drop constraint chore_requests_requested_by_fkey,
  add constraint chore_requests_requested_by_fkey
    foreign key (requested_by) references public.members(id) on delete cascade;

create or replace function public.clean_departing_member_templates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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

drop trigger if exists members_clean_departing_templates on public.members;
create trigger members_clean_departing_templates
before delete on public.members
for each row execute function public.clean_departing_member_templates();

revoke all on function public.clean_departing_member_templates() from public;
