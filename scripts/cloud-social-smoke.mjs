import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const calls=[];
const user={id:'11111111-1111-4111-8111-111111111111'};
const client={
  isConfigured:()=>true,
  hasSession:()=>true,
  getUser:async()=>user,
  uploadMedia:async(bucket,path,file)=>{calls.push(['upload',bucket,path,file.type]);return {Key:path}},
  signedMediaUrl:async(bucket,path)=>'https://media.example.test/'+bucket+'/'+path,
  removeMedia:async(bucket,paths)=>{calls.push(['remove',bucket,paths])},
  rest:async(table,query='',options={})=>{
    calls.push([table,query,options.method||'GET',options.body]);
    if(table==='posts'&&options.method==='POST')return [{id:options.body.id}];
    if(table==='posts'&&query.startsWith('select='))return [{
      id:'22222222-2222-4222-8222-222222222222',
      author_id:user.id,body:'Cloud post',visibility:'public',created_at:'2026-11-13T10:00:00Z',
      profiles:{username:'tester',display_name:'Tester',avatar_path:null},
      post_media:[{storage_path:user.id+'/posts/file.jpg',media_type:'image',sort_order:0}],
      post_likes:[{user_id:user.id}],comments:[{count:2}]
    }];
    if(table==='post_media'&&query.startsWith('select='))return [{storage_path:user.id+'/posts/file.jpg'}];
    if(table==='comments'&&query.startsWith('select='))return [{id:'c1',body:'Nice',profiles:{display_name:'Tester'}}];
    if(table==='comments'&&options.method==='POST')return [{id:'c2'}];
    if(table==='profiles'&&query.startsWith('or='))return [{id:'77777777-7777-4777-8777-777777777777',username:'tester2',display_name:'Tester Two',bio:'Bio',avatar_path:null,cover_path:null,visibility:'public'}];
    if(table==='profiles'&&query.startsWith('select='))return [{id:user.id,username:'tester',display_name:'Tester',bio:'Hello',avatar_path:null,cover_path:null,visibility:'public'}];
    if(table==='follows'&&query.startsWith('select='))return query.includes('following_id=')?[{follower_id:'x'}]:[];
    if(table==='products'&&options.method==='POST')return [{id:'33333333-3333-4333-8333-333333333333'}];
    if(table==='products'&&query.startsWith('select=cover_path'))return [{cover_path:'old-cover.jpg'}];
    if(table==='channels'&&query.startsWith('select=cover_path'))return [];
    if(table==='channels'&&query.startsWith('select=id,owner_id'))return [{id:'66666666-6666-4666-8666-666666666666',title:'Cloud channel',description:'',visibility:'public',cover_path:null,avatar_path:null,created_at:'2026-11-13T10:00:00Z'}];
    if(table==='shops'&&query.startsWith('select='))return [{id:'44444444-4444-4444-8444-444444444444',title:'Cloud shop',description:'',visibility:'public',avatar_path:null,products:[{id:'55555555-5555-4555-8555-555555555555',title:'Item',description:'',price:100,currency:'RUB',status:'published',cover_path:null}]}];
    return [];
  }
};
const window={NEXUS_AUTH:client};
const context={window,crypto:webcrypto,console,Blob,Uint8Array,Promise,Date,Math,String,Number,Array,Error,URL};
vm.runInNewContext(fs.readFileSync('cloud-social.js','utf8'),context);
const cloud=window.NEXUS_CLOUD_SOCIAL;
assert.ok(await cloud.isReady());
const myProfile=await cloud.fetchMyProfile();
assert.equal(myProfile.handle,'@tester');
await cloud.updateMyProfile({name:'Tester Updated',username:'tester',bio:'Updated bio',visibility:'private'});
const remoteProfile=await cloud.fetchProfile('77777777-7777-4777-8777-777777777777');
assert.equal(remoteProfile.name,'Tester');
const matches=await cloud.searchProfiles('tester');
assert.equal(matches.length,1);
await cloud.followUser(remoteProfile.cloudId,true);
await cloud.followUser(remoteProfile.cloudId,false);
await cloud.blockUser(remoteProfile.cloudId,true);
await cloud.blockUser(remoteProfile.cloudId,false);

const media={blob:new Blob(['photo'],{type:'image/jpeg'}),type:'image/jpeg',name:'photo.jpg'};
const created=await cloud.createPost({body:'Hello cloud',media:[media],visibility:'followers'});
assert.match(created.id,/^[0-9a-f-]{36}$/i);
assert.equal(calls.filter(call=>call[0]==='upload').length,1);
assert.equal(calls.find(call=>call[0]==='posts'&&call[2]==='POST')[3].visibility,'followers');
assert.equal(calls.find(call=>call[0]==='post_media')[3][0].media_type,'image');

const feed=await cloud.fetchFeed(10);
assert.equal(feed.length,1);
assert.equal(feed[0].cloudId,'22222222-2222-4222-8222-222222222222');
assert.equal(feed[0].images.length,1);
assert.equal(feed[0].liked,true);
assert.equal(feed[0].comments,2);

await cloud.toggleLike(feed[0].cloudId,false);
assert.ok(calls.some(call=>call[0]==='post_likes'&&call[2]==='DELETE'));
const comments=await cloud.fetchComments(feed[0].cloudId);
assert.equal(comments[0].text,'Nice');
await cloud.addComment(feed[0].cloudId,'Thanks');
assert.ok(calls.some(call=>call[0]==='comments'&&call[2]==='POST'));
await cloud.deletePost(feed[0].cloudId);
assert.ok(calls.some(call=>call[0]==='posts'&&call[2]==='DELETE'));
const channel=await cloud.createChannel({title:'Creators',description:'Community',visibility:'public',cover:media});
assert.match(channel.id,/^[0-9a-f-]{36}$/i);
await cloud.updateChannel(channel.id,{title:'Creators updated',visibility:'followers'});
await cloud.joinChannel(channel.id,true);
await cloud.joinChannel(channel.id,false);
const shop=await cloud.createShop({title:'Studio',description:'Store'});
assert.match(shop.id,/^[0-9a-f-]{36}$/i);
await cloud.updateShop(shop.id,{title:'Studio updated'});
const product=await cloud.createProduct({shopId:shop.id,title:'Tee',description:'Basic',price:1200,cover:media});
assert.equal(product.id,'33333333-3333-4333-8333-333333333333');
await cloud.updateProduct(product.id,{title:'Tee updated',price:1400,cover:media});
await cloud.deleteProduct(product.id);
const resources=await cloud.fetchResources();
assert.equal(resources.channels.length,1);
assert.equal(resources.shops.length,1);
assert.equal(resources.shops[0].products[0].name,'Item');
assert.ok(calls.filter(call=>call[0]==='upload').length>=3);
assert.ok(calls.some(call=>call[0]==='remove'&&call[1]==='nexus-media'));

console.log('Cloud social smoke checks passed: auth, profiles, follows, blocks, posts, media, feed, likes, comments, channels, shops, products and deletion.');
