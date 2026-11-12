begin;
select plan(45);

-- Fixtures are created as the database owner; all assertions below run as user A.
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','nexus-a@example.test','',now(),'{"provider":"email","providers":["email"]}','{"name":"Alice"}',now(),now()),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','nexus-b@example.test','',now(),'{"provider":"email","providers":["email"]}','{"name":"Bob"}',now(),now()),
('33333333-3333-4333-8333-333333333333','authenticated','authenticated','nexus-c@example.test','',now(),'{"provider":"email","providers":["email"]}','{"name":"Private"}',now(),now());

update public.profiles set visibility='public' where id='22222222-2222-4222-8222-222222222222';
update public.profiles set visibility='followers' where id='33333333-3333-4333-8333-333333333333';

insert into public.channels(id,owner_id,title,slug,visibility) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','Open channel','nexus-open-test','public'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Locked channel','nexus-locked-test','private');

insert into public.posts(id,author_id,body,visibility) values
('10000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Public post','public'),
('10000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Followers post','followers'),
('10000000-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','Private profile post','public');

insert into public.posts(id,author_id,channel_id,body,visibility) values
('10000000-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Private channel post','public');

insert into public.clips(id,author_id,caption,storage_path,visibility) values
('60000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Public clip','22222222-2222-4222-8222-222222222222/60000000-0000-4000-8000-000000000001/video.mp4','public'),
('60000000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','Followers-only clip','33333333-3333-4333-8333-333333333333/60000000-0000-4000-8000-000000000002/video.mp4','followers');

insert into public.clip_likes(clip_id,user_id) values ('60000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222'),('60000000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333');

insert into public.post_media(post_id,storage_path,media_type) values
('10000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000001/public.jpg','image'),
('10000000-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000004/private.jpg','image');

insert into storage.objects(bucket_id,name) values
('nexus-media','22222222-2222-4222-8222-222222222222/60000000-0000-4000-8000-000000000001/video.mp4'),
('nexus-media','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000001/public.jpg'),
('nexus-media','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000004/private.jpg');

insert into public.conversations(id,created_by) values ('40000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222'),('40000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222');
insert into public.conversation_members(conversation_id,user_id) values
('40000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222'),
('40000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333'),('40000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222'),('40000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111');
insert into public.messages(conversation_id,sender_id,body) values
('40000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Secret message');
insert into public.notifications(user_id,kind) values ('22222222-2222-4222-8222-222222222222','system');
insert into public.shops(id,owner_id,title,slug,visibility) values
('50000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Private shop','nexus-private-test','private'),
('50000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Public shop','nexus-public-test','public');

insert into public.organizations(id,owner_id,name,slug) values ('72000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Nexus Org','nexus-org-test');
update public.channels set organization_id='72000000-0000-4000-8000-000000000001' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.shops set organization_id='72000000-0000-4000-8000-000000000001' where id='50000000-0000-4000-8000-000000000002';
insert into public.spaces(id,organization_id,created_by,title,slug,space_type,visibility) values
('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Public community','public-community','community','public'),
('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Private team','private-team','team','private');
insert into public.space_links(space_id,link_type,channel_id) values ('73000000-0000-4000-8000-000000000001','channel','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.space_links(space_id,link_type,shop_id) values ('73000000-0000-4000-8000-000000000002','shop','50000000-0000-4000-8000-000000000002');

insert into public.playlists(id,owner_id,title,visibility) values
('70000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Public mix','public'),
('70000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Private mix','private');
insert into public.playlist_tracks(playlist_id,title,artist,provider,provider_url) values
('70000000-0000-4000-8000-000000000001','Track A','Artist A','spotify','https://open.spotify.com/track/example'),
('70000000-0000-4000-8000-000000000002','Secret track','Artist B','apple_music','https://music.apple.com/track/example');

insert into public.watchlists(id,owner_id,title,visibility) values
('71000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Public watchlist','public'),
('71000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Private watchlist','private');
insert into public.watchlist_items(watchlist_id,title,media_type,provider,provider_url) values
('71000000-0000-4000-8000-000000000001','Example film','movie','kinopoisk','https://www.kinopoisk.ru/film/1/'),
('71000000-0000-4000-8000-000000000002','Private series','series','ivi','https://www.ivi.ru/watch/example');

insert into public.fitness_profiles(user_id,height_cm,weight_kg,goal) values ('22222222-2222-4222-8222-222222222222',180,75,'Strength');
insert into public.workout_sessions(user_id,workout_type,duration_minutes) values ('22222222-2222-4222-8222-222222222222','Strength training',60);
insert into public.nutrition_entries(user_id,food_name,serving_grams,calories_kcal) values ('22222222-2222-4222-8222-222222222222','Oatmeal',100,370);
insert into public.health_measurements(user_id,metric,value,unit) values ('22222222-2222-4222-8222-222222222222','resting_heart_rate',62,'bpm');
insert into storage.objects(bucket_id,name) values ('nexus-health','22222222-2222-4222-8222-222222222222/reports/lab.pdf');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is((select count(*)::int from public.posts where id='10000000-0000-4000-8000-000000000001'),1,'public post is visible');
select is((select count(*)::int from public.posts where id='10000000-0000-4000-8000-000000000002'),0,'followers-only post is hidden from a non-follower');
select is((select count(*)::int from public.posts where id='10000000-0000-4000-8000-000000000003'),0,'private profile content is hidden');
select is((select count(*)::int from public.posts where id='10000000-0000-4000-8000-000000000004'),0,'private channel post is hidden');
select is((select count(*)::int from public.profiles where id='33333333-3333-4333-8333-333333333333'),0,'followers-only profile is hidden from non-followers');
insert into public.follows(follower_id,followed_id,status) values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','pending');
select is((select count(*)::int from public.profiles where id='33333333-3333-4333-8333-333333333333'),0,'pending follow does not unlock followers-only profile');
select is((select count(*)::int from public.post_media where post_id='10000000-0000-4000-8000-000000000004'),0,'private channel media is hidden');
select is((select count(*)::int from public.clips where id='60000000-0000-4000-8000-000000000001'),1,'public clip is visible');
select is((select count(*)::int from public.clips where id='60000000-0000-4000-8000-000000000002'),0,'followers-only clip is hidden from non-followers');
select is((select count(*)::int from public.clip_likes where clip_id='60000000-0000-4000-8000-000000000002'),0,'likes on hidden clips are hidden');
select is((select count(*)::int from storage.objects where name='22222222-2222-4222-8222-222222222222/60000000-0000-4000-8000-000000000001/video.mp4'),1,'public clip video is readable');
select is((select count(*)::int from storage.objects where name='22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000001/public.jpg'),1,'public post media can be read');
select is((select count(*)::int from storage.objects where name='22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000004/private.jpg'),0,'private channel media cannot be read');
select is((select count(*)::int from public.messages),0,'direct messages are hidden from non-members');
select is((select count(*)::int from public.notifications),0,'notifications are private to their recipient');
select is((select count(*)::int from public.shops),1,'private shops are hidden and public shops are visible');
select is((select count(*)::int from public.spaces),1,'only public spaces are visible');
select is((select count(*)::int from public.space_links),1,'space links inherit parent space visibility');
select is((select count(*)::int from public.spaces where id='73000000-0000-4000-8000-000000000002'),0,'private organization spaces are hidden');
select is((select count(*)::int from public.space_links where space_id='73000000-0000-4000-8000-000000000002'),0,'links in private spaces are hidden');

select is((select count(*)::int from public.playlists),1,'only public playlists are visible');
select is((select count(*)::int from public.playlist_tracks),1,'tracks inherit playlist visibility');
select is((select count(*)::int from public.watchlists),1,'only public watchlists are visible');
select is((select count(*)::int from public.watchlist_items),1,'watchlist items inherit parent visibility');
select is((select count(*)::int from public.playlists where id='70000000-0000-4000-8000-000000000002'),0,'private playlists are hidden');
select is((select count(*)::int from public.playlist_tracks where title='Secret track'),0,'private tracks are hidden');
select is((select count(*)::int from public.watchlists where id='71000000-0000-4000-8000-000000000002'),0,'private watchlists are hidden');
select is((select count(*)::int from public.watchlist_items where title='Private series'),0,'private watchlist items are hidden');

select is((select count(*)::int from public.fitness_profiles),0,'fitness profile is hidden from other users');
select is((select count(*)::int from public.workout_sessions),0,'workout history is hidden from other users');
select is((select count(*)::int from public.nutrition_entries),0,'nutrition entries are hidden from other users');
select is((select count(*)::int from public.health_measurements),0,'health measurements are hidden from other users');
select is((select count(*)::int from storage.objects where bucket_id='nexus-health'),0,'private health files are hidden from other users');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::int from public.fitness_profiles),1,'owner can read their fitness profile');
select is((select count(*)::int from public.workout_sessions),1,'owner can read their workout history');
select is((select count(*)::int from public.nutrition_entries),1,'owner can read their nutrition entries');
select is((select count(*)::int from public.health_measurements),1,'owner can read their health measurements');
select is((select count(*)::int from storage.objects where bucket_id='nexus-health'),1,'owner can read their private health files');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
update public.follows set status='accepted' where follower_id='11111111-1111-4111-8111-111111111111' and followed_id='33333333-3333-4333-8333-333333333333';
select throws_ok('update public.follows set follower_id=''22222222-2222-4222-8222-222222222222'' where follower_id=''11111111-1111-4111-8111-111111111111'' and followed_id=''33333333-3333-4333-8333-333333333333''','42501','Follow identity cannot be changed','follow identity is immutable');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::int from public.profiles where id='33333333-3333-4333-8333-333333333333'),1,'accepted follower can view followers-only profile');
select is((select count(*)::int from public.clips where id='60000000-0000-4000-8000-000000000002'),1,'accepted follower can view followers-only clip');
select is((select count(*)::int from public.clip_likes where clip_id='60000000-0000-4000-8000-000000000002'),1,'accepted follower can view likes on followers-only clips');
insert into public.blocks(blocker_id,blocked_id) values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.posts where author_id='22222222-2222-4222-8222-222222222222'),0,'blocking a user hides their posts');
select is((select count(*)::int from public.clips where author_id='22222222-2222-4222-8222-222222222222'),0,'blocking a user hides their clips');
select is((select count(*)::int from storage.objects where name='22222222-2222-4222-8222-222222222222/60000000-0000-4000-8000-000000000001/video.mp4'),0,'blocking a user hides their clip video');

reset role;
select * from finish();
rollback;
