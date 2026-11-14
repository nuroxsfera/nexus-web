// Nexus browser auth client. Uses only Supabase publishable/anon key; no service-role secret.
(function(){
  const SESSION_KEY='nexus.auth.session.v1';
  let config=null,session=null,ready=false,refreshPromise=null;
  function readStoredSession(){
    try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}
  }
  function storeSession(value){
    session=value||null;
    try{if(session)sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));else sessionStorage.removeItem(SESSION_KEY)}catch(e){console.warn('Session storage unavailable')}
    window.dispatchEvent(new CustomEvent('nexus:auth-change',{detail:{user:session?.user||null}}));
  }
  function errorMessage(payload,status){
    return payload?.msg||payload?.message||payload?.error_description||payload?.error||('Ошибка сервера ('+status+')');
  }
  async function readJson(response){
    let payload={};try{payload=await response.json()}catch{}
    if(!response.ok)throw new Error(errorMessage(payload,response.status));
    return payload;
  }
  async function initialize(){
    ready=true;session=readStoredSession();
    try{
      const response=await fetch('/api/config',{cache:'no-store'});
      const payload=await response.json();
      if(response.ok&&payload.configured&&payload.url&&payload.publicKey){
        const url=new URL(payload.url);
        if(url.protocol==='https:'){config={url:url.origin,publicKey:payload.publicKey}}
      }
    }catch(error){console.warn('Auth config unavailable:',error?.message||error)}
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    if(hash.get('access_token')&&hash.get('refresh_token')){
      session={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Date.now()/1000+Number(hash.get('expires_in')||3600),user:null};
      storeSession(session);
      history.replaceState(null,'',location.pathname+location.search);
    }
    if(session?.expires_at&&session.expires_at<Date.now()/1000-60)storeSession(null);
    return !!config;
  }
  function isConfigured(){return !!config&&ready}
  async function request(path,options={},token){
    if(!isConfigured())throw new Error('Сервер аккаунтов ещё не подключён');
    const headers={apikey:config.publicKey,'Content-Type':'application/json',...(options.headers||{})};
    if(token)headers.Authorization='Bearer '+token;
    const response=await fetch(config.url+path,{...options,headers});
    return readJson(response);
  }
  async function refreshSession(){
    if(refreshPromise)return refreshPromise;
    if(!session?.refresh_token){storeSession(null);return null}
    const pending=(async()=>{
      try{
        const next=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
        storeSession({...next,expires_at:Date.now()/1000+Number(next.expires_in||3600)});
        return session;
      }catch(error){storeSession(null);throw error}
    })();
    refreshPromise=pending;
    try{return await pending}finally{if(refreshPromise===pending)refreshPromise=null}
  }
  async function getSession(){
    if(!session)session=readStoredSession();
    if(!session)return null;
    if(session.expires_at&&session.expires_at<Date.now()/1000+60){
      try{return await refreshSession()}catch{return null}
    }
    return session;
  }
  async function signUp({email,password,name,username}){
    const cleanUsername=String(username||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(cleanUsername.length<3||cleanUsername.length>30)throw new Error('Логин должен содержать 3–30 латинских букв, цифр или _');
    if(String(password||'').length<12)throw new Error('Пароль должен содержать минимум 12 символов');
    const result=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{name:String(name||'').trim().slice(0,60),username:cleanUsername}})});
    if(result.access_token)storeSession({...result,expires_at:Date.now()/1000+Number(result.expires_in||3600)});
    return {user:result.user||null,needsEmailConfirmation:!result.access_token};
  }
  async function signIn({email,password}){
    const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
    storeSession({...result,expires_at:Date.now()/1000+Number(result.expires_in||3600)});
    return session;
  }
  async function signOut(){
    const current=await getSession();
    try{if(current?.access_token)await request('/auth/v1/logout',{method:'POST'},current.access_token)}finally{storeSession(null)}
  }
  async function resetPassword(email){
    const redirect=encodeURIComponent(location.origin+'/?auth=recovery');
    await request('/auth/v1/recover?redirect_to='+redirect,{method:'POST',body:JSON.stringify({email})});
  }
  async function updatePassword(password){
    if(String(password||'').length<12)throw new Error('Пароль должен содержать минимум 12 символов');
    const current=await getSession();if(!current?.access_token)throw new Error('Сначала открой ссылку восстановления из письма');
    const result=await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password})},current.access_token);
    if(result)storeSession({...current,user:result});
    return result;
  }
  async function rest(table,query='',options={}){
    const current=await getSession();if(!current?.access_token)throw new Error('Войди в аккаунт для синхронизации');
    const method=options.method||'GET',headers={...(options.headers||{})};
    if(['POST','PATCH','DELETE'].includes(method)&&options.returning!==false)headers.Prefer='return=representation';
    const suffix=query?(query.startsWith('?')?query:'?'+query):'';
    return request('/rest/v1/'+encodeURIComponent(table)+suffix,{
      method,headers,body:options.body===undefined?undefined:JSON.stringify(options.body)
    },current.access_token);
  }
  async function uploadMedia(bucket,path,file){
    const current=await getSession();if(!current?.access_token)throw new Error('Войди в аккаунт для загрузки медиа');
    const encoded=path.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(config.url+'/storage/v1/object/'+encodeURIComponent(bucket)+'/'+encoded,{
      method:'POST',
      headers:{apikey:config.publicKey,Authorization:'Bearer '+current.access_token,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},
      body:file
    });
    return readJson(response);
  }
  async function signedMediaUrl(bucket,path,expiresIn=300){
    const current=await getSession();if(!current?.access_token)throw new Error('Нужен вход в аккаунт');
    const encoded=path.split('/').map(encodeURIComponent).join('/');
    const result=await request('/storage/v1/object/sign/'+encodeURIComponent(bucket)+'/'+encoded,{
      method:'POST',body:JSON.stringify({expiresIn})
    },current.access_token);
    if(result.signedURL?.startsWith('http'))return result.signedURL;
    const signed=result.signedURL||result.signedUrl;
    if(!signed)throw new Error('Не удалось получить ссылку на медиа');
    return config.url+'/storage/v1'+(signed.startsWith('/')?signed:'/'+signed);
  }
  async function removeMedia(bucket,paths){
    const current=await getSession();if(!current?.access_token)throw new Error('Нужен вход в аккаунт');
    return request('/storage/v1/object/'+encodeURIComponent(bucket),{
      method:'DELETE',body:JSON.stringify({prefixes:paths})
    },current.access_token);
  }
  async function getUser(){
    const current=await getSession();if(!current?.access_token)return null;
    try{const user=await request('/auth/v1/user',{method:'GET'},current.access_token);storeSession({...current,user});return user}catch{storeSession(null);return null}
  }
  window.NEXUS_AUTH={initialize,isConfigured,hasSession:function(){return !!session},getSession,getUser,signUp,signIn,signOut,resetPassword,updatePassword,rest,uploadMedia,signedMediaUrl,removeMedia};
})();
