-- Legacy AI suggestions have no reliable intensity or sitting-break evidence.
-- Preserve the idea, its ID and owner; use conservative estimates for missing tags.
update public.enough_ideas
set idea_json = idea_json || jsonb_build_object(
  'intensity', case when idea_json->>'intensity' in ('light','moderate','vigorous-burst','strength') then idea_json->>'intensity' else 'light' end,
  'breaksSitting', case when jsonb_typeof(idea_json->'breaksSitting') = 'boolean' then idea_json->'breaksSitting' else 'false'::jsonb end
)
where idea_json->>'intensity' is null
   or idea_json->>'intensity' not in ('light','moderate','vigorous-burst','strength')
   or jsonb_typeof(idea_json->'breaksSitting') is distinct from 'boolean';

-- Older app versions may still archive untagged ideas during a rolling release.
create function public.enough_default_idea_movement_tags() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.idea_json := new.idea_json || jsonb_build_object(
    'intensity', coalesce(new.idea_json->>'intensity', 'light'),
    'breaksSitting', coalesce(nullif(new.idea_json->'breaksSitting','null'::jsonb), 'false'::jsonb)
  );
  return new;
end;
$$;
revoke all on function public.enough_default_idea_movement_tags() from public, anon, authenticated;
create trigger enough_idea_movement_defaults
before insert or update of idea_json on public.enough_ideas
for each row execute function public.enough_default_idea_movement_tags();

alter table public.enough_ideas add constraint enough_idea_movement_tags check (
  idea_json->>'intensity' in ('light','moderate','vigorous-burst','strength')
  and jsonb_typeof(idea_json->'breaksSitting') = 'boolean'
);
