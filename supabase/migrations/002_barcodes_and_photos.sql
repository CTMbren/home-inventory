-- =====================================================================
-- Phase 2 update: barcode matching + custom product photos
-- Run once in Supabase: SQL Editor → New query → paste → Run
-- Safe to re-run.
-- =====================================================================

-- 1. Custom photo per product (used instead of the looked-up image)
alter table public.products add column if not exists custom_image_url text;

-- 2. Store 12-digit UPC-A codes in their 13-digit EAN form, which is how the
--    app now saves them. Skips any product whose 13-digit twin already exists
--    so nothing collides; the app matches both forms either way.
update public.products p
set barcode = '0' || p.barcode
where p.barcode ~ '^\d{12}$'
  and not exists (
    select 1 from public.products q
    where q.household_id = p.household_id and q.barcode = '0' || p.barcode
  );

-- 3. Storage bucket for product photos.
--    Public read (an unguessable link per photo), max 2 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4. Only members of a household can add, replace or delete files in that
--    household's folder (<household id>/...).
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.household_members where user_id = auth.uid()
    )
  );

drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.household_members where user_id = auth.uid()
    )
  );

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.household_members where user_id = auth.uid()
    )
  );
