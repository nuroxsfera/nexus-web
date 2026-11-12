// Atlantis v16 loader
(function(){
  function load(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
  load('/app-data.js').then(function(){return load('/app-logic.js');}).catch(function(e){console.error(e);});
})();
