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
    const query='select=id,author_id,body,visibility,created_at,profiles(username,display_name,avatar_path),post_media(storage_path,media_type,sort_order),post_likes(user_id),comments(count)&order=created_at.desc&limit='+Math.min(50,Math.max(1,limit));
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
        text:row.body||'',commentList:[],createdAt:row.created_at,visibility:row.visibility
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
  window.NEXUS_CLOUD_SOCIAL={isReady:async()=>!!(await currentUser()),createPost,fetchFeed,toggleLike,fetchComments,addComment,deletePost};
})();
