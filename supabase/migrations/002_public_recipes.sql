-- Public recipe catalog. Only existing family members can publish.
begin;

create table public.public_recipes (
  id text primary key check (id ~ '^pub-[a-f0-9-]{36}$'),
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  check (recipe->>'id' = id)
);
alter table public.public_recipes enable row level security;
revoke all on public.public_recipes from anon, authenticated;
grant select(recipe) on public.public_recipes to anon, authenticated;
create policy public_recipe_read on public.public_recipes for select to anon, authenticated using (true);

-- The extraction reservation is made before contacting OpenAI. A failed request
-- still consumes a slot, preventing repeated free attempts after API failures.
create table public.recipe_ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index recipe_ai_usage_user_time_idx on public.recipe_ai_usage(user_id, created_at);
alter table public.recipe_ai_usage enable row level security;
revoke all on public.recipe_ai_usage from anon, authenticated;

create function public.reserve_recipe_extraction()
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or not exists (select 1 from public.family_members where user_id = caller) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(caller::text));
  if (select count(*) from public.recipe_ai_usage where user_id = caller and created_at >= now() - interval '1 minute') >= 1
    or (select count(*) from public.recipe_ai_usage where user_id = caller and created_at >= date_trunc('day', now())) >= 10
    or (select count(*) from public.recipe_ai_usage where user_id = caller and created_at >= date_trunc('month', now())) >= 60
  then raise exception 'quota_exceeded' using errcode = 'P0001'; end if;
  insert into public.recipe_ai_usage(user_id) values (caller);
end;
$$;
revoke all on function public.reserve_recipe_extraction() from public, anon;
grant execute on function public.reserve_recipe_extraction() to authenticated;

create function public.publish_public_recipe(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  recipe_id text := 'pub-' || gen_random_uuid()::text;
  saved jsonb;
begin
  if caller is null or not exists (select 1 from public.family_members where user_id = caller) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 40000
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  if jsonb_typeof(payload->'ingredients') is distinct from 'array'
    or jsonb_typeof(payload->'steps') is distinct from 'array'
    or jsonb_typeof(payload->'season') is distinct from 'array'
    or jsonb_typeof(payload->'tags') is distinct from 'array'
    or jsonb_typeof(payload->'allergens') is distinct from 'array'
    or jsonb_typeof(payload->'variations') is distinct from 'array'
    or jsonb_typeof(payload->'pairings') is distinct from 'array'
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  if jsonb_array_length(payload->'ingredients') not between 1 and 100
    or jsonb_array_length(payload->'steps') not between 1 and 100
    or jsonb_array_length(payload->'pairings') <> 0
    or jsonb_array_length(payload->'season') > 4
    or jsonb_array_length(payload->'tags') > 30
    or jsonb_array_length(payload->'allergens') > 30
    or jsonb_array_length(payload->'variations') > 30
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  if jsonb_typeof(payload->'title') is distinct from 'string'
    or jsonb_typeof(payload->'category') is distinct from 'string'
    or jsonb_typeof(payload->'difficulty') is distinct from 'string'
    or jsonb_typeof(payload->'servingsUnit') is distinct from 'string'
    or jsonb_typeof(payload->'babyNotes') is distinct from 'string'
    or length(trim(payload->>'title')) not between 1 and 200
    or length(payload->>'category') > 100
    or length(payload->>'difficulty') > 100
    or length(trim(payload->>'servingsUnit')) not between 1 and 100
    or length(payload->>'babyNotes') > 12000
    or coalesce(payload->>'image', '') <> ''
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  if coalesce((payload->>'time') ~ '^[0-9]{1,5}$', false) = false
    or coalesce((payload->>'servings') ~ '^[0-9]{1,4}$', false) = false
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  if (payload->>'time')::int > 10080 or (payload->>'servings')::int not between 1 and 1000
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(payload->'ingredients') item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'ingredient') is distinct from 'string'
      or jsonb_typeof(item->'amount') is distinct from 'string'
      or jsonb_typeof(item->'unit') is distinct from 'string'
      or length(trim(item->>'ingredient')) not between 1 and 500
      or length(item->>'amount') > 500 or length(item->>'unit') > 500)
    or exists (select 1 from jsonb_array_elements(payload->'steps') item where jsonb_typeof(item) <> 'string' or length(trim(item #>> '{}')) not between 1 and 12000)
    or exists (select 1 from jsonb_array_elements(payload->'season') item where item #>> '{}' not in ('primavera','estiu','tardor','hivern'))
    or exists (select 1 from jsonb_array_elements(payload->'tags') item where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 120)
    or exists (select 1 from jsonb_array_elements(payload->'allergens') item where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 120)
    or exists (select 1 from jsonb_array_elements(payload->'variations') item where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 12000)
  then raise exception 'invalid_recipe' using errcode = '22023'; end if;
  saved := jsonb_build_object(
    'id', recipe_id, 'title', payload->'title', 'category', payload->'category',
    'difficulty', payload->'difficulty', 'time', payload->'time',
    'servings', payload->'servings', 'servingsUnit', payload->'servingsUnit',
    'image', '', 'ingredients', payload->'ingredients', 'steps', payload->'steps',
    'season', payload->'season', 'tags', payload->'tags',
    'allergens', payload->'allergens', 'babyNotes', payload->'babyNotes',
    'variations', payload->'variations', 'pairings', '[]'::jsonb
  );
  insert into public.public_recipes(id, recipe, created_by) values (recipe_id, saved, caller);
  return saved;
end;
$$;
revoke all on function public.publish_public_recipe(jsonb) from public, anon;
grant execute on function public.publish_public_recipe(jsonb) to authenticated;
commit;
