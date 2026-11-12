
const MEDIA_DB_NAME='nexus-local-media';
let mediaDbPromise;
const mediaUrlCache=new Map();
function openMediaDB(){
  if(mediaDbPromise)return mediaDbPromise;
  mediaDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Хранилище фото недоступно в этом браузере'));return}
    const req=indexedDB.open(MEDIA_DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Не удалось открыть хранилище фото'));
  });
  return mediaDbPromise;
}
async function saveMediaFile(file){
  if(!file||!file.type.startsWith('image/'))throw new Error('Выберите изображение');
  if(file.size>20*1024*1024)throw new Error('Фото должно быть меньше 20 МБ');
  const db=await openMediaDB();
  const id='m'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readwrite');
    tx.objectStore('files').put({id,blob:file,type:file.type||'image/*'});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Не удалось сохранить фото'));
  });
  return 'idb:'+id;
}
function mediaRefInUse(ref){
  if(!ref)return false;
  const inPost=post=>[...(post.images||[]),post.image].filter(Boolean).includes(ref);
  return DB.me?.avatar===ref||DB.me?.cover===ref
    ||DB.posts.some(inPost)
    ||DB.channels.some(channel=>channel.cover===ref||channel.posts?.some(inPost))
    ||DB.stories.some(story=>story.images?.includes(ref))
    ||DB.clips.some(clip=>clip.video===ref)
    ||DB.shops.some(shop=>shop.items?.some(item=>item.image===ref));
}
async function cleanupMedia(ref){
  if(!ref||!ref.startsWith('idb:')||mediaRefInUse(ref)||!('indexedDB' in window))return;
  try{
    const db=await openMediaDB(),id=ref.slice(4);
    await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    const url=mediaUrlCache.get(ref);if(url){URL.revokeObjectURL(url);mediaUrlCache.delete(ref)}
  }catch(e){console.warn('Media cleanup failed',e)}
}
async function resolveMediaURL(ref){
  if(!ref||!ref.startsWith('idb:'))return ref;
  if(mediaUrlCache.has(ref))return mediaUrlCache.get(ref);
  const db=await openMediaDB(),id=ref.slice(4);
  const record=await new Promise((resolve,reject)=>{
    const req=db.transaction('files','readonly').objectStore('files').get(id);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  if(!record?.blob)throw new Error('Фотография не найдена на устройстве');
  const url=URL.createObjectURL(record.blob);mediaUrlCache.set(ref,url);return url;
}
async function hydrateMediaImages(root=document){
  const nodes=[...root.querySelectorAll('img[data-media-ref],video[data-media-ref]')];
  await Promise.all(nodes.map(async media=>{
    try{media.src=await resolveMediaURL(media.dataset.mediaRef);if(media.tagName==='VIDEO')media.load()}
    catch(e){if(media.tagName==='IMG'){media.alt='Фото недоступно';media.classList.add('opacity-40')}else{media.poster='';media.dataset.unavailable='true'}}
  }));
}

function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
const VIEWS=['home','profile','me','saved','notifications','messages','chat','explore','settings','channel','shop','compose'];
function go(r,p){
  closeSheet();closeStory();
  VIEWS.forEach(v=>{const el=document.getElementById('view-'+v);if(el)el.classList.toggle('active',v===r)});
  document.querySelectorAll('.nav-btn').forEach(b=>{
    const route=b.getAttribute('data-r');
    const on=route===r||(r==='chat'&&route==='messages')||((r==='channel'||r==='shop')&&route==='explore')||((r==='settings'||r==='saved')&&route==='me');
    b.classList.toggle('active',on);
  });
  if(r==='chat'&&p?.chatId)openChat(p.chatId);
  if(r==='channel'&&p?.id)openChannel(p.id);
  if(r==='shop'&&p?.id)openShop(p.id);
  if(r==='profile'&&p?.key)openProfile(p.key);
  if(r==='notifications')renderNotifs();
  if(r==='messages')renderChats();
  if(r==='explore')renderExplore();
  if(r==='settings')renderSettings();
  if(r==='me')renderMe();
  if(r==='saved')renderSaved();
  if(r==='compose'){DB.composeChannelId=p?.channelId||null;document.getElementById('compose-text').value='';DB.composeImgs=[];renderComposeImgs();document.getElementById('compose-title').textContent=DB.composeChannelId?'Публикация в канале':'Новый пост'}
  if(r==='home'){renderStories();renderFeed()}
}
function setNav(v){document.getElementById('bnav').classList.toggle('hide',!v)}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),2200)}
function fmt(n){return n>=1000?(n/1000).toFixed(1).replace('.0','')+' тыс.':String(n)}
function finishOnboarding(){DB.onboarded=true;save();document.getElementById('onboarding').classList.remove('on');toast('Добро пожаловать 🌊')}
function renderStories(){
  document.getElementById('stories').innerHTML=DB.stories.filter(story=>!story.profile||!DB.blocked?.[story.profile]).map(story=>{
    if(story.type==='add')return `<button class="flex flex-col items-center gap-1 shrink-0 press" onclick="openCreate()"><div class="w-[66px] h-[66px] rounded-full bg-[#161618] border border-white/10 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg></div><span class="text-[10px] text-white/45">Добавить</span></button>`;
    const seen=DB.seenStories[story.id];
    const avatar=story.avatar?`<img src="${esc(story.avatar)}" class="w-full h-full rounded-full object-cover border-[2.5px] border-black" onerror="this.style.display='none'">`:`<div class="w-full h-full rounded-full bg-[#222] border-[2.5px] border-black"></div>`;
    return `<button class="flex flex-col items-center gap-1 shrink-0 press" data-story-id="${esc(story.id)}" onclick="openStory(this.dataset.storyId)"><div class="w-[66px] h-[66px] ${seen?'story-ring seen':'story-ring'}">${avatar}</div><span class="text-[10px] text-white/75">${esc(story.name)}</span></button>`;
  }).join('');
}
function openStory(id){
  const s=DB.stories.find(x=>x.id===id);if(!s||!s.images||!s.images.length)return;
  DB.storyUser=s;DB.storyIdx=0;
  document.getElementById('story-viewer').classList.add('on');
  showStoryFrame();
}
function showStoryFrame(){
  const s=DB.storyUser;if(!s)return;
  clearTimeout(DB.storyTimer);
  document.getElementById('sv-av').src=s.avatar||'';
  document.getElementById('sv-name').textContent=s.name;
  const storyImg=document.getElementById('sv-img'),storyIndex=DB.storyIdx,storyRef=s.images[storyIndex];
  storyImg.removeAttribute('src');
  resolveMediaURL(storyRef).then(url=>{if(DB.storyUser===s&&DB.storyIdx===storyIndex)storyImg.src=url}).catch(()=>{storyImg.alt='Фото недоступно'});
  document.getElementById('sv-bars').innerHTML=s.images.map((_,i)=>`<div class="sv-bar"><div class="sv-fill" id="sf${i}" style="width:${i<DB.storyIdx?'100%':'0%'}"></div></div>`).join('');
  requestAnimationFrame(()=>{const f=document.getElementById('sf'+DB.storyIdx);if(f){f.style.transition='width 4s linear';f.style.width='100%'}});
  DB.storyTimer=setTimeout(nextStory,4000);
}
function nextStory(){
  const s=DB.storyUser;if(!s)return;
  if(DB.storyIdx<s.images.length-1){DB.storyIdx++;showStoryFrame()}
  else{DB.seenStories[s.id]=true;save();closeStory();renderStories()}
}
function prevStory(){const s=DB.storyUser;if(!s)return;if(DB.storyIdx>0){DB.storyIdx--;showStoryFrame()}}
function closeStory(){clearTimeout(DB.storyTimer);document.getElementById('story-viewer').classList.remove('on');DB.storyUser=null}
function renderFeed(){
  const feed=document.getElementById('feed');
  const visiblePosts=DB.posts.filter(p=>!p.authorKey||!DB.blocked?.[p.authorKey]);
  if(!visiblePosts.length){feed.innerHTML='<div class="empty">Лента пуста. Создайте первый пост.</div>';return}
  feed.innerHTML=visiblePosts.map(p=>{
    const images=Array.isArray(p.images)&&p.images.length?p.images:(p.image?[p.image]:[]);
    const gallery=images.length?images.map(src=>{
      const source=src.startsWith('idb:')?(`data-media-ref="${src}"`):(`src="${esc(src)}"`);
      return `<img ${source} class="w-full min-w-full h-[250px] object-cover snap-center" loading="lazy" alt="Фото публикации">`;
    }).join(''):'<div class="w-full h-[250px] flex items-center justify-center bg-[#dedee3] text-black/35 text-sm">Публикация без фото</div>';
    return `
    <article class="post-card relative" data-id="${p.id}">
      <div class="p-1.5"><div class="relative rounded-[22px] overflow-hidden bg-[#e4e4e8]" ondblclick="doubleLike('${p.id}',this)">
        <div class="flex w-full overflow-x-auto ns snap-x snap-mandatory">${gallery}</div>
        ${images.length>1?`<span class="absolute top-2.5 right-2.5 glass rounded-full px-2 py-1 text-[10px] font-semibold text-white">${images.length} фото · листайте</span>`:''}
        <div class="heart-burst"><svg width="72" height="72" viewBox="0 0 24 24" fill="#ef4444"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none"></div>
        <button class="absolute top-2.5 left-2.5 flex items-center gap-1.5 press" onclick="event.stopPropagation();${p.authorKey?`go('profile',{key:'${p.authorKey}'})`:`toast('${esc(p.author)}')`}">
          <img src="${esc(p.avatar)}" class="w-7 h-7 rounded-full object-cover ring-1 ring-white/50" onerror="this.style.opacity=0">
          <span class="text-[12px] font-semibold text-white drop-shadow">${esc(p.author)}</span>
        </button>
        <div class="absolute bottom-2.5 left-2.5 flex gap-1.5">
          <button class="flex items-center gap-1 glass rounded-full px-2.5 py-1 press" onclick="toggleLike('${p.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${p.liked?'#ef4444':'none'}" stroke="${p.liked?'#ef4444':'#fff'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="text-[11px] font-semibold text-white">${fmt(p.likes)}</span>
          </button>
          <button class="flex items-center gap-1 glass rounded-full px-2.5 py-1 press" onclick="openComments('${p.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="text-[11px] font-semibold text-white">${p.comments}</span>
          </button>
        </div>
        <button class="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full glass flex items-center justify-center press" onclick="toggleSave('${p.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${p.saved?'#fff':'none'}" stroke="#fff" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div></div>
      <div class="px-3.5 pt-1 pb-3.5">
        <p class="text-[12.5px] font-semibold text-black">${esc(p.author)}</p>
        <p class="text-[13px] text-black/70 mt-0.5 leading-snug">${esc(p.text)}</p>
        ${p.authorKey==='me'?`<button data-post-id="${esc(p.id)}" onclick="deletePost(this.dataset.postId)" class="mt-2 text-[10px] text-red-400/70 press">Удалить публикацию</button>`:`<button data-report-id="${esc(p.id)}" onclick="openReport('post',this.dataset.reportId)" class="mt-2 text-[10px] text-black/35 press">Пожаловаться</button>`}
      </div>
    </article>`;
  }).join('');
  hydrateMediaImages(feed);
}
function deletePost(id){const post=DB.posts.find(item=>item.id===id);if(!post||post.authorKey!=='me')return;const refs=[...(post.images||[]),post.image].filter(Boolean);DB.posts=DB.posts.filter(item=>item.id!==id);DB.channels.forEach(channel=>{channel.posts=(channel.posts||[]).filter(item=>item.id!==id)});save();refs.forEach(ref=>void cleanupMedia(ref));renderFeed();toast('Публикация удалена локально')}
function doubleLike(id){
 const p=DB.posts.find(x=>x.id===id);if(!p)return;
 if(!p.liked){p.liked=true;p.likes++}
 save();renderFeed();
 const card=[...document.querySelectorAll('.post-card')].find(node=>node.dataset.id===id);
 const burst=card&&card.querySelector('.heart-burst');
 if(burst){burst.classList.remove('show');void burst.offsetWidth;burst.classList.add('show')}
}
function toggleLike(id){const p=DB.posts.find(x=>x.id===id);if(!p)return;p.liked=!p.liked;p.likes+=p.liked?1:-1;save();renderFeed()}
function toggleSave(id){const p=DB.posts.find(x=>x.id===id);if(!p)return;p.saved=!p.saved;save();toast(p.saved?'Сохранено':'Убрано');renderFeed()}
function openComments(id){DB.activePost=id;const p=DB.posts.find(x=>x.id===id);document.getElementById('clist-c').innerHTML=(p.commentList||[]).map(c=>`<div class="flex gap-2.5"><div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[12px] font-semibold">${c.user[0]}</div><div><p class="text-[12.5px] font-semibold">${esc(c.user)}</p><p class="text-[13px] text-white/65">${esc(c.text)}</p></div></div>`).join('')||'<p class="empty">Нет комментариев — будьте первым</p>';document.getElementById('bd').classList.add('open');document.getElementById('comments-sheet').classList.add('open');setNav(false)}
function addCm(){const inp=document.getElementById('cminput');const t=inp.value.trim();if(!t||!DB.activePost)return;const p=DB.posts.find(x=>x.id===DB.activePost);p.commentList.push({user:'Вы',text:t});p.comments++;inp.value='';save();openComments(p.id);renderFeed()}
function renderSaved(){
  const list=DB.posts.filter(p=>p.saved);
  const box=document.getElementById('saved-list');
  box.innerHTML=list.length?list.map(p=>{
    const src=(Array.isArray(p.images)&&p.images[0])||p.image||'';
    const image=src?(src.startsWith('idb:')?`<img data-media-ref="${src}" class="w-full h-[200px] object-cover rounded-[20px]" alt="Фото">`:`<img src="${src}" class="w-full h-[200px] object-cover rounded-[20px]" alt="Фото">`):'';
    return `<article class="post-card"><div class="p-1.5">${image}</div>
      <div class="px-3.5 pb-3"><p class="text-[12.5px] font-semibold text-black">${esc(p.author)}</p><p class="text-[13px] text-black/70">${esc(p.text)}</p>
      <button class="mt-2 text-[12px] text-black/40 press" onclick="toggleSave('${p.id}');renderSaved()">Убрать</button></div></article>`;
  }).join(''):'<div class="empty">Пока ничего не сохранено.<br>Нажмите закладку на посте.</div>';
  hydrateMediaImages(box);
}
function openProfile(key){
  const pr=DB.profiles[key];if(!pr)return;if(DB.blocked?.[key]){toast('Этот профиль заблокирован на устройстве');return}
  document.getElementById('prof-hero').style.backgroundImage=`url('${pr.hero}')`;
  document.getElementById('prof-name').textContent=pr.name;
  document.getElementById('prof-handle').textContent=pr.handle;
  document.getElementById('prof-bio').textContent=pr.bio;
  document.getElementById('prof-stats').innerHTML=`<div class="text-center"><p class="text-[20px] font-bold">${pr.following}</p><p class="text-[11px] text-white/45">Подписки</p></div><div class="text-center"><p class="text-[20px] font-bold">${pr.followers}</p><p class="text-[11px] text-white/45">Подписчики</p></div><div class="text-center"><p class="text-[20px] font-bold">${pr.posts}</p><p class="text-[11px] text-white/45">Посты</p></div>`;
  const fol=!!DB.following[key];
  document.getElementById('prof-actions').innerHTML=`<button class="flex-1 max-w-[200px] h-11 rounded-full ${fol?'glass text-white':'bg-white text-black'} font-semibold text-[14px] press" onclick="toggleFollow('${key}')">${fol?'Вы подписаны':'Подписаться'}</button><button data-profile-key="${esc(key)}" onclick="openReport('profile',this.dataset.profileKey)" class="px-3 h-11 rounded-full glass text-[12px] press">Пожаловаться</button><button onclick="go('messages')" class="w-11 h-11 rounded-full glass flex items-center justify-center press"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>`;
}
function toggleFollow(key){DB.following[key]=!DB.following[key];save();toast(DB.following[key]?'Подписка':'Отписка');openProfile(key)}
async function shareProfile(){
 const url=location.origin+location.pathname+'?profile='+encodeURIComponent(DB.me.handle.replace(/^@/,''));
 try{
  if(navigator.share){await navigator.share({title:DB.me.name,text:'Мой профиль',url});return}
  if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(url);toast('Ссылка скопирована');return}
  toast('Браузер не разрешил поделиться ссылкой');
 }catch(e){if(e&&e.name!=='AbortError')toast('Не удалось поделиться ссылкой')}
}
function renderMe(){
  document.getElementById('me-name').textContent=DB.me.name;
  setMediaSource(document.getElementById('me-avatar'),DB.me.avatar||'https://i.pravatar.cc/300?u=me');
  setMediaBackground(document.getElementById('me-hero'),DB.me.cover||'https://picsum.photos/seed/mehero/1200/1600');
  document.getElementById('me-handle').textContent=DB.me.handle;
  document.getElementById('me-bio').textContent=DB.me.bio;
  document.getElementById('me-posts').textContent=DB.posts.filter(p=>p.author==='Вы'||p.author===DB.me.name).length;
}
function openEditProfile(){
  DB.pendingAvatar=null;DB.pendingCover=null;
  document.getElementById('edit-name').value=DB.me.name;
  document.getElementById('edit-handle').value=DB.me.handle;
  document.getElementById('edit-bio').value=DB.me.bio;
  const avatarPreview=document.getElementById('edit-avatar-preview'),coverPreview=document.getElementById('edit-cover-preview');
  avatarPreview.hidden=false;coverPreview.hidden=false;setMediaSource(avatarPreview,DB.me.avatar||'https://i.pravatar.cc/300?u=me');setMediaSource(coverPreview,DB.me.cover||'https://picsum.photos/seed/mehero/1200/1600');
  document.getElementById('bd').classList.add('open');
  document.getElementById('edit-sheet').classList.add('open');
  setNav(false);
}
function saveProfile(){
  DB.me.name=document.getElementById('edit-name').value.trim()||'Вы';
  DB.me.handle=document.getElementById('edit-handle').value.trim()||'@you';
  if(!DB.me.handle.startsWith('@'))DB.me.handle='@'+DB.me.handle;
  DB.me.bio=document.getElementById('edit-bio').value.trim()||'';
  DB.me.avatar=DB.pendingAvatar||DB.me.avatar||'https://i.pravatar.cc/300?u=me';DB.me.cover=DB.pendingCover||DB.me.cover||'https://picsum.photos/seed/mehero/1200/1600';DB.pendingAvatar=null;DB.pendingCover=null;
  save();closeSheet();renderMe();toast('Профиль сохранён');
}
function setMediaBackground(element,ref){
  if(!element)return;
  if(ref&&ref.startsWith('idb:'))resolveMediaURL(ref).then(url=>{element.style.backgroundImage='url("'+url+'")'}).catch(()=>{});
  else element.style.backgroundImage=ref?'url("'+ref+'")':'';
}
function chooseProfileAvatar(){document.getElementById('edit-avatar-file').click()}
function chooseProfileCover(){document.getElementById('edit-cover-file').click()}
async function handleProfileAvatar(input){
  const file=input.files?.[0];input.value='';
  if(!file||!file.type.startsWith('image/')||file.size>20*1024*1024){toast('Выберите фото до 20 МБ');return}
  try{DB.pendingAvatar=await saveMediaFile(file);const preview=document.getElementById('edit-avatar-preview');preview.hidden=false;setMediaSource(preview,DB.pendingAvatar)}
  catch(e){toast(e.message||'Не удалось сохранить фото')}
}
async function handleProfileCover(input){
  const file=input.files?.[0];input.value='';
  if(!file||!file.type.startsWith('image/')||file.size>20*1024*1024){toast('Выберите обложку до 20 МБ');return}
  try{DB.pendingCover=await saveMediaFile(file);const preview=document.getElementById('edit-cover-preview');preview.hidden=false;setMediaSource(preview,DB.pendingCover)}
  catch(e){toast(e.message||'Не удалось сохранить обложку')}
}
function setMediaSource(img,ref){
  if(!img)return;
  if(ref&&ref.startsWith('idb:')){
    img.removeAttribute('src');img.dataset.mediaRef=ref;
    resolveMediaURL(ref).then(url=>{img.src=url}).catch(()=>{img.alt='Изображение недоступно'});
  }else{delete img.dataset.mediaRef;img.src=ref||''}
}
function openChannel(id){
  const ch=DB.channels.find(c=>c.id===id);if(!ch)return;DB.activeChannel=id;
  setMediaSource(document.getElementById('ch-cover'),ch.cover);
  setMediaSource(document.getElementById('ch-av'),ch.avatar);
  document.getElementById('ch-name').textContent=ch.name;
  document.getElementById('ch-meta').textContent=(ch.members||'0')+' подписчиков';
  document.getElementById('ch-desc').textContent=ch.desc;
  const owner=ch.ownerKey==='me';
  const sub=!!DB.channelSub[id];
  const btn=document.getElementById('ch-sub');
  btn.hidden=owner;
  btn.textContent=sub?'Вы подписаны':'Подписаться';
  btn.className=sub?'w-full h-10 rounded-full glass text-white font-semibold text-[14px] press mb-3':'w-full h-10 rounded-full bg-white text-black font-semibold text-[14px] press mb-3';
  document.getElementById('ch-new-post').hidden=!owner;
  document.getElementById('ch-edit').hidden=!owner;
  const local=DB.posts.filter(p=>p.channelId===id).map(p=>{
    const ref=(p.images&&p.images[0])||p.image||'';
    const image=ref?(ref.startsWith('idb:')?`<img data-media-ref="${esc(ref)}" class="w-full h-[180px] object-cover" alt="Фото публикации">`:`<img src="${esc(ref)}" class="w-full h-[180px] object-cover" alt="Фото публикации">`):'';
    return `<article class="rounded-2xl overflow-hidden bg-[#141416] border border-white/5">${image}<div class="p-3.5"><h3 class="text-[15px] font-semibold">${esc(p.author)}</h3><p class="text-[12.5px] text-white/55 mt-1">${esc(p.text)}</p><p class="text-[11px] text-white/35 mt-2">♥ ${fmt(p.likes)}</p></div></article>`;
  });
  const seeded=(ch.posts||[]).map(p=>`<article class="rounded-2xl overflow-hidden bg-[#141416] border border-white/5"><img src="${esc(p.image)}" class="w-full h-[160px] object-cover" alt=""><div class="p-3.5"><h3 class="text-[15px] font-semibold">${esc(p.title)}</h3><p class="text-[12.5px] text-white/50 mt-1">${esc(p.text)}</p><p class="text-[11px] text-white/35 mt-2">♥ ${p.likes}</p></div></article>`);
  const box=document.getElementById('ch-posts');
  box.innerHTML=[...local,...seeded].join('')||'<div class="empty">Пока нет публикаций. Создайте первую.</div>';
  hydrateMediaImages(box);
}
function chooseChannelCover(){document.getElementById('channel-cover-input').click()}
async function handleChannelCover(input){
  const file=input.files?.[0];input.value='';
  if(!file||!file.type.startsWith('image/')||file.size>20*1024*1024){toast('Выберите изображение до 20 МБ');return}
  try{
    DB.pendingChannelCover=await saveMediaFile(file);
    const preview=document.getElementById('channel-cover-preview');preview.hidden=false;setMediaSource(preview,DB.pendingChannelCover);
  }catch(e){toast(e.message||'Не удалось сохранить обложку')}
}
function openChannelEdit(){
  const ch=DB.channels.find(channel=>channel.id===DB.activeChannel);if(ch?.ownerKey!=='me')return;
  DB.editingChannelId=ch.id;DB.pendingChannelCover=ch.cover||null;
  document.getElementById('new-channel-name').value=ch.name;document.getElementById('new-channel-desc').value=ch.desc||'';document.getElementById('new-channel-visibility').value=ch.visibility||'public';
  const preview=document.getElementById('channel-cover-preview');preview.hidden=!ch.cover;if(ch.cover)setMediaSource(preview,ch.cover);
  document.getElementById('channel-create-title').textContent='Настройки канала';document.getElementById('channel-save-btn').textContent='Сохранить изменения';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('channel-create-sheet').classList.add('open');setNav(false);
}
function createChannel(){
  const name=document.getElementById('new-channel-name').value.trim();
  const desc=document.getElementById('new-channel-desc').value.trim();
  const visibility=document.getElementById('new-channel-visibility').value;
  if(name.length<2){toast('Название канала должно быть длиннее');return}
  if(DB.editingChannelId){
    const channel=DB.channels.find(item=>item.id===DB.editingChannelId);if(!channel){toast('Канал не найден');return}
    channel.name=name;channel.desc=desc;channel.visibility=visibility;channel.cover=DB.pendingChannelCover||channel.cover;
    const id=channel.id;DB.editingChannelId=null;DB.pendingChannelCover=null;save();closeSheet();go('channel',{id});toast('Настройки канала сохранены локально');return;
  }
  const id='ch'+Date.now();
  const channel={id,name,desc,visibility,members:'1',ownerKey:'me',cover:DB.pendingChannelCover||'https://picsum.photos/seed/'+id+'cover/900/420',avatar:'https://picsum.photos/seed/'+id+'avatar/200/200',posts:[]};
  DB.channels.unshift(channel);DB.channelSub[id]=true;DB.pendingChannelCover=null;save();closeSheet();go('channel',{id});toast('Канал создан · сохранён на устройстве');
}
function openChannelPost(){if(!DB.activeChannel)return;go('compose',{channelId:DB.activeChannel})}
function toggleChSub(){if(!DB.activeChannel)return;const ch=DB.channels.find(c=>c.id===DB.activeChannel);if(ch?.ownerKey==='me')return;DB.channelSub[DB.activeChannel]=!DB.channelSub[DB.activeChannel];save();toast(DB.channelSub[DB.activeChannel]?'Подписка на канал':'Отписались');openChannel(DB.activeChannel)}
function openShop(id){
  const sh=DB.shops.find(s=>s.id===id);if(!sh)return;DB.activeShop=id;
  document.getElementById('sh-name').textContent=sh.name;
  document.getElementById('sh-meta').textContent=(sh.ownerKey==='me'?(sh.items.length+' товаров · ваш магазин'):(sh.products+' товаров'));
  document.getElementById('sh-desc').textContent=sh.desc;
  document.getElementById('sh-add-product').hidden=sh.ownerKey!=='me';
  document.getElementById('sh-edit-shop').hidden=sh.ownerKey!=='me';
  const grid=document.getElementById('sh-grid');
  grid.innerHTML=sh.items.length?sh.items.map(i=>{
    const source=i.image&&i.image.startsWith('idb:')?`data-media-ref="${esc(i.image)}"`:`src="${esc(i.image||'')}"`;
    return `<button class="rounded-2xl overflow-hidden bg-[#141416] border border-white/5 text-left press" onclick="openProduct('${esc(sh.id)}','${esc(i.id)}')"><img ${source} class="w-full aspect-square object-cover" alt="${esc(i.name)}"><div class="p-2.5"><p class="text-[12.5px] font-semibold truncate">${esc(i.name)}</p><p class="text-[13px] font-bold mt-0.5">${Number(i.price).toLocaleString('ru-RU')} ₽</p></div></button>`;
  }).join(''):'<div class="empty col-span-2">В магазине пока нет товаров.</div>';
  hydrateMediaImages(grid);updateCartBadge();
}
function openShopCreate(){
  DB.editingShopId=null;document.getElementById('shop-create-title').textContent='Новый магазин';document.getElementById('shop-save-btn').textContent='Создать магазин';
  document.getElementById('new-shop-name').value='';
  document.getElementById('new-shop-desc').value='';
  document.getElementById('new-shop-visibility').value='public';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('shop-create-sheet').classList.add('open');setNav(false);
}
function openShopEdit(){
  const sh=DB.shops.find(shop=>shop.id===DB.activeShop);if(sh?.ownerKey!=='me')return;
  DB.editingShopId=sh.id;document.getElementById('new-shop-name').value=sh.name;document.getElementById('new-shop-desc').value=sh.desc||'';document.getElementById('new-shop-visibility').value=sh.visibility||'public';
  document.getElementById('shop-create-title').textContent='Настройки магазина';document.getElementById('shop-save-btn').textContent='Сохранить изменения';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('shop-create-sheet').classList.add('open');setNav(false);
}
function createShop(){
  const name=document.getElementById('new-shop-name').value.trim();
  const desc=document.getElementById('new-shop-desc').value.trim();
  const visibility=document.getElementById('new-shop-visibility').value;
  if(name.length<2){toast('Название магазина должно быть длиннее');return}
  if(DB.editingShopId){
    const shop=DB.shops.find(item=>item.id===DB.editingShopId);if(!shop){toast('Магазин не найден');return}
    shop.name=name;shop.desc=desc;shop.visibility=visibility;const id=shop.id;DB.editingShopId=null;save();closeSheet();go('shop',{id});toast('Настройки магазина сохранены локально');return;
  }
  const id='sh'+Date.now();
  DB.shops.unshift({id,name,desc,visibility,ownerKey:'me',products:0,items:[]});
  save();closeSheet();go('shop',{id});toast('Магазин создан · сохранён на устройстве');
}
function openProductCreate(){
  if(!DB.activeShop)return;
  const sh=DB.shops.find(s=>s.id===DB.activeShop);if(sh?.ownerKey!=='me'){toast('Добавлять товары может владелец');return}
  DB.pendingProductImage=null;DB.editingProductId=null;
  document.getElementById('product-create-title').textContent='Новый товар';document.getElementById('product-save-btn').textContent='Добавить товар';
  ['new-product-name','new-product-price','new-product-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('product-image-preview').hidden=true;
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('product-create-sheet').classList.add('open');setNav(false);
}
function chooseProductImage(){document.getElementById('product-file-input').click()}
async function handleProductFile(input){
  const file=input.files?.[0];input.value='';
  if(!file||!file.type.startsWith('image/')||file.size>20*1024*1024){toast('Выберите изображение до 20 МБ');return}
  try{
    DB.pendingProductImage=await saveMediaFile(file);
    const preview=document.getElementById('product-image-preview');preview.hidden=false;setMediaSource(preview,DB.pendingProductImage);
  }catch(e){toast(e.message||'Не удалось сохранить изображение')}
}
function openProductEdit(){
  const active=DB.activeProduct;if(!active)return;const sh=DB.shops.find(s=>s.id===active.shopId);if(sh?.ownerKey!=='me')return;
  DB.editingProductId=active.item.id;DB.pendingProductImage=active.item.image||null;
  document.getElementById('new-product-name').value=active.item.name;document.getElementById('new-product-price').value=String(active.item.price);document.getElementById('new-product-desc').value=active.item.desc||'';
  const preview=document.getElementById('product-image-preview');preview.hidden=!active.item.image;if(active.item.image)setMediaSource(preview,active.item.image);
  document.getElementById('product-create-title').textContent='Редактировать товар';document.getElementById('product-save-btn').textContent='Сохранить изменения';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('product-create-sheet').classList.add('open');setNav(false);
}
function deleteProduct(){
  const active=DB.activeProduct;if(!active)return;const sh=DB.shops.find(s=>s.id===active.shopId);if(sh?.ownerKey!=='me')return;
  sh.items=sh.items.filter(item=>item.id!==active.item.id);sh.products=sh.items.length;DB.activeProduct=null;save();closeSheet();openShop(sh.id);toast('Товар удалён');
}
function createProduct(){
  const sh=DB.shops.find(s=>s.id===DB.activeShop);
  if(!sh||sh.ownerKey!=='me'){toast('Магазин недоступен');return}
  const name=document.getElementById('new-product-name').value.trim();
  const price=Number(document.getElementById('new-product-price').value.replace(',','.'));
  const desc=document.getElementById('new-product-desc').value.trim();
  if(name.length<2||!Number.isFinite(price)||price<=0){toast('Проверьте название и цену');return}
  if(DB.editingProductId){
    const item=sh.items.find(product=>product.id===DB.editingProductId);if(!item){toast('Товар не найден');return}
    item.name=name;item.price=price;item.desc=desc;item.image=DB.pendingProductImage||item.image;
  }else{sh.items.unshift({id:'item'+Date.now(),name,price,desc,image:DB.pendingProductImage||'https://picsum.photos/seed/new-product/600/600'})}
  sh.products=sh.items.length;DB.pendingProductImage=null;DB.editingProductId=null;save();closeSheet();openShop(sh.id);toast('Изменения сохранены локально');
}
function openProduct(sid,iid){
  const sh=DB.shops.find(s=>s.id===sid);const item=sh?.items.find(i=>i.id===iid);if(!item)return;
  DB.activeProduct={shopId:sid,item};
  const source=item.image&&item.image.startsWith('idb:')?`<img data-media-ref="${esc(item.image)}" class="w-full aspect-square object-cover rounded-2xl mb-3" alt="${esc(item.name)}">`:`<img src="${esc(item.image||'')}" class="w-full aspect-square object-cover rounded-2xl mb-3" alt="${esc(item.name)}">`;
  document.getElementById('pdetail').innerHTML=`${source}<h3 class="text-[20px] font-bold">${esc(item.name)}</h3><p class="text-[18px] font-bold mt-1 gt">${Number(item.price).toLocaleString('ru-RU')} ₽</p><p class="text-[13px] text-white/55 mt-2">${esc(item.desc)}</p>`;
  hydrateMediaImages(document.getElementById('pdetail'));
  document.getElementById('pfoot').innerHTML=sh.ownerKey==='me'?'<div class="flex gap-2"><button onclick="openProductEdit()" class="flex-1 h-11 rounded-full bg-white text-black font-semibold text-[13px] press">Изменить</button><button onclick="deleteProduct()" class="px-4 h-11 rounded-full bg-red-500/15 text-red-300 font-semibold text-[13px] press">Удалить</button></div>':`<button onclick="addToCart()" class="w-full h-11 rounded-full bg-white text-black font-semibold text-[14px] press">В корзину</button>`;
  document.getElementById('bd').classList.add('open');document.getElementById('product-sheet').classList.add('open');setNav(false);
}
function addToCart(){if(!DB.activeProduct)return;const {item}=DB.activeProduct;const ex=DB.cart.find(c=>c.id===item.id);if(ex)ex.qty++;else DB.cart.push({...item,qty:1});save();updateCartBadge();toast('В корзине');closeSheet()}
function updateCartBadge(){const n=DB.cart.reduce((s,c)=>s+c.qty,0);const b=document.getElementById('cart-n');if(n){b.textContent=n;b.classList.remove('hidden')}else b.classList.add('hidden')}
function openCart(){
  const list=document.getElementById('cart-list');
  if(!DB.cart.length){list.innerHTML='<div class="empty">Корзина пуста</div>';document.getElementById('cart-foot').innerHTML=''}
  else{
    list.innerHTML=DB.cart.map(item=>{
      const source=item.image&&item.image.startsWith('idb:')?`data-media-ref="${esc(item.image)}"`:`src="${esc(item.image||'')}"`;
      return `<div class="flex gap-2.5 items-center"><img ${source} class="w-14 h-14 rounded-xl object-cover"><div class="flex-1"><p class="text-[13px] font-semibold">${esc(item.name)}</p><p class="text-[12px] text-white/50">${Number(item.price).toLocaleString('ru-RU')} ₽ × ${Number(item.qty)}</p></div><button class="text-white/40 text-[11px] press" data-cart-id="${esc(item.id)}" onclick="rmCart(this.dataset.cartId)">✕</button></div>`;
    }).join('');
    hydrateMediaImages(list);
    const total=DB.cart.reduce((sum,item)=>sum+Number(item.price)*Number(item.qty),0);
    document.getElementById('cart-foot').innerHTML=`<div class="flex justify-between mb-2.5"><span class="text-white/50 text-[13px]">Итого</span><span class="font-bold">${total.toLocaleString('ru-RU')} ₽</span></div><button onclick="checkout()" class="w-full h-11 rounded-full bg-white text-black font-semibold text-[14px] press">Оформить</button>`;
  }
  document.getElementById('bd').classList.add('open');document.getElementById('cart-sheet').classList.add('open');setNav(false);
}
function rmCart(id){DB.cart=DB.cart.filter(c=>c.id!==id);save();updateCartBadge();openCart()}
function checkout(){toast('Оформление заказов подключим вместе с сервером. Корзина сохранена.')}
function renderNotifs(){
  if(!DB.notifications.length){document.getElementById('nlist').innerHTML='<div class="empty">Нет уведомлений</div>';document.getElementById('ndot').style.display='none';return}
  document.getElementById('nlist').innerHTML=DB.notifications.map(n=>`<div class="flex gap-3 p-3 rounded-2xl ${n.read?'bg-white/[0.03]':'bg-white/[0.07]'} border border-white/[0.04]"><div class="w-11 h-11 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">${n.avatar?`<img src="${esc(n.avatar)}" class="w-full h-full object-cover">`:'🔔'}</div><div class="flex-1"><p class="text-[13px]"><span class="font-semibold">${esc(n.title)}</span> <span class="text-white/55">${esc(n.body)}</span></p><p class="text-[11px] text-white/35 mt-0.5">${esc(n.time)}</p></div></div>`).join('');
  document.getElementById('ndot').style.display=DB.notifications.some(n=>!n.read)?'':'none';
}
function markRead(){DB.notifications.forEach(n=>n.read=true);save();renderNotifs();toast('Прочитано')}
function openNewChat(){
  document.getElementById('chat-group-name').value='';
  document.getElementById('chat-people').innerHTML=Object.entries(DB.profiles).filter(([key])=>!DB.blocked?.[key]).map(([key,profile])=>`<option value="${esc(key)}">${esc(profile.name)} · ${esc(profile.handle)}</option>`).join('');
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('new-chat-sheet').classList.add('open');setNav(false);
}
function createChat(){
  const select=document.getElementById('chat-people');
  const keys=[...select.selectedOptions].map(option=>option.value);
  if(!keys.length){toast('Выбери хотя бы одного собеседника');return}
  const profiles=keys.map(key=>DB.profiles[key]).filter(Boolean);if(!profiles.length)return;
  if(keys.length===1){
    const existing=DB.chats.find(chat=>chat.profileKey===keys[0]);
    if(existing){closeSheet();go('chat',{chatId:existing.id});return}
  }
  const customName=document.getElementById('chat-group-name').value.trim();
  const name=customName||(profiles.length===1?profiles[0].name:profiles.map(profile=>profile.name).join(', '));
  const id='chat'+Date.now();
  const chat={id,name,avatar:'https://i.pravatar.cc/128?u='+encodeURIComponent(keys.join('-')),last:'Чат создан',time:'сейчас',unread:0,messages:[],profileKey:keys.length===1?keys[0]:null,profileKeys:keys};
  DB.chats.unshift(chat);save();closeSheet();go('chat',{chatId:id});toast('Чат создан локально');
}
function renderChats(){
  const q=(document.getElementById('csearch')?.value||'').toLowerCase();
  const list=DB.chats.filter(c=>!(c.profileKey&&DB.blocked?.[c.profileKey])&&!(c.profileKeys||[]).some(key=>DB.blocked?.[key])&&(!q||c.name.toLowerCase().includes(q)));
  document.getElementById('clist').innerHTML=list.length?list.map(c=>`<button class="w-full flex items-center gap-3 px-3 py-3 press text-left" data-chat-id="${esc(c.id)}" onclick="go('chat',{chatId:this.dataset.chatId})"><img src="${esc(c.avatar)}" class="w-12 h-12 rounded-full object-cover"><div class="flex-1 min-w-0"><div class="flex justify-between"><p class="text-[14px] font-semibold truncate">${esc(c.name)}</p><span class="text-[10px] text-white/35">${esc(c.time)}</span></div><p class="text-[12.5px] text-white/45 truncate">${esc(c.last)}</p></div>${c.unread?`<span class="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style="background:linear-gradient(135deg,#a855f7,#ec4899)">${Number(c.unread)}</span>`:''}</button>`).join(''):'<div class="empty">Нет чатов</div>';
  const unread=DB.chats.reduce((sum,c)=>sum+Number(c.unread||0),0);const badge=document.getElementById('mbadge');if(unread){badge.textContent=unread;badge.classList.remove('hidden')}else badge.classList.add('hidden');
}
function openChat(id){const c=DB.chats.find(x=>x.id===id);if(!c)return;if((c.profileKey&&DB.blocked?.[c.profileKey])||(c.profileKeys||[]).some(key=>DB.blocked?.[key])){toast('Чат недоступен из-за блокировки');go('messages');return}DB.activeChat=id;c.unread=0;save();document.getElementById('cv-av').src=c.avatar;document.getElementById('cv-name').textContent=c.name;const box=document.getElementById('cmsgs');box.innerHTML=c.messages.map(m=>`<div class="flex ${m.me?'justify-end':''}"><div class="max-w-[78%] px-3.5 py-2 text-[14px] ${m.me?'bubble-me':'bubble-them'}">${esc(m.text)}</div></div>`).join('');box.scrollTop=box.scrollHeight;renderChats()}
function sendMsg(){const inp=document.getElementById('cinput');const t=inp.value.trim();if(!t||!DB.activeChat)return;const c=DB.chats.find(x=>x.id===DB.activeChat);if(!c)return;if((c.profileKey&&DB.blocked?.[c.profileKey])||(c.profileKeys||[]).some(key=>DB.blocked?.[key])){toast('Нельзя отправить сообщение заблокированному пользователю');return}c.messages.push({me:true,text:t});c.last=t;c.time='сейчас';inp.value='';save();openChat(c.id)}
function openClipCreate(){
  DB.pendingClipVideo=null;document.getElementById('clip-caption').value='';document.getElementById('clip-preview').hidden=true;
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('clip-create-sheet').classList.add('open');setNav(false);
}
function chooseClipVideo(){document.getElementById('clip-file-input').click()}
async function handleClipVideo(input){
  const file=input.files?.[0];input.value='';
  if(!file||!file.type.startsWith('video/')||file.size>100*1024*1024){toast('Выберите видео до 100 МБ');return}
  try{
    DB.pendingClipVideo=await saveMediaFile(file);
    const preview=document.getElementById('clip-preview');preview.hidden=false;setMediaSource(preview,DB.pendingClipVideo);preview.controls=true;preview.muted=true;preview.playsInline=true;
  }catch(e){toast(e.message||'Не удалось сохранить видео')}
}
function createClip(){
  if(!DB.pendingClipVideo){toast('Сначала выберите видео');return}
  const caption=document.getElementById('clip-caption').value.trim();
  DB.clips.unshift({id:'clip'+Date.now(),author:DB.me.name,authorKey:'me',video:DB.pendingClipVideo,caption,likes:0,liked:false,createdAt:Date.now()});
  DB.pendingClipVideo=null;DB.etab='clips';save();closeSheet();go('explore');toast('Клип добавлен локально');
}
function renderClips(){
  const clips=DB.clips.filter(clip=>!clip.authorKey||!DB.blocked?.[clip.authorKey]);
  const box=document.getElementById('eres');
  box.innerHTML=clips.length?clips.map(clip=>{
    const video=clip.video.startsWith('idb:')?`data-media-ref="${esc(clip.video)}"`:`src="${esc(clip.video)}"`;
    return `<article class="relative rounded-[24px] overflow-hidden bg-[#111113] border border-white/[0.06] mb-4 max-w-[430px] mx-auto"><video ${video} class="w-full aspect-[9/16] max-h-[520px] object-cover bg-black" playsinline muted loop controls preload="metadata"></video><div class="px-4 py-3 flex items-start gap-3"><div class="flex-1 min-w-0"><p class="text-[13px] font-semibold">${esc(clip.author)}</p><p class="text-[13px] text-white/65 mt-1 break-words">${esc(clip.caption)}</p></div><div class="flex flex-col items-center gap-2"><button onclick="toggleClipLike('${esc(clip.id)}')" class="flex flex-col items-center gap-1 press"><span class="text-[21px]">${clip.liked?'♥':'♡'}</span><span class="text-[11px] text-white/50">${fmt(clip.likes)}</span></button>${clip.authorKey==='me'?`<button data-clip-id="${esc(clip.id)}" onclick="deleteClip(this.dataset.clipId)" class="text-[10px] text-red-300/70 press">Удалить</button>`:''}</div></div></article>`;
  }).join(''):'<div class="empty"><div class="text-3xl mb-3">▶</div><p class="font-semibold text-white mb-1">Твоя лента коротких видео</p><p class="text-[12px] text-white/40 mb-4">Добавляй вертикальные ролики и открывай новые истории</p><button onclick="openClipCreate()" class="px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-semibold">Добавить первый клип</button></div>';
  hydrateMediaImages(box);
}
function deleteClip(id){const clip=DB.clips.find(item=>item.id===id);if(!clip||clip.authorKey!=='me')return;DB.clips=DB.clips.filter(item=>item.id!==id);save();void cleanupMedia(clip.video);renderClips();toast('Клип удалён локально')}
function toggleClipLike(id){
  const clip=DB.clips.find(item=>item.id===id);if(!clip)return;
  clip.liked=!clip.liked;clip.likes=Math.max(0,clip.likes+(clip.liked?1:-1));save();renderClips();
}
function safeExternalUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}
}
function openExternalMedia(value){
  const url=safeExternalUrl(value);if(!url){toast('Нужна безопасная HTTPS-ссылка');return}
  window.open(url,'_blank','noopener,noreferrer');
}
function renderPlaylists(){
  const box=document.getElementById('eres');
  box.innerHTML=(DB.playlists||[]).length?DB.playlists.map(list=>`<button class="w-full text-left p-4 rounded-2xl bg-white/[0.04] border border-white/[0.05] mb-2 press" data-list-id="${esc(list.id)}" onclick="openPlaylist(this.dataset.listId)"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/20 flex items-center justify-center text-xl">♫</div><div class="min-w-0"><p class="text-[14px] font-semibold truncate">${esc(list.name)}</p><p class="text-[11px] text-white/40">${list.tracks.length} треков · ${list.visibility==='public'?'Публичный':'Приватный'}</p></div></div><p class="text-[12px] text-white/50 mt-2">${esc(list.desc||'')}</p></button>`).join(''):'<div class="empty"><div class="text-3xl mb-3">♫</div><p class="font-semibold text-white mb-1">Твоя музыкальная библиотека</p><p class="text-[12px] text-white/40 mb-4">Собирай плейлисты и открывай музыку у лицензированных сервисов</p><button onclick="openPlaylistCreate()" class="px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-semibold">Создать плейлист</button></div>';
  if((DB.playlists||[]).length)box.innerHTML+='<button onclick="openPlaylistCreate()" class="w-full py-3 rounded-2xl glass text-[13px] text-white/75 press">＋ Новый плейлист</button>';
}
function openPlaylist(id){
  const list=DB.playlists.find(item=>item.id===id);if(!list)return;DB.activePlaylist=id;
  const box=document.getElementById('eres');
  box.innerHTML=`<button onclick="DB.etab='music';renderExplore()" class="text-[12px] text-white/45 mb-3">← Все плейлисты</button><div class="p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-white/[0.06] mb-3"><p class="text-[20px] font-bold">${esc(list.name)}</p><p class="text-[12px] text-white/50 mt-1">${esc(list.desc||'')}</p><p class="text-[11px] text-white/35 mt-2">${list.tracks.length} треков</p></div>`+
    (list.ownerKey==='me'?'<button onclick="openTrackCreate()" class="w-full py-3 rounded-xl bg-white text-black font-semibold text-[13px] mb-3 press">＋ Добавить трек</button>':'')+
    (list.tracks.length?list.tracks.map((track,index)=>`<div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] mb-1.5"><div class="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm">${index+1}</div><div class="flex-1 min-w-0"><p class="text-[13px] font-semibold truncate">${esc(track.title)}</p><p class="text-[11px] text-white/40 truncate">${esc(track.artist)} · ${esc(track.provider)}</p></div><button data-url="${esc(track.url)}" onclick="openExternalMedia(this.dataset.url)" class="px-3 py-2 rounded-full glass text-[11px] press">Открыть</button></div>`).join(''):'<div class="empty">В плейлисте пока нет треков</div>');
}
function openPlaylistCreate(){
  document.getElementById('playlist-name').value='';document.getElementById('playlist-desc').value='';document.getElementById('playlist-visibility').value='private';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('playlist-create-sheet').classList.add('open');setNav(false);
}
function createPlaylist(){
  const name=document.getElementById('playlist-name').value.trim(),desc=document.getElementById('playlist-desc').value.trim(),visibility=document.getElementById('playlist-visibility').value;
  if(name.length<2){toast('Добавь название плейлиста');return}
  const id='pl'+Date.now();DB.playlists.unshift({id,name,desc,visibility,ownerKey:'me',tracks:[]});save();closeSheet();DB.etab='music';go('explore');openPlaylist(id);toast('Плейлист создан локально');
}
function openTrackCreate(){
  if(!DB.activePlaylist)return;
  ['track-title','track-artist','track-url'].forEach(id=>document.getElementById(id).value='');document.getElementById('track-provider').value='spotify';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('track-create-sheet').classList.add('open');setNav(false);
}
function createTrack(){
  const list=DB.playlists.find(item=>item.id===DB.activePlaylist);if(!list||list.ownerKey!=='me')return;
  const title=document.getElementById('track-title').value.trim(),artist=document.getElementById('track-artist').value.trim(),url=safeExternalUrl(document.getElementById('track-url').value.trim()),provider=document.getElementById('track-provider').value;
  if(title.length<1||!url){toast('Укажи название и HTTPS-ссылку на трек');return}
  list.tracks.push({id:'tr'+Date.now(),title,artist,provider,url});save();closeSheet();openPlaylist(list.id);toast('Трек добавлен');
}
function renderWatchlists(){
  const box=document.getElementById('eres');
  box.innerHTML=(DB.watchlists||[]).length?DB.watchlists.map(list=>`<button class="w-full text-left p-4 rounded-2xl bg-white/[0.04] border border-white/[0.05] mb-2 press" data-list-id="${esc(list.id)}" onclick="openWatchlist(this.dataset.listId)"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500/30 to-indigo-500/20 flex items-center justify-center text-xl">▣</div><div class="min-w-0"><p class="text-[14px] font-semibold truncate">${esc(list.name)}</p><p class="text-[11px] text-white/40">${list.items.length} фильмов и сериалов · ${list.visibility==='public'?'Публичная':'Приватная'}</p></div></div><p class="text-[12px] text-white/50 mt-2">${esc(list.desc||'')}</p></button>`).join(''):'<div class="empty"><div class="text-3xl mb-3">▣</div><p class="font-semibold text-white mb-1">Твой список просмотра</p><p class="text-[12px] text-white/40 mb-4">Сохраняй фильмы, сериалы и официальные ссылки на площадки</p><button onclick="openWatchlistCreate()" class="px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-semibold">Создать подборку</button></div>';
  if((DB.watchlists||[]).length)box.innerHTML+='<button onclick="openWatchlistCreate()" class="w-full py-3 rounded-2xl glass text-[13px] text-white/75 press">＋ Новая подборка</button>';
}
function openWatchlist(id){
  const list=DB.watchlists.find(item=>item.id===id);if(!list)return;DB.activeWatchlist=id;
  const box=document.getElementById('eres');
  box.innerHTML=`<button onclick="DB.etab='cinema';renderExplore()" class="text-[12px] text-white/45 mb-3">← Все подборки</button><div class="p-4 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/10 border border-white/[0.06] mb-3"><p class="text-[20px] font-bold">${esc(list.name)}</p><p class="text-[12px] text-white/50 mt-1">${esc(list.desc||'')}</p><p class="text-[11px] text-white/35 mt-2">${list.items.length} позиций</p></div>`+
    (list.ownerKey==='me'?'<button onclick="openWatchlistItemCreate()" class="w-full py-3 rounded-xl bg-white text-black font-semibold text-[13px] mb-3 press">＋ Добавить фильм или сериал</button>':'')+
    (list.items.length?list.items.map(item=>`<div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] mb-1.5"><div class="w-10 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm">▣</div><div class="flex-1 min-w-0"><p class="text-[13px] font-semibold truncate">${esc(item.title)}</p><p class="text-[11px] text-white/40 truncate">${esc(item.mediaType)} · ${esc(item.provider)} · ${esc(item.status)}</p></div><button data-url="${esc(item.url)}" onclick="openExternalMedia(this.dataset.url)" class="px-3 py-2 rounded-full glass text-[11px] press">Смотреть</button></div>`).join(''):'<div class="empty">В подборке пока нет фильмов</div>');
}
function openWatchlistCreate(){
  document.getElementById('watchlist-name').value='';document.getElementById('watchlist-desc').value='';document.getElementById('watchlist-visibility').value='private';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('watchlist-create-sheet').classList.add('open');setNav(false);
}
function createWatchlist(){
  const name=document.getElementById('watchlist-name').value.trim(),desc=document.getElementById('watchlist-desc').value.trim(),visibility=document.getElementById('watchlist-visibility').value;
  if(name.length<2){toast('Добавь название подборки');return}
  const id='wl'+Date.now();DB.watchlists.unshift({id,name,desc,visibility,ownerKey:'me',items:[]});save();closeSheet();DB.etab='cinema';go('explore');openWatchlist(id);toast('Подборка создана локально');
}
function openWatchlistItemCreate(){
  if(!DB.activeWatchlist)return;
  ['watch-item-title','watch-item-url'].forEach(id=>document.getElementById(id).value='');document.getElementById('watch-item-type').value='movie';document.getElementById('watch-item-provider').value='kinopoisk';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('watch-item-create-sheet').classList.add('open');setNav(false);
}
function createWatchlistItem(){
  const list=DB.watchlists.find(item=>item.id===DB.activeWatchlist);if(!list||list.ownerKey!=='me')return;
  const title=document.getElementById('watch-item-title').value.trim(),url=safeExternalUrl(document.getElementById('watch-item-url').value.trim()),mediaType=document.getElementById('watch-item-type').value,provider=document.getElementById('watch-item-provider').value;
  if(title.length<1||!url){toast('Укажи название и HTTPS-ссылку на площадку');return}
  list.items.push({id:'wi'+Date.now(),title,url,mediaType,provider,status:'want_to_watch'});save();closeSheet();openWatchlist(list.id);toast('Добавлено в подборку');
}
function openHealthVault(){
  const api=window.NEXUS_HEALTH_VAULT;if(!api?.isReady()){toast('Защищённое хранилище ещё загружается');return}
  const create=!api.hasVault();
  document.getElementById('health-vault-title').textContent=create?'Создать личный сейф':'Разблокировать сейф';
  document.getElementById('health-vault-copy').textContent=create?'Задай отдельную парольную фразу минимум из 12 символов. Старые локальные записи тренировок и питания будут перенесены в зашифрованное хранилище.':'Введи парольную фразу, чтобы расшифровать личные записи на этом устройстве.';
  document.getElementById('health-vault-confirm-wrap').hidden=!create;
  document.getElementById('health-vault-confirm').value='';document.getElementById('health-vault-pass').value='';document.getElementById('health-vault-error').textContent='';
  document.getElementById('health-vault-submit').textContent=create?'Создать сейф':'Разблокировать';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('health-vault-sheet').classList.add('open');setNav(false);
}
async function submitHealthVault(){
  const api=window.NEXUS_HEALTH_VAULT,pass=document.getElementById('health-vault-pass').value,confirm=document.getElementById('health-vault-confirm').value,error=document.getElementById('health-vault-error');
  const create=!api.hasVault();
  if(pass.length<12){error.textContent='Парольная фраза должна содержать минимум 12 символов.';return}
  if(create&&pass!==confirm){error.textContent='Парольные фразы не совпадают.';return}
  const button=document.getElementById('health-vault-submit');button.disabled=true;button.textContent='Обработка…';
  try{
    if(create)await api.setup(pass,DB);else await api.unlock(pass,DB);
    DB.healthVaultUnlocked=true;
    document.getElementById('health-vault-pass').value='';document.getElementById('health-vault-confirm').value='';
    closeSheet();save();renderFitness();toast(create?'Личный сейф создан и зашифрован':'Сейф разблокирован');
  }catch(e){error.textContent=e.message||'Не удалось открыть сейф'}
  finally{button.disabled=false;button.textContent=create?'Создать сейф':'Разблокировать'}
}
async function lockHealthVault(){
  const api=window.NEXUS_HEALTH_VAULT;if(!api?.isUnlocked())return;
  try{await api.lock(DB);DB.healthVaultUnlocked=false;save();renderFitness();toast('Личный сейф заблокирован')}
  catch(e){toast('Не удалось сохранить сейф. Он останется разблокированным')}
}
function renderFitness(){
  const vault=window.NEXUS_HEALTH_VAULT;
  if(!vault?.isUnlocked()){
    const exists=!!vault?.hasVault();
    document.getElementById('eres').innerHTML='<div class="vault-shell rounded-3xl p-5"><div class="vault-orb w-14 h-14 rounded-2xl bg-emerald-400/10 flex items-center justify-center text-2xl mb-4">🔐</div><p class="text-[20px] font-bold mb-2">Личный сейф здоровья</p><p class="text-[12px] text-white/55 leading-relaxed mb-4">'+(exists?'Данные зашифрованы на устройстве. Разблокируй сейф, чтобы открыть тренировки и питание.':'Перед добавлением личных данных создай отдельный зашифрованный сейф. Старые локальные записи будут зашифрованы при создании.')+'</p><button onclick="openHealthVault()" class="w-full py-3 rounded-full bg-white text-black text-[13px] font-semibold press">'+(exists?'Разблокировать сейф':'Создать защищённый сейф')+'</button><p class="text-[10px] text-white/30 mt-3">AES-256-GCM · парольная фраза не отправляется на сервер</p></div>';
    return;
  }
  const profile=DB.fitnessProfile||{},workouts=DB.workouts||[],entries=DB.nutritionEntries||[];
  const minutes=workouts.reduce((sum,item)=>sum+Number(item.duration||0),0);
  const today=new Date().toDateString();
  const calories=entries.filter(item=>new Date(item.consumedAt).toDateString()===today).reduce((sum,item)=>sum+Number(item.calories||0),0);
  const box=document.getElementById('eres');
  box.innerHTML=`<div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-400/10 mb-3"><div class="flex items-center justify-between"><div><p class="text-[11px] text-white/45">Мой профиль</p><p class="text-[19px] font-bold mt-1">${profile.goal?esc(profile.goal):'Твоя форма — твои правила'}</p><p class="text-[11px] text-white/45 mt-1">${profile.height?esc(String(profile.height))+' см':''}${profile.weight?' · '+esc(String(profile.weight))+' кг':''}</p></div><button onclick="openFitnessProfileEdit()" class="px-3 py-2 rounded-full glass text-[11px] press">Настроить</button></div><div class="flex items-center justify-between mt-3"><p class="text-[10px] text-emerald-300/60">Зашифрованный сейф разблокирован</p><button onclick="lockHealthVault()" class="text-[10px] text-white/50 press">Заблокировать</button></div></div>
  <div class="grid grid-cols-3 gap-2 mb-3"><div class="rounded-xl bg-white/[0.04] p-3"><p class="text-[10px] text-white/40">Тренировки</p><p class="text-[20px] font-bold mt-1">${workouts.length}</p></div><div class="rounded-xl bg-white/[0.04] p-3"><p class="text-[10px] text-white/40">Минуты</p><p class="text-[20px] font-bold mt-1">${minutes}</p></div><div class="rounded-xl bg-white/[0.04] p-3"><p class="text-[10px] text-white/40">Ккал сегодня</p><p class="text-[20px] font-bold mt-1">${Math.round(calories)}</p></div></div>
  <div class="grid grid-cols-2 gap-2 mb-4"><button onclick="openWorkoutCreate()" class="py-3 rounded-xl bg-white text-black text-[12px] font-semibold press">＋ Тренировка</button><button onclick="openNutritionCreate()" class="py-3 rounded-xl glass text-white text-[12px] font-semibold press">＋ Питание</button></div>
  <p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2">Последние тренировки</p>${workouts.length?workouts.slice(0,5).map(item=>`<div class="p-3 rounded-xl bg-white/[0.04] mb-1.5 flex justify-between"><div><p class="text-[13px] font-semibold">${esc(item.type)}</p><p class="text-[10px] text-white/40">${esc(item.date)}</p></div><p class="text-[12px] text-white/60">${Number(item.duration)} мин</p></div>`).join(''):'<div class="empty">Добавь первую тренировку</div>'}
  <p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mt-4 mb-2">Питание</p>${entries.length?entries.slice(0,5).map(item=>`<div class="p-3 rounded-xl bg-white/[0.04] mb-1.5 flex justify-between"><div><p class="text-[13px] font-semibold">${esc(item.food)}</p><p class="text-[10px] text-white/40">${esc(item.date)}</p></div><p class="text-[12px] text-white/60">${Math.round(Number(item.calories||0))} ккал</p></div>`).join(''):'<div class="empty">Добавь первый приём пищи</div>'}`;
}
function openFitnessProfileEdit(){
  if(!window.NEXUS_HEALTH_VAULT?.isUnlocked()){openHealthVault();return}
  const p=DB.fitnessProfile||{};document.getElementById('fitness-height').value=p.height||'';document.getElementById('fitness-weight').value=p.weight||'';document.getElementById('fitness-goal').value=p.goal||'';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('fitness-profile-sheet').classList.add('open');setNav(false);
}
function saveFitnessProfile(){
  if(!window.NEXUS_HEALTH_VAULT?.isUnlocked())return;
  const height=Number(document.getElementById('fitness-height').value),weight=Number(document.getElementById('fitness-weight').value),goal=document.getElementById('fitness-goal').value.trim();
  if(document.getElementById('fitness-height').value&&(!Number.isFinite(height)||height<50||height>260)){toast('Проверь рост');return}
  if(document.getElementById('fitness-weight').value&&(!Number.isFinite(weight)||weight<10||weight>500)){toast('Проверь вес');return}
  DB.fitnessProfile={height:height||null,weight:weight||null,goal};save();closeSheet();DB.etab='fitness';go('explore');toast('Профиль сохранён локально');
}
function openWorkoutCreate(){
  if(!window.NEXUS_HEALTH_VAULT?.isUnlocked()){openHealthVault();return}
  document.getElementById('workout-type').value='Силовая';document.getElementById('workout-duration').value='45';document.getElementById('workout-notes').value='';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('workout-create-sheet').classList.add('open');setNav(false);
}
function createWorkout(){
  if(!window.NEXUS_HEALTH_VAULT?.isUnlocked())return;
  const type=document.getElementById('workout-type').value.trim(),duration=Number(document.getElementById('workout-duration').value),notes=document.getElementById('workout-notes').value.trim();
  if(!type||!Number.isInteger(duration)||duration<1||duration>1440){toast('Проверь тип и длительность тренировки');return}
  DB.workouts.unshift({id:'wo'+Date.now(),type,duration,notes,date:new Date().toLocaleString('ru-RU'),createdAt:Date.now()});save();closeSheet();DB.etab='fitness';go('explore');toast('Тренировка сохранена');
}
function openNutritionCreate(){
  if(!window.NEXUS_HEALTH_VAULT?.isUnlocked()){openHealthVault();return}
  ['nutrition-food','nutrition-grams','nutrition-calories','nutrition-protein','nutrition-carbs','nutrition-fat'].forEach(id=>document.getElementById(id).value='');
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('nutrition-create-sheet').classList.add('open');setNav(false);
}
function createNutritionEntry(){
  if(!window.NEXUS_HEALTH_VAULT?.isUnlocked())return;
  const food=document.getElementById('nutrition-food').value.trim();
  const number=id=>{const raw=document.getElementById(id).value.trim();return raw===''?null:Number(raw.replace(',','.'))};
  const grams=number('nutrition-grams'),calories=number('nutrition-calories'),protein=number('nutrition-protein'),carbs=number('nutrition-carbs'),fat=number('nutrition-fat');
  if(!food){toast('Укажи продукт или блюдо');return}
  if([grams,calories,protein,carbs,fat].some(value=>value!==null&&(!Number.isFinite(value)||value<0))){toast('Проверь значения питания');return}
  DB.nutritionEntries.unshift({id:'nu'+Date.now(),food,grams,calories:calories||0,protein,carbs,fat,date:new Date().toLocaleString('ru-RU'),consumedAt:Date.now()});save();closeSheet();DB.etab='fitness';go('explore');toast('Запись питания сохранена');
}
function openSpaceCreate(){
  if(!DB.activeOrganization){toast('Сначала открой организацию');return}
  document.getElementById('space-name').value='';document.getElementById('space-desc').value='';document.getElementById('space-type').value='community';document.getElementById('space-visibility').value='private';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('space-create-sheet').classList.add('open');setNav(false);
}
function createSpace(){
  const name=document.getElementById('space-name').value.trim(),desc=document.getElementById('space-desc').value.trim(),type=document.getElementById('space-type').value,visibility=document.getElementById('space-visibility').value;
  if(name.length<2){toast('Добавь название пространства');return}
  const id='space'+Date.now();DB.spaces.unshift({id,organizationId:DB.activeOrganization,name,desc,type,visibility,ownerKey:'me',links:[],createdAt:Date.now()});DB.activeSpace=id;save();closeSheet();openSpace(id);toast('Пространство создано локально');
}
function openSpace(id){
  const space=DB.spaces.find(item=>item.id===id);if(!space)return;DB.activeSpace=id;
  const links=space.links||[],box=document.getElementById('eres');
  box.innerHTML=`<button onclick="openOrganization(DB.activeOrganization)" class="text-[12px] text-white/45 mb-3">← К организации</button><div class="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/10 border border-white/[0.06] mb-3"><p class="text-[20px] font-bold">${esc(space.name)}</p><p class="text-[12px] text-white/50 mt-1">${esc(space.desc||'')}</p><p class="text-[11px] text-white/35 mt-2">${esc(space.type)} · ${esc(space.visibility)}</p></div><button onclick="openSpaceLink()" class="w-full py-3 rounded-xl bg-white text-black font-semibold text-[13px] mb-3 press">＋ Связать канал или магазин</button>`+
    (links.length?links.map(link=>{const resource=link.type==='channel'?DB.channels.find(item=>item.id===link.id):DB.shops.find(item=>item.id===link.id);return resource?`<div class="p-3 rounded-xl bg-white/[0.04] mb-1.5"><p class="text-[12px] text-white/40">${link.type==='channel'?'Канал':'Магазин'}</p><p class="text-[13px] font-semibold">${esc(resource.name)}</p></div>`:''}).join(''):'<div class="empty">Привяжи каналы и магазины к этому пространству</div>');
}
function openSpaceLink(){
  const space=DB.spaces.find(item=>item.id===DB.activeSpace);if(!space)return;
  const links=space.links||[];
  document.getElementById('space-channels').innerHTML=DB.channels.filter(item=>item.organizationId===space.organizationId).map(item=>`<option value="${esc(item.id)}" ${links.some(link=>link.type==='channel'&&link.id===item.id)?'selected':''}>${esc(item.name)}</option>`).join('');
  document.getElementById('space-shops').innerHTML=DB.shops.filter(item=>item.organizationId===space.organizationId).map(item=>`<option value="${esc(item.id)}" ${links.some(link=>link.type==='shop'&&link.id===item.id)?'selected':''}>${esc(item.name)}</option>`).join('');
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('space-link-sheet').classList.add('open');setNav(false);
}
function saveSpaceLinks(){
  const space=DB.spaces.find(item=>item.id===DB.activeSpace);if(!space)return;
  const channels=[...document.getElementById('space-channels').selectedOptions].map(option=>({type:'channel',id:option.value}));
  const shops=[...document.getElementById('space-shops').selectedOptions].map(option=>({type:'shop',id:option.value}));
  space.links=[...channels,...shops];save();closeSheet();openSpace(space.id);toast('Связи пространства сохранены локально');
}
function renderOrganizations(){
  const box=document.getElementById('eres'),orgs=DB.organizations||[];
  box.innerHTML=orgs.length?orgs.map(org=>{
    const channels=DB.channels.filter(channel=>channel.organizationId===org.id).length,shops=DB.shops.filter(shop=>shop.organizationId===org.id).length,spaces=DB.spaces.filter(space=>space.organizationId===org.id).length,members=org.members?.length||1;
    return `<button data-org-id="${esc(org.id)}" onclick="openOrganization(this.dataset.orgId)" class="w-full text-left p-4 rounded-2xl bg-white/[0.04] border border-white/[0.05] mb-2 press"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 flex items-center justify-center text-xl">◇</div><div class="min-w-0"><p class="text-[14px] font-semibold truncate">${esc(org.name)}</p><p class="text-[11px] text-white/40">${channels} каналов · ${shops} магазинов · ${spaces} пространств · ${members} участников</p></div></div><p class="text-[12px] text-white/50 mt-2">${esc(org.desc||'')}</p></button>`;
  }).join(''):'<div class="empty"><div class="text-3xl mb-3">◇</div><p class="font-semibold text-white mb-1">Бизнес-пространство</p><p class="text-[12px] text-white/40 mb-4">Объединяй компанию, несколько каналов и магазинов в одном месте</p><button onclick="openOrganizationCreate()" class="px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-semibold">Создать организацию</button></div>';
  if(orgs.length)box.innerHTML+='<button onclick="openOrganizationCreate()" class="w-full py-3 rounded-2xl glass text-[13px] text-white/75 press">＋ Новая организация</button>';
}
function openOrganization(id){
  const org=DB.organizations.find(item=>item.id===id);if(!org)return;DB.activeOrganization=id;
  const channels=DB.channels.filter(item=>item.organizationId===id),shops=DB.shops.filter(item=>item.organizationId===id),spaces=DB.spaces.filter(item=>item.organizationId===id),members=org.members||[{profileKey:'me',role:'owner'}];
  const box=document.getElementById('eres');
  box.innerHTML=`<button onclick="DB.etab='business';renderExplore()" class="text-[12px] text-white/45 mb-3">← Все организации</button><div class="p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 border border-white/[0.06] mb-3"><p class="text-[20px] font-bold">${esc(org.name)}</p><p class="text-[12px] text-white/50 mt-1">${esc(org.desc||'')}</p><p class="text-[11px] text-white/35 mt-2">Организация · локально</p></div><div class="grid grid-cols-2 gap-2 mb-4"><button onclick="openOrganizationLink()" class="py-3 rounded-xl bg-white text-black font-semibold text-[12px] press">＋ Ресурсы</button><button onclick="openOrganizationMembers()" class="py-3 rounded-xl glass text-white font-semibold text-[12px] press">Команда · ${members.length}</button></div><p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2">Команда</p>${members.map(member=>{const person=member.profileKey==='me'?DB.me:DB.profiles[member.profileKey];return `<div class="flex items-center gap-2 py-2"><div class="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px]">${esc((person?.name||'?').slice(0,1))}</div><div class="flex-1 min-w-0"><p class="text-[12px] font-semibold truncate">${esc(person?.name||'Участник')}</p><p class="text-[10px] text-white/35">${esc(member.role)}</p></div></div>`}).join('')}<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mt-4 mb-2">Каналы</p>`+
    (channels.length?channels.map(channel=>`<button data-channel-id="${esc(channel.id)}" onclick="go('channel',{id:this.dataset.channelId})" class="w-full text-left p-3 rounded-xl bg-white/[0.04] mb-1.5 press"><p class="text-[13px] font-semibold">${esc(channel.name)}</p><p class="text-[10px] text-white/40">${esc(channel.visibility)}</p></button>`).join(''):'<p class="text-[12px] text-white/35 mb-3">Каналы ещё не связаны</p>')+
    '<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mt-4 mb-2">Магазины</p>'+
    (shops.length?shops.map(shop=>`<button data-shop-id="${esc(shop.id)}" onclick="go('shop',{id:this.dataset.shopId})" class="w-full text-left p-3 rounded-xl bg-white/[0.04] mb-1.5 press"><p class="text-[13px] font-semibold">${esc(shop.name)}</p><p class="text-[10px] text-white/40">${esc(shop.visibility)}</p></button>`).join(''):'<p class="text-[12px] text-white/35">Магазины ещё не связаны</p>')+
    '<div class="flex items-center justify-between mt-5 mb-2"><p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Пространства</p><button onclick="openSpaceCreate()" class="text-[11px] text-violet-300 press">＋ Создать</button></div>'+
    (spaces.length?spaces.map(space=>`<button data-space-id="${esc(space.id)}" onclick="openSpace(this.dataset.spaceId)" class="w-full text-left p-3 rounded-xl bg-white/[0.04] mb-1.5 press"><p class="text-[13px] font-semibold">${esc(space.name)}</p><p class="text-[10px] text-white/40">${esc(space.type)} · ${esc(space.visibility)}</p></button>`).join(''):'<p class="text-[12px] text-white/35">Создай пространство команды или сообщества</p>');
}
function openOrganizationCreate(){
  document.getElementById('organization-name').value='';document.getElementById('organization-desc').value='';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('organization-create-sheet').classList.add('open');setNav(false);
}
function createOrganization(){
  const name=document.getElementById('organization-name').value.trim(),desc=document.getElementById('organization-desc').value.trim();
  if(name.length<2){toast('Добавь название организации');return}
  const id='org'+Date.now();DB.organizations.unshift({id,name,desc,ownerKey:'me',members:[{profileKey:'me',role:'owner'}],createdAt:Date.now()});save();closeSheet();DB.etab='business';go('explore');openOrganization(id);toast('Организация создана локально');
}
function openOrganizationMembers(){
  const org=DB.organizations.find(item=>item.id===DB.activeOrganization);if(!org)return;
  const current=org.members||[{profileKey:'me',role:'owner'}];
  document.getElementById('organization-members').innerHTML=Object.entries(DB.profiles).filter(([key])=>!DB.blocked?.[key]).map(([key,profile])=>`<option value="${esc(key)}" ${current.some(member=>member.profileKey===key)?'selected':''}>${esc(profile.name)} · ${esc(profile.handle)}</option>`).join('');
  document.getElementById('organization-member-role').value='member';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('organization-members-sheet').classList.add('open');setNav(false);
}
function saveOrganizationMembers(){
  const org=DB.organizations.find(item=>item.id===DB.activeOrganization);if(!org)return;
  const keys=[...document.getElementById('organization-members').selectedOptions].map(option=>option.value),role=document.getElementById('organization-member-role').value;
  org.members=[{profileKey:'me',role:'owner'},...keys.map(profileKey=>({profileKey,role}))];
  save();closeSheet();openOrganization(org.id);toast('Состав команды сохранён локально');
}
function openOrganizationLink(){
  const org=DB.organizations.find(item=>item.id===DB.activeOrganization);if(!org)return;
  document.getElementById('organization-channels').innerHTML=DB.channels.map(channel=>`<option value="${esc(channel.id)}" ${channel.organizationId===org.id?'selected':''}>${esc(channel.name)}</option>`).join('');
  document.getElementById('organization-shops').innerHTML=DB.shops.map(shop=>`<option value="${esc(shop.id)}" ${shop.organizationId===org.id?'selected':''}>${esc(shop.name)}</option>`).join('');
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('organization-link-sheet').classList.add('open');setNav(false);
}
function saveOrganizationLinks(){
  const org=DB.organizations.find(item=>item.id===DB.activeOrganization);if(!org)return;
  const channelIds=[...document.getElementById('organization-channels').selectedOptions].map(option=>option.value),shopIds=[...document.getElementById('organization-shops').selectedOptions].map(option=>option.value);
  DB.channels.forEach(channel=>{if(channel.organizationId===org.id)delete channel.organizationId;if(channelIds.includes(channel.id))channel.organizationId=org.id});
  DB.shops.forEach(shop=>{if(shop.organizationId===org.id)delete shop.organizationId;if(shopIds.includes(shop.id))shop.organizationId=org.id});
  save();closeSheet();openOrganization(org.id);toast('Связи организации сохранены локально');
}
function renderExplore(){
  const q=(document.getElementById('eq')?.value||'').toLowerCase();
  const tab=DB.etab;let h='';
  const people=Object.entries(DB.profiles).filter(([k,p])=>!DB.blocked?.[k]&&(!q||p.name.toLowerCase().includes(q)||p.handle.toLowerCase().includes(q)));
  const channels=DB.channels.filter(c=>!q||c.name.toLowerCase().includes(q));
  const shops=DB.shops.filter(shop=>!q||shop.name.toLowerCase().includes(q));
  if(tab==='clips'){renderClips();return}
  if(tab==='music'){renderPlaylists();return}
  if(tab==='cinema'){renderWatchlists();return}
  if(tab==='fitness'){renderFitness();return}
  if(tab==='business'){renderOrganizations();return}
  if(tab==='all'||tab==='people'){
    if(people.length)h+='<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2">Люди</p>'+people.map(([key,p])=>`<button class="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.04] mb-1.5 press" data-profile-key="${esc(key)}" onclick="go('profile',{key:this.dataset.profileKey})"><img src="https://i.pravatar.cc/64?u=${encodeURIComponent(key)}" class="w-11 h-11 rounded-full"><div class="text-left"><p class="text-[14px] font-semibold">${esc(p.name)}</p><p class="text-[12px] text-white/40">${esc(p.handle)}</p></div></button>`).join('');
  }
  if(tab==='all'||tab==='channels'){
    if(channels.length)h+='<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2 mt-3">Каналы</p>'+channels.map(c=>`<button class="w-full text-left p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04] mb-1.5 press" data-channel-id="${esc(c.id)}" onclick="go('channel',{id:this.dataset.channelId})"><p class="text-[14px] font-semibold">${esc(c.name)}</p><p class="text-[12px] text-white/40 mt-0.5">${esc(c.desc)} · ${esc(c.members)}</p></button>`).join('');
  }
  if(tab==='all'||tab==='shops'){
    if(shops.length)h+='<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2 mt-3">Магазины</p>'+shops.map(shop=>`<button class="w-full text-left p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04] mb-1.5 press" data-shop-id="${esc(shop.id)}" onclick="go('shop',{id:this.dataset.shopId})"><p class="text-[14px] font-semibold">${esc(shop.name)}</p><p class="text-[12px] text-white/40 mt-0.5">${esc(shop.desc)} · ${Number(shop.ownerKey==='me'?shop.items.length:shop.products)} товаров</p></button>`).join('');
  }
  document.getElementById('eres').innerHTML=h||'<div class="empty">Ничего не найдено</div>';
}
document.getElementById('etabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;DB.etab=b.dataset.t;document.querySelectorAll('.etab').forEach(x=>{const on=x.dataset.t===DB.etab;x.className='etab px-3.5 py-1.5 rounded-full text-[12px] '+(on?'font-semibold bg-white text-black':'font-medium glass text-white/70')});renderExplore()});
async function checkBackendStatus(){
  const box=document.getElementById('backend-status');if(!box)return;
  try{
    const response=await fetch('/api/health',{cache:'no-store'});
    const state=await response.json();
    box.textContent=state.backendConfigured
      ?'Параметры Supabase заданы. Базу данных подключим после применения миграции.'
      :'Серверная часть ещё не подключена. Сейчас данные прототипа сохраняются на этом устройстве.';
  }catch(e){
    box.textContent='Не удалось проверить сервер. Локальные функции приложения остаются доступны.';
  }
}
function renderSettings(){
  const status='<div id="backend-status" class="mb-3 p-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.06] text-[12px] leading-relaxed text-white/55">Проверяем серверную конфигурацию…</div>';
  const groups=[
    ['Аккаунт',['Профиль','Конфиденциальность','Блокировки']],
    ['Уведомления',['Push','Категории']],
    ['Безопасность',['2FA','Сессии']],
    ['Данные',['Экспорт данных','Резервная копия сейфа','Импорт сейфа','Очистить кэш','Сбросить демо']]
  ];
  document.getElementById('sbody').innerHTML=status+groups.map(([title,items])=>`<div><p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2 px-1">${title}</p><div class="rounded-2xl bg-white/[0.04] border border-white/[0.04] overflow-hidden divide-y divide-white/[0.04]">${items.map(item=>`<button class="w-full text-left px-4 py-3.5 text-[14px] press flex justify-between items-center" onclick="settingAction('${item}')"><span>${item}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>`).join('')}</div></div>`).join('')+'<p class="text-center text-[11px] text-white/20 pt-4">Atlantis · локальный прототип</p>';
  checkBackendStatus();
}
function openReport(type,id){
  document.getElementById('report-target-type').value=type;document.getElementById('report-target-id').value=id;
  document.getElementById('report-reason').value='spam';document.getElementById('report-details').value='';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('report-sheet').classList.add('open');setNav(false);
}
function submitReport(){
  const type=document.getElementById('report-target-type').value,id=document.getElementById('report-target-id').value,reason=document.getElementById('report-reason').value,details=document.getElementById('report-details').value.trim();
  if(!type||!id){toast('Не удалось определить объект жалобы');return}
  DB.reports=DB.reports||[];DB.reports.unshift({id:'rep'+Date.now(),targetType:type,targetId:id,reason,details,createdAt:Date.now(),status:'local'});
  save();closeSheet();toast('Жалоба сохранена на устройстве');
}
function openPrivacySheet(){
  document.getElementById('privacy-profile-visibility').value=DB.me.visibility||'public';
  document.getElementById('bd').classList.add('open');document.getElementById('privacy-sheet').classList.add('open');setNav(false);
}
function savePrivacySettings(){
  DB.me.visibility=document.getElementById('privacy-profile-visibility').value;
  save();closeSheet();toast('Настройка сохранена на устройстве');
}
function openBlockSheet(){
  renderBlockList();document.getElementById('bd').classList.add('open');document.getElementById('blocks-sheet').classList.add('open');setNav(false);
}
function renderBlockList(){
  const box=document.getElementById('block-list');
  const entries=Object.entries(DB.profiles);
  box.innerHTML=entries.map(([key,profile])=>{
    const blocked=!!DB.blocked?.[key];
    return `<div class="flex items-center gap-3 py-3 border-b border-white/[0.06]"><img src="https://i.pravatar.cc/64?u=${encodeURIComponent(key)}" class="w-10 h-10 rounded-full"><div class="flex-1 min-w-0"><p class="text-[13px] font-semibold truncate">${esc(profile.name)}</p><p class="text-[11px] text-white/40">${esc(profile.handle)}</p></div><button data-profile-key="${esc(key)}" onclick="toggleBlock(this.dataset.profileKey)" class="px-3 py-2 rounded-full text-[11px] font-semibold ${blocked?'glass text-white':'bg-white text-black'}">${blocked?'Разблокировать':'Заблокировать'}</button></div>`;
  }).join('')||'<div class="empty">Список пуст</div>';
}
function toggleBlock(key){
  DB.blocked=DB.blocked||{};
  if(DB.blocked[key])delete DB.blocked[key];else DB.blocked[key]=true;
  save();renderBlockList();renderFeed();renderStories();renderExplore();renderChats();toast(DB.blocked[key]?'Профиль заблокирован на этом устройстве':'Блокировка снята');
}
function downloadJsonFile(filename,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportLocalData(){
  const payload={
    format:'nexus-local-export',version:1,exportedAt:new Date().toISOString(),
    note:'Personal health data is stored separately in the encrypted health vault and is not included in this export.',
    profile:DB.me,posts:DB.posts,stories:DB.stories,channels:DB.channels,shops:DB.shops,
    clips:DB.clips,playlists:DB.playlists,watchlists:DB.watchlists,chats:DB.chats,
    organizations:DB.organizations,spaces:DB.spaces,notifications:DB.notifications
  };
  downloadJsonFile('nexus-data-'+new Date().toISOString().slice(0,10)+'.json',payload);
  toast('Экспорт подготовлен');
}
async function exportHealthVaultBackup(){
  try{
    const bundle=await window.NEXUS_HEALTH_VAULT.exportEncrypted();
    downloadJsonFile('nexus-health-vault-backup.json',bundle);
    toast('Зашифрованная копия сейфа скачана');
  }catch(e){toast(e.message||'Не удалось создать копию сейфа')}
}
async function importHealthVaultBackup(input){
  const file=input.files?.[0];input.value='';if(!file)return;
  if(file.size>30*1024*1024){toast('Файл слишком большой');return}
  try{
    const bundle=JSON.parse(await file.text());
    await window.NEXUS_HEALTH_VAULT.importEncrypted(bundle);
    DB.fitnessProfile={};DB.workouts=[];DB.nutritionEntries=[];DB.healthMeasurements=[];DB.healthVaultUnlocked=false;
    save();openHealthVault();toast('Резервная копия импортирована. Введи пароль для разблокировки.');
  }catch(e){toast(e.message||'Не удалось импортировать сейф')}
}
function settingAction(i){
  if(i==='Экспорт данных'){exportLocalData();return}
  if(i==='Резервная копия сейфа'){exportHealthVaultBackup();return}
  if(i==='Импорт сейфа'){document.getElementById('health-vault-import-file').click();return}
  if(i==='Сбросить демо'){localStorage.removeItem(LS);location.reload();return}
  if(i==='Очистить кэш'){toast('Кэш очищен');return}
  if(i==='Профиль'){go('me');return}
  if(i==='Конфиденциальность'){openPrivacySheet();return}
  if(i==='Блокировки'){openBlockSheet();return}
  toast(i+' пока не подключено к серверной части');
}
function openCreate(){
  document.getElementById('create-opts').innerHTML=[
    ['Пост','В ленту','📝','post'],
    ['История','Атлас 24ч','✦','story'],
    ['Канал','Для аудитории','📡','ch'],
    ['Магазин','Каталог','🛍','shop'],
    ['Клип','Короткое видео','▶','clip'],
    ['Плейлист','Музыкальная подборка','♫','playlist'],
    ['Кино','Фильмы и сериалы','▣','watchlist'],
    ['Форма','Тренировки и питание','◈','fitness'],
    ['Организация','Бизнес-пространство','◇','business']
  ].map(([t,d,i,a])=>`<button class="w-full flex items-center gap-3 px-2 py-3 rounded-2xl press text-left" data-a="${a}"><div class="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center text-[16px]">${i}</div><div><p class="text-[14px] font-semibold">${t}</p><p class="text-[11.5px] text-white/40">${d}</p></div></button>`).join('');
  document.querySelectorAll('#create-opts [data-a]').forEach(b=>{
    b.onclick=()=>{
      const a=b.dataset.a;
      if(a==='post'){closeSheet();go('compose')}
      else if(a==='story'){addMyStory()}
      else if(a==='ch'){openChannelCreate()}
      else if(a==='shop'){openShopCreate()}
      else if(a==='clip'){openClipCreate()}
      else if(a==='playlist'){openPlaylistCreate()}
      else if(a==='watchlist'){openWatchlistCreate()}
      else if(a==='fitness'){DB.etab='fitness';closeSheet();go('explore')}
      else if(a==='business'){DB.etab='business';closeSheet();go('explore')}
    };
  });
  document.getElementById('bd').classList.add('open');document.getElementById('create-sheet').classList.add('open');setNav(false);
}
function openChannelCreate(){
  document.getElementById('new-channel-name').value='';
  document.getElementById('new-channel-desc').value='';
  document.getElementById('new-channel-visibility').value='public';
  DB.pendingChannelCover=null;DB.editingChannelId=null;document.getElementById('channel-cover-preview').hidden=true;
  document.getElementById('channel-create-title').textContent='Новый канал';document.getElementById('channel-save-btn').textContent='Создать канал';
  closeSheet();document.getElementById('bd').classList.add('open');document.getElementById('channel-create-sheet').classList.add('open');setNav(false);
}
function addMyStory(){
  closeSheet();
  const picker=document.getElementById('story-file-input');
  if(picker)picker.click();
}
async function handleStoryFiles(input){
  const files=[...(input.files||[])].filter(f=>f.type.startsWith('image/')&&f.size<=20*1024*1024).slice(0,10);
  input.value='';
  if(!files.length){toast('Выберите изображение до 20 МБ');return}
  try{
    const refs=[];
    for(const file of files)refs.push(await saveMediaFile(file));
    let mine=DB.stories.find(s=>s.id==='me');
    if(!mine){mine={id:'me',name:'Вы',avatar:'https://i.pravatar.cc/140?u=me',images:[]};DB.stories.splice(1,0,mine)}
    mine.images.push(...refs);delete DB.seenStories.me;save();renderStories();toast('История добавлена');openStory('me');
  }catch(e){console.error(e);toast(e.message||'Не удалось сохранить фото')}
}
function renderComposeImgs(){
  const box=document.getElementById('compose-imgs');
  box.innerHTML=DB.composeImgs.map((src,i)=>`<div class="relative w-20 h-20 rounded-xl overflow-hidden shrink-0"><img ${src.startsWith('idb:')?`data-media-ref="${src}"`:`src="${src}"`} class="w-full h-full object-cover" alt="Выбранное фото"><button onclick="DB.composeImgs.splice(${i},1);renderComposeImgs()" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-[10px] flex items-center justify-center">✕</button></div>`).join('');
  hydrateMediaImages(box);
}
function addComposeImg(){
  if(DB.composeImgs.length>=4){toast('Максимум 4 фото');return}
  document.getElementById('compose-file-input').click();
}
async function handleComposeFiles(input){
  const files=[...(input.files||[])].filter(f=>f.type.startsWith('image/')&&f.size<=20*1024*1024);
  input.value='';
  if(!files.length){toast('Выберите изображение до 20 МБ');return}
  const room=4-DB.composeImgs.length;
  if(!room){toast('Максимум 4 фото');return}
  if(files.length>room)toast('Можно добавить не более 4 фото');
  try{
    for(const file of files.slice(0,room))DB.composeImgs.push(await saveMediaFile(file));
    renderComposeImgs();
  }catch(e){console.error(e);toast(e.message||'Не удалось сохранить фото')}
}
function publishPost(){
  const text=document.getElementById('compose-text').value.trim();
  if(!text&&!DB.composeImgs.length){toast('Добавьте текст или фото');return}
  const images=[...DB.composeImgs],channelId=DB.composeChannelId||null;
  DB.posts.unshift({
    id:'p'+Date.now(),author:DB.me.name,authorKey:'me',avatar:DB.me.avatar||'https://i.pravatar.cc/64?u=me',
    image:images[0]||null,images,channelId,likes:0,comments:0,liked:false,saved:false,text:text||'',commentList:[]
  });
  DB.composeImgs=[];DB.composeChannelId=null;save();toast('Опубликовано локально');
  if(channelId)go('channel',{id:channelId});else go('home');
}
function closeSheet(){
  ['bd','create-sheet','comments-sheet','product-sheet','cart-sheet','edit-sheet','channel-create-sheet','shop-create-sheet','product-create-sheet','privacy-sheet','blocks-sheet','clip-create-sheet','playlist-create-sheet','track-create-sheet','watchlist-create-sheet','watch-item-create-sheet','report-sheet','organization-create-sheet','organization-link-sheet','organization-members-sheet','fitness-profile-sheet','workout-create-sheet','nutrition-create-sheet','new-chat-sheet','space-create-sheet','space-link-sheet','health-vault-sheet'].forEach(id=>document.getElementById(id)?.classList.remove('open'));
  setNav(true);
}
if(!DB.onboarded)document.getElementById('onboarding').classList.add('on');
renderStories();renderFeed();renderNotifs();renderChats();renderMe();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
