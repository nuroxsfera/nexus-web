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
    return [];
  }
};
const window={NEXUS_AUTH:client};
const context={window,crypto:webcrypto,console,Blob,Uint8Array,Promise,Date,Math,String,Number,Array,Error,URL};
vm.runInNewContext(fs.readFileSync('cloud-social.js','utf8'),context);
const cloud=window.NEXUS_CLOUD_SOCIAL;
assert.ok(await cloud.isReady());

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
assert.ok(calls.some(call=>call[0]==='remove'&&call[1]==='nexus-media'));

console.log('Cloud social smoke checks passed: auth, post/media upload, feed, likes, comments, delete.');
