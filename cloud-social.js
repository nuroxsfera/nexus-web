// Optional cloud social layer. It stays inactive until Supabase Auth is configured and a user signs in.
(function(){
  function auth(){return window.NEXUS_AUTH}
  function uuid(){
    if(crypto.randomUUID)return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    return [...bytes].map((b,i)=>[4,6,8,10].includes(i)?'-'+b.toString(16).padStart(2,'0'):b.toString(16).padStart(2,'0')).join('');
  }
  function fileExtension(type,name){
    const known={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/quicktime':'mov'};
    if(known[type])return known[type];
    const ext=String(name||'').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');
    return ext&&ext.length<=5?ext:'bin';
  }
  async function currentUser(){
    const client=auth();if(!client?.isConfigured()||!client.hasSession())return null;
    return client.getUser();
  }
  async function createPost({body='',media=[],channelId=null,visibility='public'}){
    const client=auth(),user=await currentUser();
    if(!user?.id)throw new Error('Сначала войди в аккаунт');
    if(!String(body).trim()&&!media.length)throw new Error('Добавь текст или медиа');
    const id=uuid(),uploaded=[];
    try{
      for(let index=0;index<media.length;index++){
        const item=media[index],type=item.type||item.blob?.type||'application/octet-stream';
        const path=user.id+'/posts/'+id+'/'+String(index).padStart(2,'0')+'.'+fileExtension(type,item.name);
        await client.uploadMedia('nexus-media',path,item.blob||item);
        uploaded.push({storage_path:path,media_type:type.startsWith('video/')?'video':'image',sort_order:index});
      }
      const validChannel=typeof channelId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(channelId)?channelId:null;
      await client.rest('posts','',{method:'POST',body:{id,author_id:user.id,body:String(body).slice(0,5000),visibility:['public','followers','private'].includes(visibility)?visibility:'public',channel_id:validChannel}});
      if(uploaded.length)await client.rest('post_media','',{method:'POST',body:uploaded.map(item=>({...item,post_id:id}))});
      return {id,media:uploaded};
    }catch(error){
      try{await client.rest('posts','id=eq.'+id,{method:'DELETE'})}catch{}
      if(uploaded.length)try{await client.removeMedia('nexus-media',uploaded.map(item=>item.storage_path))}catch{}
      throw error;
    }
  }
  async function fetchFeed(limit=30){
    const client=auth(),user=await currentUser();if(!user?.id)return [];
    const query='select=id,author_id,body,visibility,channel_id,created_at,profiles(id,username,display_name,bio,avatar_path,cover_path,visibility),post_media(storage_path,media_type,sort_order),post_likes(user_id),comments(count)&order=created_at.desc&limit='+Math.min(50,Math.max(1,limit));
    const rows=await client.rest('posts',query);
    return Promise.all((rows||[]).map(async row=>{
      const media=[...(row.post_media||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
      const urls=(await Promise.all(media.map(async item=>{try{return await client.signedMediaUrl('nexus-media',item.storage_path,3600)}catch{return null}}))).filter(Boolean);
      const profileData=await profileWithMedia(row.profiles?{...row.profiles,id:row.profiles.id||row.author_id}:null);
      const avatar=profileData?.avatar||'https://i.pravatar.cc/64?u='+encodeURIComponent(row.profiles?.username||row.author_id);
      const commentCount=Array.isArray(row.comments)?Number(row.comments[0]?.count||0):0;
      return {
        id:'cloud-'+row.id,cloudId:row.id,author:row.profiles?.display_name||row.profiles?.username||'Пользователь',
        authorId:row.author_id,authorKey:row.author_id===user.id?'me':'cloud-user-'+row.author_id,profileData,avatar,image:urls[0]||null,images:urls,
        likes:(row.post_likes||[]).length,comments:commentCount,
        liked:(row.post_likes||[]).some(item=>item.user_id===user.id),saved:false,
        text:row.body||'',commentList:[],createdAt:row.created_at,visibility:row.visibility,channelId:row.channel_id||null
      };
    }));
  }
  async function toggleLike(postId,liked){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    if(liked)await client.rest('post_likes','',{method:'POST',body:{post_id:postId,user_id:user.id}});
    else await client.rest('post_likes','post_id=eq.'+postId+'&user_id=eq.'+user.id,{method:'DELETE'});
  }
  async function deletePost(postId){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    let paths=[];
    try{const rows=await client.rest('post_media','select=storage_path&post_id=eq.'+postId);paths=(rows||[]).map(row=>row.storage_path)}catch{}
    await client.rest('posts','id=eq.'+postId,{method:'DELETE'});
    if(paths.length)try{await client.removeMedia('nexus-media',paths)}catch(error){console.warn('Cloud media cleanup deferred:',error?.message||error)}
  }
  async function fetchComments(postId){
    const client=auth();
    const rows=await client.rest('comments','select=id,body,created_at,profiles(display_name,username)&post_id=eq.'+postId+'&order=created_at.asc');
    return (rows||[]).map(row=>({id:row.id,user:row.profiles?.display_name||row.profiles?.username||'Пользователь',text:row.body,createdAt:row.created_at}));
  }
  async function addComment(postId,body){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const rows=await client.rest('comments','',{method:'POST',body:{post_id:postId,author_id:user.id,body:String(body).slice(0,2000)}});
    return rows?.[0]||null;
  }
  async function createConversation({participantIds=[],title=''}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const ids=[...new Set(participantIds.filter(id=>id&&id!==user.id))];
    if(!ids.length)throw new Error('Выбери собеседника');
    const id=uuid(),isGroup=ids.length>1;
    try{
      await client.rest('conversations','',{method:'POST',body:{id,created_by:user.id,title:isGroup?String(title||'Групповой чат').slice(0,80):null,is_group:isGroup}});
      await client.rest('conversation_members','',{method:'POST',body:[user.id,...ids].map(user_id=>({conversation_id:id,user_id}))});
      return {id};
    }catch(error){try{await client.rest('conversations','id=eq.'+id,{method:'DELETE'})}catch{}throw error}
  }
  async function fetchConversations(){
    const client=auth(),user=await currentUser();if(!user?.id)return [];
    const query='select=id,title,is_group,created_by,created_at,conversation_members(user_id,profiles(id,username,display_name,bio,avatar_path,cover_path,visibility)),messages(id,body,sender_id,created_at)&messages.order=created_at.desc&messages.limit=1&order=created_at.desc';
    const rows=await client.rest('conversations',query);
    return Promise.all((rows||[]).map(async row=>{
      const members=(row.conversation_members||[]).filter(member=>member.user_id!==user.id);
      const profiles=await Promise.all(members.map(async member=>{
        const profile=await profileWithMedia(member.profiles?{...member.profiles,id:member.profiles.id||member.user_id}:null);
        return {userId:member.user_id,profile};
      }));
      const names=profiles.map(item=>item.profile?.name||'Пользователь');
      const latest=[...(row.messages||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
      const single=members.length===1,other=profiles[0]?.profile;
      return {
        id:'cloud-chat-'+row.id,cloudId:row.id,name:row.title||(single?other?.name||'Диалог':names.join(', ')),
        avatar:single?(other?.avatar||'https://i.pravatar.cc/128?u='+row.id):'https://i.pravatar.cc/128?u=group-'+row.id,
        last:latest?.body||'Чат создан',time:latest?.created_at?new Date(latest.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'',
        unread:0,messages:[],profileKey:single?'cloud-user-'+members[0].user_id:null,
        profileKeys:members.map(member=>'cloud-user-'+member.user_id),
        participants:profiles.map(item=>({userId:item.userId,profile:item.profile}))
      };
    }));
  }
  async function fetchMessages(conversationId){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const rows=await client.rest('messages','select=id,body,sender_id,created_at&conversation_id=eq.'+conversationId+'&order=created_at.asc&limit=100');
    try{await client.rest('conversation_members','conversation_id=eq.'+conversationId+'&user_id=eq.'+user.id,{method:'PATCH',body:{last_read_at:new Date().toISOString()}})}catch{}
    return (rows||[]).map(row=>({id:row.id,me:row.sender_id===user.id,text:row.body,createdAt:row.created_at}));
  }
  async function sendMessage(conversationId,body){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const text=String(body||'').trim();if(!text||text.length>10000)throw new Error('Сообщение должно содержать от 1 до 10 000 символов');
    const rows=await client.rest('messages','',{method:'POST',body:{conversation_id:conversationId,sender_id:user.id,body:text}});
    return rows?.[0]||null;
  }
  async function profileWithMedia(row){
    if(!row)return null;
    const client=auth();let avatar=null,cover=null;
    if(row.avatar_path)try{avatar=await client.signedMediaUrl('nexus-avatars',row.avatar_path,3600)}catch{}
    if(row.cover_path)try{cover=await client.signedMediaUrl('nexus-avatars',row.cover_path,3600)}catch{}
    return {id:row.id,cloudId:row.id,username:row.username,name:row.display_name||row.username,handle:'@'+row.username,bio:row.bio||'',avatar,hero:cover||'https://picsum.photos/seed/profile-'+row.id+'/1200/1600',cover,visibility:row.visibility||'public'};
  }
  async function fetchMyProfile(){
    const client=auth(),user=await currentUser();if(!user?.id)return null;
    const rows=await client.rest('profiles','select=id,username,display_name,bio,avatar_path,cover_path,visibility&id=eq.'+user.id);
    return profileWithMedia(rows?.[0]);
  }
  async function updateMyProfile({name,username,bio,avatar=null,cover=null,visibility}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const old=await client.rest('profiles','select=avatar_path,cover_path&id=eq.'+user.id);
    const patch={};if(name!==undefined)patch.display_name=String(name).slice(0,60);
    if(username!==undefined){const clean=String(username).toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,30);if(clean.length<3)throw new Error('Логин должен содержать минимум 3 символа');patch.username=clean;}
    if(bio!==undefined)patch.bio=String(bio).slice(0,500);if(visibility!==undefined)patch.visibility=visibility;
    const uploaded=[];
    try{
      if(avatar){patch.avatar_path=await uploadOwnerMedia(user,'avatars',avatar,'nexus-avatars');uploaded.push(patch.avatar_path)}
      if(cover){patch.cover_path=await uploadOwnerMedia(user,'covers',cover,'nexus-avatars');uploaded.push(patch.cover_path)}
      await client.rest('profiles','id=eq.'+user.id,{method:'PATCH',body:patch});
    }catch(error){if(uploaded.length)try{await client.removeMedia('nexus-avatars',uploaded)}catch{}throw error}
    const oldPaths=[old?.[0]?.avatar_path,old?.[0]?.cover_path].filter(Boolean);
    if(oldPaths.length)try{await client.removeMedia('nexus-avatars',oldPaths)}catch{}
    return fetchMyProfile();
  }
  async function fetchProfile(userId){
    const client=auth(),profileRows=await client.rest('profiles','select=id,username,display_name,bio,avatar_path,cover_path,visibility&id=eq.'+userId);
    if(!profileRows?.[0])return null;
    const profile=await profileWithMedia(profileRows[0]);
    const [followers,following,posts]=await Promise.all([
      client.rest('follows','select=follower_id&following_id=eq.'+userId).catch(()=>[]),
      client.rest('follows','select=following_id&follower_id=eq.'+userId).catch(()=>[]),
      client.rest('posts','select=id&author_id=eq.'+userId).catch(()=>[])
    ]);
    return {...profile,followers:followers.length,following:following.length,posts:posts.length};
  }
  async function searchProfiles(term){
    const client=auth();await currentUser();
    const normalized=String(term||'').replace(/^@/,'').trim().slice(0,64);
    if(!normalized)return [];
    // Search both public handle and display name. Encode user input separately
    // so PostgREST filter syntax cannot be altered by punctuation in the query.
    const query=encodeURIComponent(normalized);
    const filter='or=(username.ilike.*'+query+'*,display_name.ilike.*'+query+'*)&select=id,username,display_name,bio,avatar_path,cover_path,visibility&limit=20';
    const rows=await client.rest('profiles',filter);
    return Promise.all((rows||[]).map(profileWithMedia));
  }
  async function followUser(userId,follow){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    if(follow)await client.rest('follows','',{method:'POST',body:{follower_id:user.id,following_id:userId}});
    else await client.rest('follows','follower_id=eq.'+user.id+'&following_id=eq.'+userId,{method:'DELETE'});
  }
  async function fetchBlocks(){
    const client=auth(),user=await currentUser();if(!user?.id)return [];
    return client.rest('blocks','select=blocked_id&blocker_id=eq.'+user.id);
  }
  async function blockUser(userId,blocked){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    if(blocked)await client.rest('blocks','',{method:'POST',body:{blocker_id:user.id,blocked_id:userId}});
    else await client.rest('blocks','blocker_id=eq.'+user.id+'&blocked_id=eq.'+userId,{method:'DELETE'});
  }
  async function uploadOwnerMedia(user,folder,item,bucket='nexus-media'){
    if(!item)return null;
    const type=item.type||item.blob?.type||'image/jpeg';
    const path=user.id+'/'+folder+'/'+uuid()+'.'+fileExtension(type,item.name);
    await auth().uploadMedia(bucket,path,item.blob||item);
    return path;
  }
  async function joinChannel(channelId,joined){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    if(joined){
      try{await client.rest('channel_members','',{method:'POST',body:{channel_id:channelId,user_id:user.id,role:'member'}})}
      catch(error){if(!String(error.message||'').toLowerCase().includes('duplicate'))throw error}
    }else await client.rest('channel_members','channel_id=eq.'+channelId+'&user_id=eq.'+user.id,{method:'DELETE'});
  }
  async function createChannel({title,description='',visibility='public',cover=null}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const id=uuid();let coverPath=null;
    try{
      coverPath=await uploadOwnerMedia(user,'channels',cover);
      const slug='ch-'+id.replace(/-/g,'').slice(0,12);
      await client.rest('channels','',{method:'POST',body:{id,owner_id:user.id,title:String(title).slice(0,80),slug,description:String(description).slice(0,1500),visibility,cover_path:coverPath}});
      return {id,coverPath};
    }catch(error){if(coverPath)try{await client.removeMedia('nexus-media',[coverPath])}catch{}throw error}
  }
  async function updateChannel(id,{title,description,visibility,cover=null}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const old=await client.rest('channels','select=cover_path&id=eq.'+id+'&owner_id=eq.'+user.id);
    const patch={};if(title!==undefined)patch.title=String(title).slice(0,80);if(description!==undefined)patch.description=String(description).slice(0,1500);if(visibility!==undefined)patch.visibility=visibility;
    if(cover)patch.cover_path=await uploadOwnerMedia(user,'channels',cover);
    await client.rest('channels','id=eq.'+id+'&owner_id=eq.'+user.id,{method:'PATCH',body:patch});
    if(cover&&old?.[0]?.cover_path)try{await client.removeMedia('nexus-media',[old[0].cover_path])}catch{}
  }
  async function createShop({title,description='',visibility='public',avatar=null}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const id=uuid();let avatarPath=null;
    try{
      avatarPath=await uploadOwnerMedia(user,'shops',avatar);
      const slug='shop-'+id.replace(/-/g,'').slice(0,12);
      await client.rest('shops','',{method:'POST',body:{id,owner_id:user.id,title:String(title).slice(0,80),slug,description:String(description).slice(0,1500),visibility,avatar_path:avatarPath}});
      return {id,avatarPath};
    }catch(error){if(avatarPath)try{await client.removeMedia('nexus-media',[avatarPath])}catch{}throw error}
  }
  async function updateShop(id,{title,description,visibility}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const patch={};if(title!==undefined)patch.title=String(title).slice(0,80);if(description!==undefined)patch.description=String(description).slice(0,1500);if(visibility!==undefined)patch.visibility=visibility;
    return client.rest('shops','id=eq.'+id+'&owner_id=eq.'+user.id,{method:'PATCH',body:patch});
  }
  async function createProduct({shopId,title,description='',price=0,currency='RUB',cover=null}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const coverPath=await uploadOwnerMedia(user,'products',cover);
    try{
      const rows=await client.rest('products','',{method:'POST',body:{shop_id:shopId,title:String(title).slice(0,120),description:String(description).slice(0,3000),price:Number(price)||0,currency,status:'published',cover_path:coverPath}});
      return {...(rows?.[0]||{}),coverPath};
    }catch(error){if(coverPath)try{await client.removeMedia('nexus-media',[coverPath])}catch{}throw error}
  }
  async function updateProduct(id,{title,description,price,cover=null}){
    const client=auth(),user=await currentUser();if(!user?.id)throw new Error('Сначала войди в аккаунт');
    const old=await client.rest('products','select=cover_path&id=eq.'+id);
    const patch={};if(title!==undefined)patch.title=String(title).slice(0,120);if(description!==undefined)patch.description=String(description).slice(0,3000);if(price!==undefined)patch.price=Number(price)||0;
    if(cover)patch.cover_path=await uploadOwnerMedia(user,'products',cover);
    await client.rest('products','id=eq.'+id,{method:'PATCH',body:patch});
    if(cover&&old?.[0]?.cover_path)try{await client.removeMedia('nexus-media',[old[0].cover_path])}catch{}
  }
  async function deleteProduct(id){
    const client=auth();await currentUser();
    const rows=await client.rest('products','select=cover_path&id=eq.'+id);
    await client.rest('products','id=eq.'+id,{method:'DELETE'});
    const paths=(rows||[]).map(row=>row.cover_path).filter(Boolean);
    if(paths.length)try{await client.removeMedia('nexus-media',paths)}catch{}
  }
  async function fetchResources(){
    const client=auth(),user=await currentUser();if(!user?.id)return {channels:[],shops:[]};
    const [channels,shops]=await Promise.all([
      client.rest('channels','select=id,owner_id,title,slug,description,visibility,avatar_path,cover_path,created_at,channel_members(user_id)&order=created_at.desc'),
      client.rest('shops','select=id,owner_id,title,slug,description,visibility,avatar_path,created_at,products(id,title,description,price,currency,status,cover_path)&order=created_at.desc')
    ]);
    const mappedChannels=await Promise.all((channels||[]).map(async row=>{
      let cover=null;if(row.cover_path)try{cover=await client.signedMediaUrl('nexus-media',row.cover_path,3600)}catch{}
      return {id:'cloud-channel-'+row.id,cloudId:row.id,name:row.title,desc:row.description||'',visibility:row.visibility,ownerKey:row.owner_id===user.id?'me':null,member:row.owner_id===user.id||(row.channel_members||[]).some(member=>member.user_id===user.id),members:0,avatar:null,cover,posts:[],createdAt:row.created_at};
    }));
    const mappedShops=await Promise.all((shops||[]).map(async row=>{
      let avatar=null;if(row.avatar_path)try{avatar=await client.signedMediaUrl('nexus-media',row.avatar_path,3600)}catch{}
      const products=await Promise.all((row.products||[]).map(async product=>{
        let image=null;if(product.cover_path)try{image=await client.signedMediaUrl('nexus-media',product.cover_path,3600)}catch{}
        return {id:'cloud-product-'+product.id,cloudId:product.id,name:product.title,desc:product.description||'',price:Number(product.price)||0,currency:product.currency||'RUB',image,shopId:'cloud-shop-'+row.id,status:product.status};
      }));
      return {id:'cloud-shop-'+row.id,cloudId:row.id,name:row.title,desc:row.description||'',visibility:row.visibility,ownerKey:row.owner_id===user.id?'me':null,avatar,products,createdAt:row.created_at};
    }));
    return {channels:mappedChannels,shops:mappedShops};
  }
  window.NEXUS_CLOUD_SOCIAL={isReady:async()=>!!(await currentUser()),createPost,fetchFeed,toggleLike,fetchComments,addComment,deletePost,createChannel,updateChannel,createShop,updateShop,createProduct,updateProduct,deleteProduct,fetchResources,joinChannel,fetchMyProfile,updateMyProfile,fetchProfile,searchProfiles,followUser,blockUser,fetchBlocks,createConversation,fetchConversations,fetchMessages,sendMessage};
})();
