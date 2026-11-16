-- Front Row: friends. Run once in Supabase: SQL Editor > New query > paste all of this > Run.
-- Friends are shared with Save Point: the same handles (sp_profiles) and friendships (sp_friends), so people who are
-- already friends in Save Point are friends in Front Row too. Running this again is safe; nothing existing is removed.
--   fr_shelves  the copy of your watchlist, seen titles and lists that your friends can see (no notes)
-- It also lets new accounts sign up with the invite code frontrow2026 (next to the Book Nook code).

create table if not exists public.sp_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  name text not null default '' check (char_length(name) <= 40),
  buddy text not null default '' check (char_length(buddy) <= 12),
  updated_at timestamptz not null default now()
);
create table if not exists public.sp_friends (
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
alter table public.sp_profiles enable row level security;
alter table public.sp_friends enable row level security;
create or replace function public.sp_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sp_friends f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'sp_profiles' and policyname = 'sp_profiles read') then
    create policy "sp_profiles read" on public.sp_profiles for select to authenticated using (true);
    create policy "sp_profiles add own" on public.sp_profiles for insert to authenticated with check (user_id = auth.uid());
    create policy "sp_profiles change own" on public.sp_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy "sp_profiles remove own" on public.sp_profiles for delete to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sp_friends' and policyname = 'sp_friends read own') then
    create policy "sp_friends read own" on public.sp_friends for select to authenticated using (auth.uid() in (requester, addressee));
    create policy "sp_friends send" on public.sp_friends for insert to authenticated with check (requester = auth.uid() and status = 'pending');
    create policy "sp_friends accept" on public.sp_friends for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
    create policy "sp_friends remove" on public.sp_friends for delete to authenticated using (auth.uid() in (requester, addressee));
  end if;
end $$;

-- what your friends can see of your Front Row
create table if not exists public.fr_shelves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.fr_shelves enable row level security;
drop policy if exists "fr_shelves read" on public.fr_shelves;
drop policy if exists "fr_shelves add own" on public.fr_shelves;
drop policy if exists "fr_shelves change own" on public.fr_shelves;
drop policy if exists "fr_shelves remove own" on public.fr_shelves;
create policy "fr_shelves read" on public.fr_shelves for select to authenticated using (user_id = auth.uid() or public.sp_are_friends(auth.uid(), user_id));
create policy "fr_shelves add own" on public.fr_shelves for insert to authenticated with check (user_id = auth.uid());
create policy "fr_shelves change own" on public.fr_shelves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fr_shelves remove own" on public.fr_shelves for delete to authenticated using (user_id = auth.uid());

-- the invite code: wherever the sign-up check compares with 'booknook26', accept 'frontrow2026' as well
do $$
declare f record; def text; nd text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'auth') and p.prosrc ilike '%booknook26%' and p.prosrc not ilike '%frontrow2026%' loop
    def := pg_get_functiondef(f.oid);
    nd := regexp_replace(def, '(<>|!=)\s*''booknook26''', 'not in (''booknook26'', ''frontrow2026'')', 'gi');
    nd := regexp_replace(nd, '([^<>!])=\s*''booknook26''', '\1 in (''booknook26'', ''frontrow2026'')', 'gi');
    nd := regexp_replace(nd, 'in\s*\(([^)]*)''booknook26''([^)]*)\)', 'in (\1''booknook26'', ''frontrow2026''\2)', 'gi');
    nd := replace(nd, 'in (''booknook26'', ''frontrow2026'', ''frontrow2026'')', 'in (''booknook26'', ''frontrow2026'')');
    if nd <> def then execute nd; raise notice 'Invite code frontrow2026 added to %', f.oid::regprocedure; end if;
  end loop;
end $$;
select case when exists (select 1 from pg_proc where prosrc ilike '%frontrow2026%')
  then 'Done. New accounts can use the invite code frontrow2026.'
  else 'Friends are set up. The invite check was not found automatically: new accounts can still use booknook26.' end as result;
