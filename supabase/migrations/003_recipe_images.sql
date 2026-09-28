-- Public, processed recipe photos. Originals and book pages are never stored here.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 2000000, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2000000,
  allowed_mime_types = array['image/jpeg'];

create policy recipe_image_member_upload on storage.objects
for insert to authenticated with check (
  bucket_id = 'recipe-images'
  and name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$'
  and split_part(name, '/', 1) = (select auth.uid()::text)
  and exists (select 1 from public.family_members where user_id = (select auth.uid()))
);

-- The upload path belongs to the current member; a member of the author's
-- family may add or replace the public cover without changing the recipe text.
create function public.set_public_recipe_image(recipe_id text, image_path text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  object_name text;
  saved jsonb;
begin
  if caller is null or image_path is null or image_path !~ '^recipe-images/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$'
  then raise exception 'invalid_image' using errcode = '22023'; end if;
  object_name := substring(image_path from length('recipe-images/') + 1);
  if split_part(object_name, '/', 1) <> caller::text
    or not exists (select 1 from storage.objects where bucket_id = 'recipe-images' and name = object_name)
  then raise exception 'invalid_image' using errcode = '22023'; end if;
  update public.public_recipes r
  set recipe = jsonb_set(r.recipe, '{image}', to_jsonb(image_path))
  where r.id = recipe_id and exists (
    select 1 from public.family_members me
    join public.family_members author on author.family_id = me.family_id
    where me.user_id = caller and author.user_id = r.created_by
  ) returning r.recipe into saved;
  if saved is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return saved;
end;
$$;
revoke all on function public.set_public_recipe_image(text, text) from public, anon;
grant execute on function public.set_public_recipe_image(text, text) to authenticated;

-- Keep publication atomic: a missing or foreign cover rolls back the recipe.
create function public.publish_public_recipe_with_image(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb;
begin
  saved := public.publish_public_recipe(payload - 'image');
  if coalesce(payload->>'image', '') <> '' then
    saved := public.set_public_recipe_image(saved->>'id', payload->>'image');
  end if;
  return saved;
end;
$$;
revoke all on function public.publish_public_recipe_with_image(jsonb) from public, anon;
grant execute on function public.publish_public_recipe_with_image(jsonb) to authenticated;

commit;
