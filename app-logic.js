
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
async async function saveMediaFile(file){
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
  const nodes=[...root.querySelectorAll('img[data-media-ref]')];
  await Promise.all(nodes.map(async img=>{
    try{img.src=await resolveMediaURL(img.dataset.mediaRef)}
    catch(e){img.alt='Фото недоступно';img.classList.add('opacity-40')}
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
  if(r==='compose'){document.getElementById('compose-text').value='';DB.composeImgs=[];renderComposeImgs()}
  if(r==='home'){renderStories();renderFeed()}
}
function setNav(v){document.getElementById('bnav').classList.toggle('hide',!v)}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),2200)}
function fmt(n){return n>=1000?(n/1000).toFixed(1).replace('.0','')+' тыс.':String(n)}
function finishOnboarding(){DB.onboarded=true;save();document.getElementById('onboarding').classList.remove('on');toast('Добро пожаловать 🌊')}
function renderStories(){
  document.getElementById('stories').innerHTML=DB.stories.map(s=>{
    if(s.type==='add')return `<button class="flex flex-col items-center gap-1 shrink-0 press" onclick="openCreate()"><div class="w-[66px] h-[66px] rounded-full bg-[#161618] border border-white/10 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg></div><span class="text-[10px] text-white/45">Добавить</span></button>`;
    const seen=DB.seenStories[s.id];
    const av=s.avatar?`<img src="${s.avatar}" class="w-full h-full rounded-full object-cover border-[2.5px] border-black" onerror="this.style.display='none'">`:`<div class="w-full h-full rounded-full bg-[#222] border-[2.5px] border-black"></div>`;
    return `<button class="flex flex-col items-center gap-1 shrink-0 press" onclick="openStory('${s.id}')"><div class="w-[66px] h-[66px] ${seen?'story-ring seen':'story-ring'}">${av}</div><span class="text-[10px] text-white/75">${s.name}</span></button>`;
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
  if(!DB.posts.length){feed.innerHTML='<div class="empty">Лента пуста. Создайте первый пост.</div>';return}
  feed.innerHTML=DB.posts.map(p=>{
    const images=Array.isArray(p.images)&&p.images.length?p.images:(p.image?[p.image]:[]);
    const gallery=images.length?images.map(src=>{
      const source=src.startsWith('idb:')?(`data-media-ref="${src}"`):(`src="${src}"`);
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
          <img src="${p.avatar}" class="w-7 h-7 rounded-full object-cover ring-1 ring-white/50" onerror="this.style.opacity=0">
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
      </div>
    </article>`;
  }).join('');
  hydrateMediaImages(feed);
}
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
  const pr=DB.profiles[key];if(!pr)return;
  document.getElementById('prof-hero').style.backgroundImage=`url('${pr.hero}')`;
  document.getElementById('prof-name').textContent=pr.name;
  document.getElementById('prof-handle').textContent=pr.handle;
  document.getElementById('prof-bio').textContent=pr.bio;
  document.getElementById('prof-stats').innerHTML=`<div class="text-center"><p class="text-[20px] font-bold">${pr.following}</p><p class="text-[11px] text-white/45">Подписки</p></div><div class="text-center"><p class="text-[20px] font-bold">${pr.followers}</p><p class="text-[11px] text-white/45">Подписчики</p></div><div class="text-center"><p class="text-[20px] font-bold">${pr.posts}</p><p class="text-[11px] text-white/45">Посты</p></div>`;
  const fol=!!DB.following[key];
  document.getElementById('prof-actions').innerHTML=`<button class="flex-1 max-w-[200px] h-11 rounded-full ${fol?'glass text-white':'bg-white text-black'} font-semibold text-[14px] press" onclick="toggleFollow('${key}')">${fol?'Вы подписаны':'Подписаться'}</button><button onclick="go('messages')" class="w-11 h-11 rounded-full glass flex items-center justify-center press"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>`;
}
function toggleFollow(key){DB.following[key]=!DB.following[key];save();toast(DB.following[key]?'Подписка':'Отписка');openProfile(key)}
async async function shareProfile(){
 const url=location.origin+location.pathname+'?profile='+encodeURIComponent(DB.me.handle.replace(/^@/,''));
 try{
  if(navigator.share){await navigator.share({title:DB.me.name,text:'Мой профиль',url});return}
  if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(url);toast('Ссылка скопирована');return}
  toast('Браузер не разрешил поделиться ссылкой');
 }catch(e){if(e&&e.name!=='AbortError')toast('Не удалось поделиться ссылкой')}
}
function renderMe(){
  document.getElementById('me-name').textContent=DB.me.name;
  document.getElementById('me-handle').textContent=DB.me.handle;
  document.getElementById('me-bio').textContent=DB.me.bio;
  document.getElementById('me-posts').textContent=DB.posts.filter(p=>p.author==='Вы'||p.author===DB.me.name).length;
}
function openEditProfile(){
  document.getElementById('edit-name').value=DB.me.name;
  document.getElementById('edit-handle').value=DB.me.handle;
  document.getElementById('edit-bio').value=DB.me.bio;
  document.getElementById('bd').classList.add('open');
  document.getElementById('edit-sheet').classList.add('open');
  setNav(false);
}
function saveProfile(){
  DB.me.name=document.getElementById('edit-name').value.trim()||'Вы';
  DB.me.handle=document.getElementById('edit-handle').value.trim()||'@you';
  if(!DB.me.handle.startsWith('@'))DB.me.handle='@'+DB.me.handle;
  DB.me.bio=document.getElementById('edit-bio').value.trim()||'';
  save();closeSheet();renderMe();toast('Профиль сохранён');
}
function openChannel(id){
  const ch=DB.channels.find(c=>c.id===id);if(!ch)return;DB.activeChannel=id;
  document.getElementById('ch-cover').src=ch.cover;
  document.getElementById('ch-av').src=ch.avatar;
  document.getElementById('ch-name').textContent=ch.name;
  document.getElementById('ch-meta').textContent=ch.members+' подписчиков';
  document.getElementById('ch-desc').textContent=ch.desc;
  const sub=!!DB.channelSub[id];
  const btn=document.getElementById('ch-sub');
  btn.textContent=sub?'Вы подписаны':'Подписаться';
  btn.className=sub?'w-full h-10 rounded-full glass text-white font-semibold text-[14px] press mb-3':'w-full h-10 rounded-full bg-white text-black font-semibold text-[14px] press mb-3';
  document.getElementById('ch-posts').innerHTML=ch.posts.map(p=>`<article class="rounded-2xl overflow-hidden bg-[#141416] border border-white/5"><img src="${p.image}" class="w-full h-[160px] object-cover"><div class="p-3.5"><h3 class="text-[15px] font-semibold">${p.title}</h3><p class="text-[12.5px] text-white/50 mt-1">${esc(p.text)}</p><p class="text-[11px] text-white/35 mt-2">♥ ${p.likes}</p></div></article>`).join('');
}
function toggleChSub(){if(!DB.activeChannel)return;DB.channelSub[DB.activeChannel]=!DB.channelSub[DB.activeChannel];save();toast(DB.channelSub[DB.activeChannel]?'Подписка на канал':'Отписались');openChannel(DB.activeChannel)}
function openShop(id){
  const sh=DB.shops.find(s=>s.id===id);if(!sh)return;DB.activeShop=id;
  document.getElementById('sh-name').textContent=sh.name;
  document.getElementById('sh-meta').textContent=sh.products+' товаров';
  document.getElementById('sh-desc').textContent=sh.desc;
  document.getElementById('sh-grid').innerHTML=sh.items.map(i=>`<button class="rounded-2xl overflow-hidden bg-[#141416] border border-white/5 text-left press" onclick="openProduct('${sh.id}','${i.id}')"><img src="${i.image}" class="w-full aspect-square object-cover"><div class="p-2.5"><p class="text-[12.5px] font-semibold truncate">${i.name}</p><p class="text-[13px] font-bold mt-0.5">${i.price.toLocaleString('ru-RU')} ₽</p></div></button>`).join('');
  updateCartBadge();
}
function openProduct(sid,iid){
  const sh=DB.shops.find(s=>s.id===sid);const item=sh?.items.find(i=>i.id===iid);if(!item)return;
  DB.activeProduct={shopId:sid,item};
  document.getElementById('pdetail').innerHTML=`<img src="${item.image}" class="w-full aspect-square object-cover rounded-2xl mb-3"><h3 class="text-[20px] font-bold">${item.name}</h3><p class="text-[18px] font-bold mt-1 gt">${item.price.toLocaleString('ru-RU')} ₽</p><p class="text-[13px] text-white/55 mt-2">${item.desc}</p>`;
  document.getElementById('pfoot').innerHTML=`<button onclick="addToCart()" class="w-full h-11 rounded-full bg-white text-black font-semibold text-[14px] press">В корзину</button>`;
  document.getElementById('bd').classList.add('open');document.getElementById('product-sheet').classList.add('open');setNav(false);
}
function addToCart(){if(!DB.activeProduct)return;const {item}=DB.activeProduct;const ex=DB.cart.find(c=>c.id===item.id);if(ex)ex.qty++;else DB.cart.push({...item,qty:1});save();updateCartBadge();toast('В корзине');closeSheet()}
function updateCartBadge(){const n=DB.cart.reduce((s,c)=>s+c.qty,0);const b=document.getElementById('cart-n');if(n){b.textContent=n;b.classList.remove('hidden')}else b.classList.add('hidden')}
function openCart(){
  const list=document.getElementById('cart-list');
  if(!DB.cart.length){list.innerHTML='<div class="empty">Корзина пуста</div>';document.getElementById('cart-foot').innerHTML=''}
  else{
    list.innerHTML=DB.cart.map(c=>`<div class="flex gap-2.5 items-center"><img src="${c.image}" class="w-14 h-14 rounded-xl object-cover"><div class="flex-1"><p class="text-[13px] font-semibold">${c.name}</p><p class="text-[12px] text-white/50">${c.price.toLocaleString('ru-RU')} ₽ × ${c.qty}</p></div><button class="text-white/40 text-[11px] press" onclick="rmCart('${c.id}')">✕</button></div>`).join('');
    const total=DB.cart.reduce((s,c)=>s+c.price*c.qty,0);
    document.getElementById('cart-foot').innerHTML=`<div class="flex justify-between mb-2.5"><span class="text-white/50 text-[13px]">Итого</span><span class="font-bold">${total.toLocaleString('ru-RU')} ₽</span></div><button onclick="checkout()" class="w-full h-11 rounded-full bg-white text-black font-semibold text-[14px] press">Оформить</button>`;
  }
  document.getElementById('bd').classList.add('open');document.getElementById('cart-sheet').classList.add('open');setNav(false);
}
function rmCart(id){DB.cart=DB.cart.filter(c=>c.id!==id);save();updateCartBadge();openCart()}
function checkout(){toast('Оформление заказов подключим вместе с сервером. Корзина сохранена.')}
function renderNotifs(){
  if(!DB.notifications.length){document.getElementById('nlist').innerHTML='<div class="empty">Нет уведомлений</div>';document.getElementById('ndot').style.display='none';return}
  document.getElementById('nlist').innerHTML=DB.notifications.map(n=>`<div class="flex gap-3 p-3 rounded-2xl ${n.read?'bg-white/[0.03]':'bg-white/[0.07]'} border border-white/[0.04]"><div class="w-11 h-11 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">${n.avatar?`<img src="${n.avatar}" class="w-full h-full object-cover">`:'🔔'}</div><div class="flex-1"><p class="text-[13px]"><span class="font-semibold">${n.title}</span> <span class="text-white/55">${n.body}</span></p><p class="text-[11px] text-white/35 mt-0.5">${n.time}</p></div></div>`).join('');
  document.getElementById('ndot').style.display=DB.notifications.some(n=>!n.read)?'':'none';
}
function markRead(){DB.notifications.forEach(n=>n.read=true);save();renderNotifs();toast('Прочитано')}
function renderChats(){
  const q=(document.getElementById('csearch')?.value||'').toLowerCase();
  const list=DB.chats.filter(c=>!q||c.name.toLowerCase().includes(q));
  document.getElementById('clist').innerHTML=list.length?list.map(c=>`<button class="w-full flex items-center gap-3 px-3 py-3 press text-left" onclick="go('chat',{chatId:'${c.id}'})"><img src="${c.avatar}" class="w-12 h-12 rounded-full object-cover"><div class="flex-1 min-w-0"><div class="flex justify-between"><p class="text-[14px] font-semibold truncate">${c.name}</p><span class="text-[10px] text-white/35">${c.time}</span></div><p class="text-[12.5px] text-white/45 truncate">${c.last}</p></div>${c.unread?`<span class="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style="background:linear-gradient(135deg,#a855f7,#ec4899)">${c.unread}</span>`:''}</button>`).join(''):'<div class="empty">Нет чатов</div>';
  const u=DB.chats.reduce((s,c)=>s+c.unread,0);const b=document.getElementById('mbadge');if(u){b.textContent=u;b.classList.remove('hidden')}else b.classList.add('hidden');
}
function openChat(id){const c=DB.chats.find(x=>x.id===id);if(!c)return;DB.activeChat=id;c.unread=0;save();document.getElementById('cv-av').src=c.avatar;document.getElementById('cv-name').textContent=c.name;const box=document.getElementById('cmsgs');box.innerHTML=c.messages.map(m=>`<div class="flex ${m.me?'justify-end':''}"><div class="max-w-[78%] px-3.5 py-2 text-[14px] ${m.me?'bubble-me':'bubble-them'}">${esc(m.text)}</div></div>`).join('');box.scrollTop=box.scrollHeight;renderChats()}
function sendMsg(){const inp=document.getElementById('cinput');const t=inp.value.trim();if(!t||!DB.activeChat)return;const c=DB.chats.find(x=>x.id===DB.activeChat);c.messages.push({me:true,text:t});c.last=t;c.time='сейчас';inp.value='';save();openChat(c.id)}
function renderExplore(){
  const q=(document.getElementById('eq')?.value||'').toLowerCase();
  const tab=DB.etab;let h='';
  const people=Object.entries(DB.profiles).filter(([k,p])=>!q||p.name.toLowerCase().includes(q)||p.handle.toLowerCase().includes(q));
  const ch=DB.channels.filter(c=>!q||c.name.toLowerCase().includes(q));
  const sh=DB.shops.filter(s=>!q||s.name.toLowerCase().includes(q));
  if(tab==='all'||tab==='people'){if(people.length)h+=`<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2">Люди</p>`+people.map(([k,p])=>`<button class="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.04] mb-1.5 press" onclick="go('profile',{key:'${k}'})"><img src="https://i.pravatar.cc/64?u=${k}" class="w-11 h-11 rounded-full"><div class="text-left"><p class="text-[14px] font-semibold">${p.name}</p><p class="text-[12px] text-white/40">${p.handle}</p></div></button>`).join('')}
  if(tab==='all'||tab==='channels'){if(ch.length)h+=`<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2 mt-3">Каналы</p>`+ch.map(c=>`<button class="w-full text-left p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04] mb-1.5 press" onclick="go('channel',{id:'${c.id}'})"><p class="text-[14px] font-semibold">${c.name}</p><p class="text-[12px] text-white/40 mt-0.5">${c.desc} · ${c.members}</p></button>`).join('')}
  if(tab==='all'||tab==='shops'){if(sh.length)h+=`<p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2 mt-3">Магазины</p>`+sh.map(s=>`<button class="w-full text-left p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.04] mb-1.5 press" onclick="go('shop',{id:'${s.id}'})"><p class="text-[14px] font-semibold">${s.name}</p><p class="text-[12px] text-white/40 mt-0.5">${s.desc} · ${s.products} товаров</p></button>`).join('')}
  document.getElementById('eres').innerHTML=h||'<div class="empty">Ничего не найдено</div>';
}
document.getElementById('etabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;DB.etab=b.dataset.t;document.querySelectorAll('.etab').forEach(x=>{const on=x.dataset.t===DB.etab;x.className='etab px-3.5 py-1.5 rounded-full text-[12px] '+(on?'font-semibold bg-white text-black':'font-medium glass text-white/70')});renderExplore()});
function renderSettings(){
  document.getElementById('sbody').innerHTML=[
    ['Аккаунт',['Профиль','Конфиденциальность','Блокировки']],
    ['Уведомления',['Push','Категории']],
    ['Безопасность',['2FA','Сессии']],
    ['Данные',['Очистить кэш','Сбросить демо']]
  ].map(([t,items])=>`<div><p class="text-[10px] text-white/35 uppercase tracking-wider font-semibold mb-2 px-1">${t}</p><div class="rounded-2xl bg-white/[0.04] border border-white/[0.04] overflow-hidden divide-y divide-white/[0.04]">${items.map(i=>`<button class="w-full text-left px-4 py-3.5 text-[14px] press flex justify-between items-center" onclick="settingAction('${i}')"><span>${i}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>`).join('')}</div></div>`).join('')+`<p class="text-center text-[11px] text-white/20 pt-4">Atlantis · демо v2 · данные на устройстве</p>`;
}
function settingAction(i){
  if(i==='Сбросить демо'){localStorage.removeItem(LS);location.reload();return}
  if(i==='Очистить кэш'){toast('Кэш очищен');return}
  if(i==='Профиль'){go('me');return}
  toast(i+' пока не подключено к серверной части');
}
function openCreate(){
  document.getElementById('create-opts').innerHTML=[
    ['Пост','В ленту','📝','post'],
    ['История','Атлас 24ч','✦','story'],
    ['Канал','Для аудитории','📡','ch'],
    ['Магазин','Каталог','🛍','shop']
  ].map(([t,d,i,a])=>`<button class="w-full flex items-center gap-3 px-2 py-3 rounded-2xl press text-left" data-a="${a}"><div class="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center text-[16px]">${i}</div><div><p class="text-[14px] font-semibold">${t}</p><p class="text-[11.5px] text-white/40">${d}</p></div></button>`).join('');
  document.querySelectorAll('#create-opts [data-a]').forEach(b=>{
    b.onclick=()=>{
      const a=b.dataset.a;
      if(a==='post'){closeSheet();go('compose')}
      else if(a==='story'){addMyStory()}
      else if(a==='ch'){closeSheet();go('channel',{id:'ch1'})}
      else if(a==='shop'){closeSheet();go('shop',{id:'sh1'})}
    };
  });
  document.getElementById('bd').classList.add('open');
  document.getElementById('create-sheet').classList.add('open');
  setNav(false);
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
  const images=[...DB.composeImgs];
  DB.posts.unshift({
    id:'p'+Date.now(),author:DB.me.name,authorKey:null,avatar:'https://i.pravatar.cc/64?u=me',
    image:images[0]||null,images,likes:0,comments:0,liked:false,saved:false,text:text||'',
    commentList:[]
  });
  DB.composeImgs=[];save();toast('Опубликовано');go('home');
}
function closeSheet(){
  ['bd','create-sheet','comments-sheet','product-sheet','cart-sheet','edit-sheet'].forEach(id=>document.getElementById(id)?.classList.remove('open'));
  setNav(true);
}
if(!DB.onboarded)document.getElementById('onboarding').classList.add('on');
renderStories();renderFeed();renderNotifs();renderChats();renderMe();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
