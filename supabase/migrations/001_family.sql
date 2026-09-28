-- Run once in the Supabase SQL editor. Memberships are provisioned by the administrator.
begin;
create table public.family_documents (
  family_id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  revision integer not null default 0,
  data jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table public.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.family_documents(family_id) on delete cascade
);
create index family_members_family_idx on public.family_members(family_id);
create table public.family_history (
  family_id uuid not null references public.family_documents(family_id) on delete cascade,
  revision integer not null,
  data jsonb not null,
  updated_at timestamptz not null,
  updated_by uuid references auth.users(id) on delete set null,
  primary key (family_id, revision)
);
alter table public.family_documents enable row level security;
alter table public.family_members enable row level security;
alter table public.family_history enable row level security;
revoke all on public.family_documents, public.family_members, public.family_history from anon, authenticated;
grant select on public.family_documents, public.family_members, public.family_history to authenticated;
create policy own_membership on public.family_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy family_read on public.family_documents for select to authenticated
  using (exists (select 1 from public.family_members m where m.user_id = (select auth.uid()) and m.family_id = family_documents.family_id));
create policy family_history_read on public.family_history for select to authenticated
  using (exists (select 1 from public.family_members m where m.user_id = (select auth.uid()) and m.family_id = family_history.family_id));

-- Only this function may write documents. Lock + revision prevents lost updates.
create function public.save_family_document(target_family uuid, expected_revision integer, next_data jsonb)
returns setof public.family_documents
language plpgsql security definer set search_path = '' as $$
declare previous public.family_documents;
begin
  if auth.uid() is null or not exists (
    select 1 from public.family_members where user_id = auth.uid() and family_id = target_family
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if next_data is null or jsonb_typeof(next_data) is distinct from 'object'
    or jsonb_typeof(next_data->'recipes') is distinct from 'object'
    or jsonb_typeof(next_data->'menus'->'days') is distinct from 'object'
    or next_data->'menus'->>'year' is distinct from '2026'
    or octet_length(next_data::text) > 6000000
  then raise exception 'invalid_document' using errcode = '22023'; end if;
  select * into previous from public.family_documents where family_id = target_family for update;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if expected_revision is null or previous.revision <> expected_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  if previous.data is not null then
    insert into public.family_history values (previous.family_id, previous.revision, previous.data, previous.updated_at, previous.updated_by);
    -- Retain the last 20 saved versions per family; exported backups are independent.
    delete from public.family_history where family_id = target_family and revision < previous.revision - 19;
  end if;
  return query update public.family_documents
    set data = next_data, revision = previous.revision + 1, updated_at = now(), updated_by = auth.uid()
    where family_id = target_family returning *;
end;
$$;
revoke all on function public.save_family_document(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_family_document(uuid, integer, jsonb) to authenticated;
commit;
