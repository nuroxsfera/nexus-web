begin;
select plan(11);

-- Fixtures are created as the database owner; all assertions below run as user A.
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','nexus-a@example.test','',now(),'{"provider":"email","providers":["email"]}','{"name":"Alice"}',now(),now()),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','nexus-b@example.test','',now(),'{"provider":"email","providers":["email"]}','{"name":"Bob"}',now(),now()),
('33333333-3333-4333-8333-333333333333','authenticated','authenticated','nexus-c@example.test','',now(),'{"provider":"email","providers":["email"]}','{"name":"Private"}',now(),now());

update public.profiles set visibility='public' where id='22222222-2222-4222-8222-222222222222';
update public.profiles set visibility='private' where id='33333333-3333-4333-8333-333333333333';

insert into public.channels(id,owner_id,title,slug,visibility) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','Open channel','nexus-open-test','public'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Locked channel','nexus-locked-test','private');

insert into public.posts(id,author_id,body,visibility) values
('10000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Public post','public'),
('10000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Followers post','followers'),
('10000000-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','Private profile post','public');

insert into public.posts(id,author_id,channel_id,body,visibility) values
('10000000-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Private channel post','public');

insert into public.post_media(post_id,storage_path,media_type) values
('10000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000001/public.jpg','image'),
('10000000-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000004/private.jpg','image');

insert into storage.objects(bucket_id,name) values
('nexus-media','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000001/public.jpg'),
('nexus-media','22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000004/private.jpg');

insert into public.conversations(id,created_by) values ('40000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222');
insert into public.conversation_members(conversation_id,user_id) values
('40000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222'),
('40000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333');
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
select is((select count(*)::int from public.post_media where post_id='10000000-0000-4000-8000-000000000004'),0,'private channel media is hidden');
select is((select count(*)::int from storage.objects where name='22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000001/public.jpg'),1,'public post media can be read');
select is((select count(*)::int from storage.objects where name='22222222-2222-4222-8222-222222222222/10000000-0000-4000-8000-000000000004/private.jpg'),0,'private channel media cannot be read');
select is((select count(*)::int from public.messages),0,'direct messages are hidden from non-members');
select is((select count(*)::int from public.notifications),0,'notifications are private to their recipient');
select is((select count(*)::int from public.shops),1,'private shops are hidden and public shops are visible');

insert into public.blocks(blocker_id,blocked_id) values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.posts where author_id='22222222-2222-4222-8222-222222222222'),0,'blocking a user hides their posts');

reset role;
select * from finish();
rollback;
