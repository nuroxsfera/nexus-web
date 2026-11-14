/* Nexus PWA lifecycle: registration, safe updates and install-state detection. */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator)) return;

  var registration=null;
  var reloadOnControllerChange=false;
  var banner=null;

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  }

  function ensureBanner(){
    if(banner) return banner;
    banner=document.createElement('div');
    banner.id='pwa-update-banner';
    banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite');
    banner.innerHTML='<span class="pwa-update-copy">Доступна новая версия приложения</span><button type="button" class="pwa-update-action">Обновить</button>';
    var style=document.createElement('style');
    style.textContent='#pwa-update-banner{position:fixed;z-index:10000;top:calc(12px + env(safe-area-inset-top,0px));left:12px;right:12px;max-width:406px;margin:0 auto;padding:11px 12px 11px 16px;display:flex;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(20,21,30,.96);box-shadow:0 16px 50px rgba(0,0,0,.48);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);font:600 13px/1.35 Inter,system-ui,sans-serif;color:#f7f5ff;opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .22s,transform .22s}#pwa-update-banner.visible{opacity:1;transform:translateY(0);pointer-events:auto}#pwa-update-banner .pwa-update-copy{flex:1}#pwa-update-banner .pwa-update-action{border:0;border-radius:999px;padding:9px 13px;background:linear-gradient(135deg,#eeeaff,#d9d1ff);color:#171321;font:700 12px Inter,system-ui,sans-serif;white-space:nowrap}';
    document.head.appendChild(style);
    document.body.appendChild(banner);
    banner.querySelector('button').addEventListener('click',function(){
      if(registration&&registration.waiting) registration.waiting.postMessage({type:'SKIP_WAITING'});
      banner.classList.remove('visible');
    });
    return banner;
  }

  function showUpdate(){
    ensureBanner().classList.add('visible');
  }

  function watchInstalling(worker){
    if(!worker) return;
    worker.addEventListener('statechange',function(){
      if(worker.state==='installed'&&navigator.serviceWorker.controller){
        showUpdate();
      }else if(worker.state==='installed'&&!navigator.serviceWorker.controller){
        worker.postMessage({type:'SKIP_WAITING'});
      }
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(reloadOnControllerChange) return;
    reloadOnControllerChange=true;
    window.location.reload();
  });

  function start(){
    navigator.serviceWorker.register('/sw.js',{scope:'/'})
      .then(function(reg){
        registration=reg;
        if(reg.waiting){
          if(navigator.serviceWorker.controller) showUpdate();
          else reg.waiting.postMessage({type:'SKIP_WAITING'});
        }
        watchInstalling(reg.installing);
        reg.addEventListener('updatefound',function(){watchInstalling(reg.installing);});
        window.addEventListener('focus',function(){
          if(navigator.onLine) reg.update().catch(function(){});
        });
      })
      .catch(function(error){console.warn('PWA service worker registration failed:',error);});
  }

  if(document.readyState==='complete') start();
  else window.addEventListener('load',start,{once:true});
})();
