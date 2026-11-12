import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const publicPost = '10000000-0000-4000-8000-000000000001';
const privateChannelPost = '10000000-0000-4000-8000-000000000004';
const publicPath = B + '/' + publicPost + '/public.jpg';
const privatePath = B + '/' + privateChannelPost + '/private.jpg';

async function count(table) {
  return (await db.query('select count(*)::int as n from ' + table)).rows[0].n;
}

try {
  await db.exec([
    'create role anon;',
    'create role authenticated;',
    'create schema auth;',
    'create table auth.users(id uuid primary key, raw_user_meta_data jsonb);',
    "create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';",
    'create schema storage;',
    'grant usage on schema storage to authenticated;',
    'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
    'create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id uuid);',
    "create function storage.foldername(name text) returns text[] language sql immutable as 'select string_to_array(name,''/'')';",
    'alter table storage.objects enable row level security;',
    'grant select,insert,update,delete on storage.objects to authenticated;'
  ].join('\n'));

  const migration = fs.readFileSync('supabase/migrations/202611120001_initial_schema.sql','utf8')
    .replace('create extension if not exists pgcrypto;','');
  await db.exec(migration);

  await db.exec([
    "insert into auth.users values ('" + A + "','{}'),('" + B + "','{}'),('" + C + "','{}');",
    "update public.profiles set visibility='public' where id='" + B + "';",
    "update public.profiles set visibility='private' where id='" + C + "';",
    "insert into public.channels(id,owner_id,title,slug,visibility) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','" + B + "','Open channel','open-channel','public'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','" + B + "','Locked channel','locked-channel','private');",
    "insert into public.posts(id,author_id,body,visibility) values ('" + publicPost + "','" + B + "','Public post','public'),('10000000-0000-4000-8000-000000000002','" + B + "','Followers post','followers'),('10000000-0000-4000-8000-000000000003','" + C + "','Private profile post','public');",
    "insert into public.posts(id,author_id,channel_id,body,visibility) values ('" + privateChannelPost + "','" + B + "','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Private channel post','public'),('10000000-0000-4000-8000-000000000005','" + B + "','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Public channel post','public');",
    "insert into public.post_media(post_id,storage_path,media_type) values ('" + publicPost + "','" + publicPath + "','image'),('" + privateChannelPost + "','" + privatePath + "','image');",
    "insert into public.comments(post_id,author_id,body) values ('" + privateChannelPost + "','" + B + "','Private channel comment');",
    "insert into public.conversations(id,created_by) values ('40000000-0000-4000-8000-000000000001','" + B + "'),('40000000-0000-4000-8000-000000000002','" + B + "');",
    "insert into public.conversation_members(conversation_id,user_id) values ('40000000-0000-4000-8000-000000000001','" + B + "'),('40000000-0000-4000-8000-000000000001','" + C + "'),('40000000-0000-4000-8000-000000000002','" + B + "'),('40000000-0000-4000-8000-000000000002','" + A + "');",
    "insert into public.messages(conversation_id,sender_id,body) values ('40000000-0000-4000-8000-000000000001','" + B + "','Secret message');",
    "insert into public.notifications(user_id,kind) values ('" + B + "','system');",
    "insert into public.shops(id,owner_id,title,slug,visibility) values ('50000000-0000-4000-8000-000000000001','" + B + "','Private shop','private-shop','private'),('50000000-0000-4000-8000-000000000002','" + B + "','Public shop','public-shop','public');",
    "insert into public.products(shop_id,title,price,status) values ('50000000-0000-4000-8000-000000000001','Secret product',100,'published'),('50000000-0000-4000-8000-000000000002','Public product',100,'published');",
    "insert into storage.objects(bucket_id,name) values ('nexus-media','" + A + "/draft.jpg'),('nexus-media','" + publicPath + "'),('nexus-media','" + privatePath + "');"
  ].join('\n'));

  await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','" + A + "',false);");
  const visiblePosts = (await db.query('select id from public.posts order by id')).rows.map(row => row.id);
  assert.deepEqual(visiblePosts,[publicPost,'10000000-0000-4000-8000-000000000005']);
  assert.equal(await count('public.profiles'),2,'private profiles stay hidden');
  assert.equal(await count('public.post_media'),1,'media inherits post visibility');
  assert.equal(await count('public.comments'),0,'comments on hidden posts stay hidden');
  assert.equal(await count('public.messages'),0,'direct messages are member-only');
  assert.equal(await count('public.notifications'),0,'notifications are recipient-only');
  assert.equal(await count('public.shops'),1,'private shops stay hidden');
  assert.equal(await count('public.products'),1,'private shop products stay hidden');
  assert.equal(await count('storage.objects'),2,'own drafts and authorized public media are readable');

  await db.query("insert into public.follows(follower_id,followed_id,status) values ('" + A + "','" + C + "','pending')");
  assert.equal((await db.query("select count(*)::int as n from public.profiles where id='" + C + "'")).rows[0].n,0,'pending follow does not unlock private profile');
  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + C + "',false);");
  await db.query("update public.follows set status='accepted' where follower_id='" + A + "' and followed_id='" + C + "'");
  await assert.rejects(
    db.query("update public.follows set follower_id='" + B + "' where follower_id='" + A + "' and followed_id='" + C + "'"),
    /Follow identity cannot be changed/
  );
  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + A + "',false);");
  assert.equal((await db.query("select count(*)::int as n from public.profiles where id='" + C + "'")).rows[0].n,1,'accepted follow unlocks private profile');

  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + B + "',false);");
  await assert.rejects(
    db.query("update public.messages set conversation_id='40000000-0000-4000-8000-000000000002' where body='Secret message'"),
    /Message identity cannot be changed/
  );
  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + A + "',false);");

  await db.exec("insert into public.blocks(blocker_id,blocked_id) values ('" + A + "','" + B + "');");
  assert.equal((await db.query("select count(*)::int as n from public.posts where author_id='" + B + "'")).rows[0].n,0,'blocks hide the other user posts');
  assert.equal(await count('storage.objects'),1,'blocks also hide that users media');

  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from public.profiles'),/permission denied/);
  await db.exec('reset role');
  console.log('Nexus RLS checks passed: profiles, posts, channels, media, shops, DMs, notifications, follows, immutable identities, blocks and anonymous access.');
} finally {
  await db.close();
}
