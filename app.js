// Atlantis v16 loader
(function(){
  function load(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
  load('/app-data.js').then(function(){return load('/health-vault.js');}).then(function(){return window.NEXUS_HEALTH_VAULT.initialize(DB);}).then(function(){save();return load('/auth.js');}).then(function(){return window.NEXUS_AUTH.initialize().catch(function(e){console.warn('Auth initialization skipped:',e);return false;});}).then(function(){return load('/cloud-social.js');}).then(function(){return load('/app-logic.js');}).catch(function(e){console.error(e);});
})();
