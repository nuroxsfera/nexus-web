begin;
select plan(23);

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
