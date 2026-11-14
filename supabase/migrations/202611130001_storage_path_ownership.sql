-- Enforce ownership of every private storage path referenced by social records.
-- Without these checks, a user could attach another user's private object to their own
-- post/clip/story and make it readable through the parent record's RLS policy.

create or replace function private.owns_storage_path(target_path text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select target_path is null
    or split_part(target_path,'/',1)=(select auth.uid())::text
$$;

revoke all on function private.owns_storage_path(text) from public,anon;
grant execute on function private.owns_storage_path(text) to authenticated;

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
with check (
  id=(select auth.uid())
  and private.owns_storage_path(avatar_path)
  and private.owns_storage_path(cover_path)
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id=(select auth.uid()))
with check (
  id=(select auth.uid())
  and private.owns_storage_path(avatar_path)
  and private.owns_storage_path(cover_path)
);

drop policy if exists channels_insert_owner on public.channels;
create policy channels_insert_owner on public.channels for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and (organization_id is null or private.is_org_admin(organization_id))
  and private.owns_storage_path(avatar_path)
  and private.owns_storage_path(cover_path)
);

drop policy if exists channels_update_admin on public.channels;
create policy channels_update_admin on public.channels for update to authenticated
using (private.is_channel_admin(id))
with check (
  private.is_channel_admin(id)
  and private.owns_storage_path(avatar_path)
  and private.owns_storage_path(cover_path)
);

drop policy if exists shops_insert_owner on public.shops;
create policy shops_insert_owner on public.shops for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and (organization_id is null or private.is_org_admin(organization_id))
  and private.owns_storage_path(avatar_path)
);

drop policy if exists shops_update_owner on public.shops;
create policy shops_update_owner on public.shops for update to authenticated
using (owner_id=(select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)))
with check (
  (owner_id=(select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)))
  and private.owns_storage_path(avatar_path)
);

drop policy if exists products_insert_shop_admin on public.products;
create policy products_insert_shop_admin on public.products for insert to authenticated
with check (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
  and private.owns_storage_path(cover_path)
);

drop policy if exists products_update_shop_admin on public.products;
create policy products_update_shop_admin on public.products for update to authenticated
using (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
)
with check (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
  and private.owns_storage_path(cover_path)
);

drop policy if exists post_media_insert_author on public.post_media;
create policy post_media_insert_author on public.post_media for insert to authenticated
with check (
  exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()))
  and private.owns_storage_path(storage_path)
);

drop policy if exists story_media_insert_author on public.story_media;
create policy story_media_insert_author on public.story_media for insert to authenticated
with check (
  exists(select 1 from public.stories s where s.id=story_id and s.author_id=(select auth.uid()))
  and private.owns_storage_path(storage_path)
);

drop policy if exists clips_insert_author on public.clips;
create policy clips_insert_author on public.clips for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.owns_storage_path(storage_path)
  and private.owns_storage_path(poster_path)
);

drop policy if exists clips_update_author on public.clips;
create policy clips_update_author on public.clips for update to authenticated
using (author_id=(select auth.uid()))
with check (
  author_id=(select auth.uid())
  and private.owns_storage_path(storage_path)
  and private.owns_storage_path(poster_path)
);
