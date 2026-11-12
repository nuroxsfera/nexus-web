-- Nexus v1: privacy-first relational foundation.
-- Apply with Supabase CLI after linking a project. Never put service-role keys in the browser.

create extension if not exists pgcrypto;

do $$ begin
  create type public.profile_visibility as enum ('public','followers','private');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.content_visibility as enum ('public','followers','private');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.follow_status as enum ('pending','accepted','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.channel_visibility as enum ('public','private');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.shop_visibility as enum ('public','private');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.product_status as enum ('draft','published','archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_role as enum ('owner','admin','moderator','member');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.report_status as enum ('open','reviewing','resolved','dismissed');
exception when duplicate_object then null; end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default 'Новый пользователь' check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  cover_path text,
  visibility public.profile_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  status public.follow_status not null default 'accepted',
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null check (char_length(title) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  description text not null default '' check (char_length(description) <= 500),
  visibility public.channel_visibility not null default 'public',
  avatar_path text,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null check (char_length(title) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  description text not null default '' check (char_length(description) <= 500),
  visibility public.shop_visibility not null default 'public',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'RUB',
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  status public.product_status not null default 'draft',
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  body text not null default '' check (char_length(body) <= 5000),
  visibility public.content_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) > 0 or channel_id is not null)
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  width integer,
  height integer,
  duration_ms integer,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  visibility public.content_visibility not null default 'followers',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table if not exists public.story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'image' check (media_type in ('image','video')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text check (title is null or char_length(title) between 1 and 80),
  is_group boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('follow','like','comment','mention','message','channel','shop','system')),
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','post','comment','channel','shop','product','message')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists follows_followed_status_idx on public.follows(followed_id,status);
create index if not exists posts_author_created_idx on public.posts(author_id,created_at desc);
create index if not exists posts_channel_created_idx on public.posts(channel_id,created_at desc);
create index if not exists posts_visibility_created_idx on public.posts(visibility,created_at desc);
create index if not exists post_media_post_sort_idx on public.post_media(post_id,sort_order);
create index if not exists stories_author_expiry_idx on public.stories(author_id,expires_at desc);
create index if not exists comments_post_created_idx on public.comments(post_id,created_at);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
create index if not exists products_shop_status_idx on public.products(shop_id,status);

create or replace function private.is_blocked_between(user_a uuid,user_b uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.blocks b where (b.blocker_id=user_a and b.blocked_id=user_b) or (b.blocker_id=user_b and b.blocked_id=user_a)) $$;

create or replace function private.is_following(target_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.followed_id=target_user and f.status='accepted') $$;

create or replace function private.can_view_profile(target_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=target_user
      and (p.id=(select auth.uid()) or (
        not private.is_blocked_between((select auth.uid()),p.id)
        and (p.visibility='public' or (p.visibility='followers' and private.is_following(p.id)))
      ))
  )
$$;

create or replace function private.can_view_post(target_author uuid,target_visibility public.content_visibility)
returns boolean language sql stable security definer set search_path=''
as $$
  select target_author=(select auth.uid()) or (
    not private.is_blocked_between((select auth.uid()),target_author)
    and private.can_view_profile(target_author)
    and (target_visibility='public' or (target_visibility='followers' and private.is_following(target_author)))
  )
$$;

create or replace function private.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.organization_members m where m.organization_id=target_org and m.user_id=(select auth.uid())) $$;

create or replace function private.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.organization_members m where m.organization_id=target_org and m.user_id=(select auth.uid()) and m.role in ('owner','admin')) or exists(select 1 from public.organizations o where o.id=target_org and o.owner_id=(select auth.uid())) $$;

create or replace function private.is_channel_member(target_channel uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.channel_members m where m.channel_id=target_channel and m.user_id=(select auth.uid())) or exists(select 1 from public.channels c where c.id=target_channel and c.owner_id=(select auth.uid())) $$;

create or replace function private.is_channel_admin(target_channel uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.channel_members m where m.channel_id=target_channel and m.user_id=(select auth.uid()) and m.role in ('owner','admin','moderator')) or exists(select 1 from public.channels c where c.id=target_channel and c.owner_id=(select auth.uid())) $$;

create or replace function private.can_view_post_record(target_post uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.posts p
    where p.id=target_post
      and private.can_view_post(p.author_id,p.visibility)
      and (p.channel_id is null or exists(
        select 1 from public.channels c
        where c.id=p.channel_id and (c.visibility='public' or private.is_channel_member(c.id))
      ))
  )
$$;

create or replace function private.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.conversation_members m where m.conversation_id=target_conversation and m.user_id=(select auth.uid())) $$;

create or replace function private.can_view_shop(target_shop uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.shops s where s.id=target_shop and (
    s.owner_id=(select auth.uid()) or (s.visibility='public' and not private.is_blocked_between((select auth.uid()),s.owner_id))
    or (s.organization_id is not null and private.is_org_member(s.organization_id))
  ))
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=''
as $$ begin new.updated_at=now(); return new; end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists channels_set_updated_at on public.channels;
create trigger channels_set_updated_at before update on public.channels for each row execute function public.set_updated_at();
drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at before update on public.shops for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.profiles(id,username,display_name)
  values(new.id,'u_'||replace(substr(new.id::text,1,12),'-',''),left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Новый пользователь'),60))
  on conflict (id) do nothing;
  return new;
end
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Every exposed application table is protected. Signed-out users get no table grants.
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.stories enable row level security;
alter table public.story_media enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select,insert,update,delete on public.profiles,public.follows,public.blocks,public.organizations,public.organization_members,public.channels,public.channel_members,public.shops,public.products,public.posts,public.post_media,public.stories,public.story_media,public.comments,public.post_likes,public.conversations,public.conversation_members,public.messages,public.notifications,public.reports to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (private.can_view_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create policy follows_read_participants on public.follows for select to authenticated using (follower_id=(select auth.uid()) or followed_id=(select auth.uid()));
create policy follows_insert_self on public.follows for insert to authenticated with check (follower_id=(select auth.uid()) and not private.is_blocked_between(follower_id,followed_id));
create policy follows_update_recipient on public.follows for update to authenticated using (followed_id=(select auth.uid())) with check (followed_id=(select auth.uid()) and status in ('accepted','rejected'));
create policy follows_delete_participant on public.follows for delete to authenticated using (follower_id=(select auth.uid()) or followed_id=(select auth.uid()));

create policy blocks_read_owner on public.blocks for select to authenticated using (blocker_id=(select auth.uid()));
create policy blocks_insert_owner on public.blocks for insert to authenticated with check (blocker_id=(select auth.uid()));
create policy blocks_delete_owner on public.blocks for delete to authenticated using (blocker_id=(select auth.uid()));

create policy organizations_read_members on public.organizations for select to authenticated using (owner_id=(select auth.uid()) or private.is_org_member(id));
create policy organizations_insert_owner on public.organizations for insert to authenticated with check (owner_id=(select auth.uid()));
create policy organizations_update_owner on public.organizations for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy organizations_delete_owner on public.organizations for delete to authenticated using (owner_id=(select auth.uid()));

create policy organization_members_read_members on public.organization_members for select to authenticated using (user_id=(select auth.uid()) or private.is_org_member(organization_id));
create policy organization_members_insert_admin on public.organization_members for insert to authenticated with check (private.is_org_admin(organization_id));
create policy organization_members_update_admin on public.organization_members for update to authenticated using (private.is_org_admin(organization_id)) with check (private.is_org_admin(organization_id));
create policy organization_members_delete_admin_or_self on public.organization_members for delete to authenticated using (private.is_org_admin(organization_id) or user_id=(select auth.uid()));

create policy channels_read_accessible on public.channels for select to authenticated using (visibility='public' or owner_id=(select auth.uid()) or private.is_channel_member(id));
create policy channels_insert_owner on public.channels for insert to authenticated with check (owner_id=(select auth.uid()) and (organization_id is null or private.is_org_admin(organization_id)));
create policy channels_update_admin on public.channels for update to authenticated using (private.is_channel_admin(id)) with check (private.is_channel_admin(id));
create policy channels_delete_owner on public.channels for delete to authenticated using (owner_id=(select auth.uid()));

create policy channel_members_read_members on public.channel_members for select to authenticated using (user_id=(select auth.uid()) or private.is_channel_member(channel_id));
create policy channel_members_insert_allowed on public.channel_members for insert to authenticated with check (
  (user_id=(select auth.uid()) and exists(select 1 from public.channels c where c.id=channel_id and c.visibility='public'))
  or private.is_channel_admin(channel_id)
);
create policy channel_members_update_admin on public.channel_members for update to authenticated using (private.is_channel_admin(channel_id)) with check (private.is_channel_admin(channel_id));
create policy channel_members_delete_self_or_admin on public.channel_members for delete to authenticated using (user_id=(select auth.uid()) or private.is_channel_admin(channel_id));

create policy shops_read_accessible on public.shops for select to authenticated using (private.can_view_shop(id));
create policy shops_insert_owner on public.shops for insert to authenticated with check (owner_id=(select auth.uid()) and (organization_id is null or private.is_org_admin(organization_id)));
create policy shops_update_owner on public.shops for update to authenticated using (owner_id=(select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id))) with check (owner_id=(select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)));
create policy shops_delete_owner on public.shops for delete to authenticated using (owner_id=(select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)));

create policy products_read_published on public.products for select to authenticated using (
  status='published' and private.can_view_shop(shop_id)
  or exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
);
create policy products_insert_shop_admin on public.products for insert to authenticated with check (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
);
create policy products_update_shop_admin on public.products for update to authenticated using (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
) with check (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
);
create policy products_delete_shop_admin on public.products for delete to authenticated using (
  exists(select 1 from public.shops s where s.id=shop_id and (s.owner_id=(select auth.uid()) or (s.organization_id is not null and private.is_org_admin(s.organization_id))))
);

create policy posts_read_accessible on public.posts for select to authenticated using (private.can_view_post_record(id));
create policy posts_insert_author on public.posts for insert to authenticated with check (
  author_id=(select auth.uid()) and (channel_id is null or private.is_channel_admin(channel_id))
);
create policy posts_update_author on public.posts for update to authenticated using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));
create policy posts_delete_author on public.posts for delete to authenticated using (author_id=(select auth.uid()));

create policy post_media_read_accessible on public.post_media for select to authenticated using (
  private.can_view_post_record(post_id)
);
create policy post_media_insert_author on public.post_media for insert to authenticated with check (
  exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()))
);
create policy post_media_delete_author on public.post_media for delete to authenticated using (
  exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()))
);

create policy stories_read_accessible on public.stories for select to authenticated using (
  author_id=(select auth.uid()) or (expires_at>now() and private.can_view_profile(author_id)
  and (visibility='public' or (visibility='followers' and private.is_following(author_id))))
);
create policy stories_insert_author on public.stories for insert to authenticated with check (author_id=(select auth.uid()));
create policy stories_update_author on public.stories for update to authenticated using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));
create policy stories_delete_author on public.stories for delete to authenticated using (author_id=(select auth.uid()));

create policy story_media_read_accessible on public.story_media for select to authenticated using (
  exists(select 1 from public.stories s where s.id=story_id and (
    s.author_id=(select auth.uid()) or (s.expires_at>now() and private.can_view_profile(s.author_id)
    and (s.visibility='public' or (s.visibility='followers' and private.is_following(s.author_id))))
  ))
);
create policy story_media_insert_author on public.story_media for insert to authenticated with check (
  exists(select 1 from public.stories s where s.id=story_id and s.author_id=(select auth.uid()))
);
create policy story_media_delete_author on public.story_media for delete to authenticated using (
  exists(select 1 from public.stories s where s.id=story_id and s.author_id=(select auth.uid()))
);

create policy comments_read_accessible on public.comments for select to authenticated using (
  private.can_view_post_record(post_id)
);
create policy comments_insert_author on public.comments for insert to authenticated with check (
  author_id=(select auth.uid()) and private.can_view_post_record(post_id)
);
create policy comments_delete_author on public.comments for delete to authenticated using (
  author_id=(select auth.uid()) or exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()))
);

create policy post_likes_read_accessible on public.post_likes for select to authenticated using (
  private.can_view_post_record(post_id)
);
create policy post_likes_insert_self on public.post_likes for insert to authenticated with check (
  user_id=(select auth.uid()) and private.can_view_post_record(post_id)
);
create policy post_likes_delete_self on public.post_likes for delete to authenticated using (user_id=(select auth.uid()));

create policy conversations_read_members on public.conversations for select to authenticated using (private.is_conversation_member(id) or created_by=(select auth.uid()));
create policy conversations_insert_creator on public.conversations for insert to authenticated with check (created_by=(select auth.uid()));
create policy conversations_delete_creator on public.conversations for delete to authenticated using (created_by=(select auth.uid()));

create policy conversation_members_read_members on public.conversation_members for select to authenticated using (user_id=(select auth.uid()) or private.is_conversation_member(conversation_id));
create policy conversation_members_insert_creator_or_self on public.conversation_members for insert to authenticated with check (
  exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=(select auth.uid()))
);
create policy conversation_members_delete_self_or_creator on public.conversation_members for delete to authenticated using (
  user_id=(select auth.uid()) or exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=(select auth.uid()))
);

create policy messages_read_members on public.messages for select to authenticated using (private.is_conversation_member(conversation_id));
create policy messages_insert_member on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id));
create policy messages_update_sender on public.messages for update to authenticated using (sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id)) with check (sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id));
create policy messages_delete_sender on public.messages for delete to authenticated using (sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id));

create policy notifications_read_owner on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy notifications_update_owner on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy reports_insert_reporter on public.reports for insert to authenticated with check (reporter_id=(select auth.uid()));
create policy reports_read_reporter on public.reports for select to authenticated using (reporter_id=(select auth.uid()));

-- Private media buckets: no public listing or anonymous reads. Cross-user delivery will use
-- short-lived signed URLs only after server-side authorization checks.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('nexus-avatars','nexus-avatars',false,20971520,array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']),
  ('nexus-media','nexus-media',false,52428800,array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','video/mp4','video/quicktime'])
on conflict (id) do nothing;

drop policy if exists nexus_media_upload_own on storage.objects;
create policy nexus_media_upload_own on storage.objects for insert to authenticated
with check (bucket_id in ('nexus-avatars','nexus-media') and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists nexus_media_read_own on storage.objects;
create policy nexus_media_read_own on storage.objects for select to authenticated
using (bucket_id in ('nexus-avatars','nexus-media') and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists nexus_media_update_own on storage.objects;
create policy nexus_media_update_own on storage.objects for update to authenticated
using (bucket_id in ('nexus-avatars','nexus-media') and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id in ('nexus-avatars','nexus-media') and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists nexus_media_delete_own on storage.objects;
create policy nexus_media_delete_own on storage.objects for delete to authenticated
using (bucket_id in ('nexus-avatars','nexus-media') and (storage.foldername(name))[1]=(select auth.uid())::text);

revoke all on function private.is_blocked_between(uuid,uuid) from public,anon;
revoke all on function private.is_following(uuid) from public,anon;
revoke all on function private.can_view_profile(uuid) from public,anon;
revoke all on function private.can_view_post(uuid,public.content_visibility) from public,anon;
revoke all on function private.can_view_post_record(uuid) from public,anon;
revoke all on function private.is_org_member(uuid) from public,anon;
revoke all on function private.is_org_admin(uuid) from public,anon;
revoke all on function private.is_channel_member(uuid) from public,anon;
revoke all on function private.is_channel_admin(uuid) from public,anon;
revoke all on function private.is_conversation_member(uuid) from public,anon;
revoke all on function private.can_view_shop(uuid) from public,anon;
grant execute on function private.is_blocked_between(uuid,uuid) to authenticated;
grant execute on function private.is_following(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.can_view_post(uuid,public.content_visibility) to authenticated;
grant execute on function private.can_view_post_record(uuid) to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.is_channel_member(uuid) to authenticated;
grant execute on function private.is_channel_admin(uuid) to authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.can_view_shop(uuid) to authenticated;
