-- =====================================================================
-- Home Inventory App — initial schema (prototype)
-- Run once in Supabase: SQL Editor → New query → paste → Run
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Households and members (lets both phones share one inventory)
-- ---------------------------------------------------------------------
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique
               default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at   timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ---------------------------------------------------------------------
-- 2. Rooms and locations
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists public.locations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  room_id      uuid not null,
  name         text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (id, household_id),
  -- a location must belong to a room in the same household
  foreign key (room_id, household_id)
    references public.rooms(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- 3. Products (what a thing is) — one row per product per household
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  barcode      text,                         -- null for produce, bulk, homemade
  name         text not null,
  brand        text,
  category     text not null default 'Other',
  image_url    text,
  size         text,                         -- e.g. '500 ml', '12 pack'
  source       text not null default 'manual', -- manual | openfoodfacts | openbeautyfacts | upcitemdb
  min_quantity int,                          -- for low-stock later (Phase 2)
  created_at   timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, barcode)
);

-- ---------------------------------------------------------------------
-- 4. Inventory items (how many we have, and where)
-- ---------------------------------------------------------------------
create table if not exists public.inventory_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  product_id   uuid not null,
  location_id  uuid not null,
  quantity     int  not null default 1 check (quantity >= 0),
  expires_on   date,                         -- Phase 2
  notes        text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) default auth.uid(),
  foreign key (product_id, household_id)
    references public.products(id, household_id) on delete cascade,
  foreign key (location_id, household_id)
    references public.locations(id, household_id) on delete cascade
);

create index if not exists inventory_items_product_idx  on public.inventory_items(product_id);
create index if not exists inventory_items_location_idx on public.inventory_items(location_id);
create index if not exists products_name_idx            on public.products(household_id, lower(name));

-- ---------------------------------------------------------------------
-- 5. Activity log (add / use / move / discard) — powers history + undo
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  product_id        uuid references public.products(id) on delete set null,
  type              text not null check (type in ('add', 'use', 'move', 'discard', 'edit')),
  delta             int,
  user_id           uuid references auth.users(id) default auth.uid(),
  at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Shared barcode cache (filled by the lookup function, read by all)
-- ---------------------------------------------------------------------
create table if not exists public.barcode_cache (
  barcode     text primary key,
  name        text,
  brand       text,
  category    text,
  image_url   text,
  size        text,
  source      text not null,
  raw         jsonb,
  fetched_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Keep updated_at current
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists inventory_items_touch on public.inventory_items;
create trigger inventory_items_touch
  before update on public.inventory_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 8. Membership helper + household functions
-- ---------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- Create a household and make the caller its owner. Returns the new id.
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.households(name) values (p_name) returning id into hid;
  insert into public.household_members(household_id, user_id, role)
    values (hid, auth.uid(), 'owner');
  return hid;
end $$;

-- Join an existing household with its invite code. Returns the household id.
create or replace function public.join_household(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into hid from public.households where invite_code = trim(p_code);
  if hid is null then
    raise exception 'Invite code not found';
  end if;
  insert into public.household_members(household_id, user_id)
    values (hid, auth.uid())
    on conflict do nothing;
  return hid;
end $$;

revoke execute on function public.create_household(text) from anon;
revoke execute on function public.join_household(text)   from anon;

-- ---------------------------------------------------------------------
-- 9. Row-level security: you only ever see your own household's data
-- ---------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.rooms             enable row level security;
alter table public.locations         enable row level security;
alter table public.products          enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.events            enable row level security;
alter table public.barcode_cache     enable row level security;

-- households: members can read and rename; creation goes through create_household()
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- household_members: see fellow members; leave a household yourself
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists members_leave on public.household_members;
create policy members_leave on public.household_members
  for delete to authenticated using (user_id = auth.uid());

-- rooms, locations, products, inventory_items, events: full access for members
do $$
declare t text;
begin
  foreach t in array array['rooms', 'locations', 'products', 'inventory_items', 'events'] loop
    execute format('drop policy if exists %I_member_all on public.%I', t, t);
    execute format(
      'create policy %I_member_all on public.%I for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))', t, t);
  end loop;
end $$;

-- barcode_cache: any signed-in user can read; only the lookup function
-- (running with the service role, which bypasses RLS) writes to it
drop policy if exists barcode_cache_read on public.barcode_cache;
create policy barcode_cache_read on public.barcode_cache
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 10. Realtime: push changes to both phones live
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['rooms', 'locations', 'products', 'inventory_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Done. Rooms and locations get seeded from the app after you create
-- your household, so nothing is hard-coded here.
