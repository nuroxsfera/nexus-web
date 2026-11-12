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
    const query='select=id,author_id,body,visibility,channel_id,created_at,profiles(username,display_name,avatar_path),post_media(storage_path,media_type,sort_order),post_likes(user_id),comments(count)&order=created_at.desc&limit='+Math.min(50,Math.max(1,limit));
    const rows=await client.rest('posts',query);
    return Promise.all((rows||[]).map(async row=>{
      const media=[...(row.post_media||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
      const urls=(await Promise.all(media.map(async item=>{try{return await client.signedMediaUrl('nexus-media',item.storage_path,3600)}catch{return null}}))).filter(Boolean);
      let avatar='https://i.pravatar.cc/64?u='+encodeURIComponent(row.profiles?.username||row.author_id);
      if(row.profiles?.avatar_path){try{avatar=await client.signedMediaUrl('nexus-avatars',row.profiles.avatar_path,3600)}catch{}}
      const commentCount=Array.isArray(row.comments)?Number(row.comments[0]?.count||0):0;
      return {
        id:'cloud-'+row.id,cloudId:row.id,author:row.profiles?.display_name||row.profiles?.username||'Пользователь',
        authorKey:row.author_id===user.id?'me':null,avatar,image:urls[0]||null,images:urls,
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
  async function uploadOwnerMedia(user,folder,item){
    if(!item)return null;
    const type=item.type||item.blob?.type||'image/jpeg';
    const path=user.id+'/'+folder+'/'+uuid()+'.'+fileExtension(type,item.name);
    await auth().uploadMedia('nexus-media',path,item.blob||item);
    return path;
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
      client.rest('channels','select=id,title,slug,description,visibility,avatar_path,cover_path,created_at&owner_id=eq.'+user.id+'&order=created_at.desc'),
      client.rest('shops','select=id,title,slug,description,visibility,avatar_path,created_at,products(id,title,description,price,currency,status,cover_path)&owner_id=eq.'+user.id+'&order=created_at.desc')
    ]);
    const mappedChannels=await Promise.all((channels||[]).map(async row=>{
      let cover=null;if(row.cover_path)try{cover=await client.signedMediaUrl('nexus-media',row.cover_path,3600)}catch{}
      return {id:'cloud-channel-'+row.id,cloudId:row.id,name:row.title,desc:row.description||'',visibility:row.visibility,ownerKey:'me',members:0,avatar:null,cover,posts:[],createdAt:row.created_at};
    }));
    const mappedShops=await Promise.all((shops||[]).map(async row=>{
      let avatar=null;if(row.avatar_path)try{avatar=await client.signedMediaUrl('nexus-media',row.avatar_path,3600)}catch{}
      const products=await Promise.all((row.products||[]).map(async product=>{
        let image=null;if(product.cover_path)try{image=await client.signedMediaUrl('nexus-media',product.cover_path,3600)}catch{}
        return {id:'cloud-product-'+product.id,cloudId:product.id,name:product.title,desc:product.description||'',price:Number(product.price)||0,currency:product.currency||'RUB',image,shopId:'cloud-shop-'+row.id,status:product.status};
      }));
      return {id:'cloud-shop-'+row.id,cloudId:row.id,name:row.title,desc:row.description||'',visibility:row.visibility,ownerKey:'me',avatar,products,createdAt:row.created_at};
    }));
    return {channels:mappedChannels,shops:mappedShops};
  }
  window.NEXUS_CLOUD_SOCIAL={isReady:async()=>!!(await currentUser()),createPost,fetchFeed,toggleLike,fetchComments,addComment,deletePost,createChannel,updateChannel,createShop,updateShop,createProduct,updateProduct,deleteProduct,fetchResources};
})();
