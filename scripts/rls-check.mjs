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
const publicClipPath = B + '/60000000-0000-4000-8000-000000000001/video.mp4';
const followerClipPath = C + '/60000000-0000-4000-8000-000000000002/video.mp4';

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
  await db.exec(fs.readFileSync('supabase/migrations/202611130001_storage_path_ownership.sql','utf8'));

  await db.exec([
    "insert into auth.users values ('" + A + "','{}'),('" + B + "','{}'),('" + C + "','{}');",
    "update public.profiles set visibility='public' where id='" + B + "';",
    "update public.profiles set visibility='followers' where id='" + C + "';",
    "insert into public.channels(id,owner_id,title,slug,visibility) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','" + B + "','Open channel','open-channel','public'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','" + B + "','Locked channel','locked-channel','private');",
    "insert into public.posts(id,author_id,body,visibility) values ('" + publicPost + "','" + B + "','Public post','public'),('10000000-0000-4000-8000-000000000002','" + B + "','Followers post','followers'),('10000000-0000-4000-8000-000000000003','" + C + "','Private profile post','public');",
    "insert into public.posts(id,author_id,channel_id,body,visibility) values ('" + privateChannelPost + "','" + B + "','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Private channel post','public'),('10000000-0000-4000-8000-000000000005','" + B + "','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Public channel post','public');",
    "insert into public.clips(id,author_id,caption,storage_path,visibility) values ('60000000-0000-4000-8000-000000000001','" + B + "','Public clip','" + publicClipPath + "','public'),('60000000-0000-4000-8000-000000000002','" + C + "','Followers-only clip','" + followerClipPath + "','followers');",
    "insert into public.clip_likes(clip_id,user_id) values ('60000000-0000-4000-8000-000000000001','" + B + "'),('60000000-0000-4000-8000-000000000002','" + C + "');",
    "insert into public.post_media(post_id,storage_path,media_type) values ('" + publicPost + "','" + publicPath + "','image'),('" + privateChannelPost + "','" + privatePath + "','image');",
    "insert into public.comments(post_id,author_id,body) values ('" + privateChannelPost + "','" + B + "','Private channel comment');",
    "insert into public.conversations(id,created_by) values ('40000000-0000-4000-8000-000000000001','" + B + "'),('40000000-0000-4000-8000-000000000002','" + B + "');",
    "insert into public.conversation_members(conversation_id,user_id) values ('40000000-0000-4000-8000-000000000001','" + B + "'),('40000000-0000-4000-8000-000000000001','" + C + "'),('40000000-0000-4000-8000-000000000002','" + B + "'),('40000000-0000-4000-8000-000000000002','" + A + "');",
    "insert into public.messages(conversation_id,sender_id,body) values ('40000000-0000-4000-8000-000000000001','" + B + "','Secret message');",
    "insert into public.notifications(user_id,kind) values ('" + B + "','system');",
    "insert into public.fitness_profiles(user_id,height_cm,weight_kg,goal) values ('" + B + "',180,75,'Strength');",
    "insert into public.workout_sessions(user_id,workout_type,duration_minutes) values ('" + B + "','Strength training',60);",
    "insert into public.nutrition_entries(user_id,food_name,serving_grams,calories_kcal) values ('" + B + "','Oatmeal',100,370);",
    "insert into public.health_measurements(user_id,metric,value,unit) values ('" + B + "','resting_heart_rate',62,'bpm');",
    "insert into storage.objects(bucket_id,name) values ('nexus-health','" + B + "/reports/lab.pdf');",
    "insert into public.shops(id,owner_id,title,slug,visibility) values ('50000000-0000-4000-8000-000000000001','" + B + "','Private shop','private-shop','private'),('50000000-0000-4000-8000-000000000002','" + B + "','Public shop','public-shop','public');",
    "insert into public.playlists(id,owner_id,title,visibility) values ('70000000-0000-4000-8000-000000000001','" + B + "','Public mix','public'),('70000000-0000-4000-8000-000000000002','" + B + "','Private mix','private');",
    "insert into public.playlist_tracks(playlist_id,title,artist,provider,provider_url) values ('70000000-0000-4000-8000-000000000001','Track A','Artist A','spotify','https://open.spotify.com/track/example'),('70000000-0000-4000-8000-000000000002','Secret track','Artist B','apple_music','https://music.apple.com/track/example');",
    "insert into public.watchlists(id,owner_id,title,visibility) values ('71000000-0000-4000-8000-000000000001','" + B + "','Public watchlist','public'),('71000000-0000-4000-8000-000000000002','" + B + "','Private watchlist','private');",
    "insert into public.watchlist_items(watchlist_id,title,media_type,provider,provider_url) values ('71000000-0000-4000-8000-000000000001','Example film','movie','kinopoisk','https://www.kinopoisk.ru/film/1/'),('71000000-0000-4000-8000-000000000002','Private series','series','ivi','https://www.ivi.ru/watch/example');",

    "insert into public.organizations(id,owner_id,name,slug) values ('72000000-0000-4000-8000-000000000001','" + B + "','Nexus Org','nexus-org-test');",
    "update public.channels set organization_id='72000000-0000-4000-8000-000000000001' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';",
    "update public.shops set organization_id='72000000-0000-4000-8000-000000000001' where id='50000000-0000-4000-8000-000000000002';",
    "insert into public.spaces(id,organization_id,created_by,title,slug,space_type,visibility) values ('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','" + B + "','Public community','public-community','community','public'),('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','" + B + "','Private team','private-team','team','private');",
    "insert into public.space_links(space_id,link_type,channel_id) values ('73000000-0000-4000-8000-000000000001','channel','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');",
    "insert into public.space_links(space_id,link_type,shop_id) values ('73000000-0000-4000-8000-000000000002','shop','50000000-0000-4000-8000-000000000002');",
    "insert into public.products(shop_id,title,price,status) values ('50000000-0000-4000-8000-000000000001','Secret product',100,'published'),('50000000-0000-4000-8000-000000000002','Public product',100,'published');",
    "insert into storage.objects(bucket_id,name) values ('nexus-media','" + A + "/draft.jpg'),('nexus-media','" + publicPath + "'),('nexus-media','" + privatePath + "'),('nexus-media','" + publicClipPath + "'),('nexus-media','" + followerClipPath + "');"
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
  assert.equal(await count('public.spaces'),1,'only public organization spaces are visible');
  assert.equal(await count('public.space_links'),1,'space links inherit parent visibility');
  assert.equal(await count('public.playlists'),1,'private playlists stay hidden');
  assert.equal(await count('public.playlist_tracks'),1,'playlist tracks inherit visibility');
  assert.equal(await count('public.watchlists'),1,'private watchlists stay hidden');
  assert.equal(await count('public.watchlist_items'),1,'watchlist items inherit visibility');
  assert.equal(await count('public.fitness_profiles'),0,'fitness profiles are owner-only');
  assert.equal(await count('public.workout_sessions'),0,'workout history is owner-only');
  assert.equal(await count('public.nutrition_entries'),0,'nutrition entries are owner-only');
  assert.equal(await count('public.health_measurements'),0,'health measurements are owner-only');
  assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='nexus-health'")).rows[0].n,0,'health files are owner-only');
  assert.equal(await count('public.clips'),1,'public clips are visible');
  assert.equal(await count('public.clip_likes'),1,'likes on visible clips are visible');
  assert.equal(await count('storage.objects'),3,'own drafts and authorized public media are readable');

  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + B + "',false);");
  assert.equal(await count('public.fitness_profiles'),1,'owner can read fitness profile');
  assert.equal(await count('public.workout_sessions'),1,'owner can read workout history');
  assert.equal(await count('public.nutrition_entries'),1,'owner can read nutrition entries');
  assert.equal(await count('public.health_measurements'),1,'owner can read health measurements');
  assert.equal(await count('public.spaces'),2,'organization owner can read private spaces');
  assert.equal(await count('public.space_links'),2,'organization owner can read private space links');
  assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='nexus-health'")).rows[0].n,1,'owner can read private health files');
  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + A + "',false);");

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
  assert.equal(await count('public.clips'),2,'accepted follow unlocks followers-only clips');
  assert.equal(await count('public.clip_likes'),2,'accepted follow unlocks likes on followers-only clips');
  assert.equal(await count('storage.objects'),4,'accepted follow unlocks followers-only clip media');

  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + B + "',false);");
  await assert.rejects(
    db.query("update public.messages set conversation_id='40000000-0000-4000-8000-000000000002' where body='Secret message'"),
    /Message identity cannot be changed/
  );
  await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.sub','" + A + "',false);");

  // A must never be able to attach B's private object to an A-owned record.
  await assert.rejects(
    db.query("update public.profiles set avatar_path='" + B + "/avatar.jpg' where id='" + A + "'"),
    /row-level security/
  );
  await db.query("insert into public.posts(id,author_id,body) values ('10000000-0000-4000-8000-000000000099','" + A + "','Owned test post')");
  await assert.rejects(
    db.query("insert into public.post_media(post_id,storage_path,media_type) values ('10000000-0000-4000-8000-000000000099','" + B + "/private/borrowed.jpg','image')"),
    /row-level security/
  );
  await db.query("insert into public.stories(id,author_id) values ('80000000-0000-4000-8000-000000000001','" + A + "')");
  await assert.rejects(
    db.query("insert into public.story_media(story_id,storage_path) values ('80000000-0000-4000-8000-000000000001','" + B + "/private/story.jpg')"),
    /row-level security/
  );
  await assert.rejects(
    db.query("insert into public.clips(author_id,caption,storage_path) values ('" + A + "','Borrowed clip','" + B + "/private/clip.mp4')"),
    /row-level security/
  );
  await assert.rejects(
    db.query("insert into public.channels(owner_id,title,slug,avatar_path) values ('" + A + "','Owned channel','owned-channel','" + B + "/private/channel.jpg')"),
    /row-level security/
  );
  await db.query("insert into public.shops(owner_id,title,slug) values ('" + A + "','Owned shop','owned-shop')");
  const ownedShop = (await db.query("select id from public.shops where slug='owned-shop'")).rows[0].id;
  await assert.rejects(
    db.query("insert into public.products(shop_id,title,price,cover_path) values ('" + ownedShop + "','Borrowed cover',100,'" + B + "/private/product.jpg')"),
    /row-level security/
  );
  await assert.rejects(
    db.query("insert into storage.objects(bucket_id,name) values ('nexus-media','" + B + "/private/forged-upload.jpg')"),
    /row-level security/
  );

  await db.exec("insert into public.blocks(blocker_id,blocked_id) values ('" + A + "','" + B + "');");
  assert.equal((await db.query("select count(*)::int as n from public.posts where author_id='" + B + "'")).rows[0].n,0,'blocks hide the other user posts');
  assert.equal((await db.query("select count(*)::int as n from public.clips where author_id='" + B + "'")).rows[0].n,0,'blocks hide the other user clips');
  assert.equal(await count('storage.objects'),2,'blocks also hide that users media while retaining followed media');

  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from public.profiles'),/permission denied/);
  await db.exec('reset role');
  console.log('Nexus RLS checks passed: profiles, posts, channels, organization spaces, clips, music playlists, watchlists, media, shops, DMs, notifications, owner-only health data, follows, immutable identities, blocks and anonymous access.');
} catch (error) {
  console.error('RLS check failed:', error?.message || error);
  process.exitCode = 1;
} finally {
  await db.close();
}
