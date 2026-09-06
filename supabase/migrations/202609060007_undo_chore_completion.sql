-- Let household members correct an accidental completion without duplicating a recurring occurrence.
create or replace function public.undo_chore_completion(p_chore_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.chores;
  successor public.chores;
  actor uuid;
  completion_id uuid;
  completer_id uuid;
  later_count integer;
begin
  select * into c from public.chores where id = p_chore_id;
  if not found then raise exception 'That completion is no longer available'; end if;

  perform 1 from public.households where id = c.household_id for update;
  select * into c from public.chores where id = p_chore_id for update;
  select id into actor from public.members where household_id = c.household_id and user_id = auth.uid();
  if actor is null then raise exception 'Household membership required'; end if;

  select id, member_id into completion_id, completer_id
  from public.completions where chore_id = c.id order by completed_at limit 1 for update;
  if completion_id is null then raise exception 'That completion is no longer available'; end if;
  if completer_id <> actor then raise exception 'Only the roommate who completed this chore can undo it'; end if;

  if c.series_id is not null
    and not exists(select 1 from public.completions where chore_id = c.id and id <> completion_id)
  then
    select count(*) into later_count
    from public.chores
    where series_id = c.series_id and occurrence_order > c.occurrence_order;

    if later_count > 1 then
      raise exception 'A newer recurring occurrence has already changed. Undo the latest occurrence instead';
    elsif later_count = 1 then
      select * into successor
      from public.chores
      where series_id = c.series_id and occurrence_order > c.occurrence_order
      for update;

      if successor.archived_at is not null
        or successor.version <> 1
        or exists(select 1 from public.completions where chore_id = successor.id)
        or exists(select 1 from public.chore_requests where chore_id = successor.id)
      then
        raise exception 'A newer recurring occurrence has already changed. Undo the latest occurrence instead';
      end if;
      delete from public.chores where id = successor.id;
    end if;
  end if;

  delete from public.completions where id = completion_id;
end;
$$;

revoke all on function public.undo_chore_completion(uuid) from public;
grant execute on function public.undo_chore_completion(uuid) to authenticated;
