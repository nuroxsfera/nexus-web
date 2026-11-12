(function(){
  const DB_NAME='nexus-health-vault';
  let dbPromise=null,key=null,record=null,ready=false,writeQueue=Promise.resolve();
  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(function(resolve,reject){
      if(!window.indexedDB){reject(new Error('Зашифрованное хранилище недоступно в этом браузере'));return}
      const request=window.indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains('vault'))request.result.createObjectStore('vault',{keyPath:'id'})};
      request.onsuccess=function(){resolve(request.result)};
      request.onerror=function(){reject(request.error||new Error('Не удалось открыть хранилище'))};
    });
    return dbPromise;
  }
  async function readRecord(){
    const db=await openDb();
    return await new Promise(function(resolve,reject){
      const request=db.transaction('vault','readonly').objectStore('vault').get('health');
      request.onsuccess=function(){resolve(request.result||null)};
      request.onerror=function(){reject(request.error||new Error('Не удалось прочитать хранилище'))};
    });
  }
  async function writeRecord(value){
    const db=await openDb();
    await new Promise(function(resolve,reject){
      const tx=db.transaction('vault','readwrite');
      tx.objectStore('vault').put(value);
      tx.oncomplete=resolve;
      tx.onerror=function(){reject(tx.error||new Error('Не удалось сохранить хранилище'))};
    });
  }
  async function deriveKey(passphrase,salt){
    if(!window.crypto||!window.crypto.subtle)throw new Error('Шифрование недоступно: открой приложение по HTTPS');
    const material=await window.crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
    return await window.crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function getPayload(db){
    return JSON.stringify({fitnessProfile:db.fitnessProfile||{},workouts:db.workouts||[],nutritionEntries:db.nutritionEntries||[],healthMeasurements:db.healthMeasurements||[]});
  }
  async function persist(db){
    if(!key||!record)return;
    writeQueue=writeQueue.catch(function(){return undefined}).then(async function(){
      const iv=window.crypto.getRandomValues(new Uint8Array(12));
      const plaintext=new TextEncoder().encode(getPayload(db));
      const ciphertext=await window.crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,plaintext);
      record={id:'health',salt:record.salt,iv:iv.buffer,ciphertext:ciphertext,updatedAt:Date.now()};
      await writeRecord(record);
    });
    return writeQueue;
  }
  async function setup(passphrase,db){
    if(typeof passphrase!=='string'||passphrase.length<12)throw new Error('Парольная фраза должна содержать не менее 12 символов');
    const salt=window.crypto.getRandomValues(new Uint8Array(16));
    key=await deriveKey(passphrase,salt);
    record={id:'health',salt:salt.buffer};
    db.healthVaultUnlocked=true;
    await persist(db);
    return true;
  }
  async function unlock(passphrase,db){
    record=await readRecord();
    if(!record||!record.ciphertext)throw new Error('Личное хранилище ещё не создано');
    key=await deriveKey(passphrase,new Uint8Array(record.salt));
    try{
      const plaintext=await window.crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},key,record.ciphertext);
      const payload=JSON.parse(new TextDecoder().decode(plaintext));
      db.fitnessProfile=payload.fitnessProfile||{};
      db.workouts=payload.workouts||[];
      db.nutritionEntries=payload.nutritionEntries||[];
      db.healthMeasurements=payload.healthMeasurements||[];
      db.healthVaultUnlocked=true;
      return true;
    }catch(error){key=null;throw new Error('Неверный пароль или повреждённое хранилище')}
  }
  async function lock(db){
    if(key)await persist(db);
    key=null;
    db.healthVaultUnlocked=false;
    db.fitnessProfile={};db.workouts=[];db.nutritionEntries=[];db.healthMeasurements=[];
  }
  function toBase64(value){
    const bytes=new Uint8Array(value);let binary='';
    for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
    return window.btoa(binary);
  }
  function fromBase64(value){
    const binary=window.atob(value),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes.buffer;
  }
  async function exportEncrypted(){
    await writeQueue.catch(function(){return undefined});
    const current=await readRecord();if(!current||!current.ciphertext)throw new Error('Сейф ещё не создан');
    return {format:'nexus-health-vault',version:1,salt:toBase64(current.salt),iv:toBase64(current.iv),ciphertext:toBase64(current.ciphertext),updatedAt:current.updatedAt||null};
  }
  async function importEncrypted(bundle){
    if(!bundle||bundle.format!=='nexus-health-vault'||bundle.version!==1||typeof bundle.salt!=='string'||typeof bundle.iv!=='string'||typeof bundle.ciphertext!=='string')throw new Error('Файл не является резервной копией Nexus');
    const salt=fromBase64(bundle.salt),iv=fromBase64(bundle.iv),ciphertext=fromBase64(bundle.ciphertext);
    if(salt.byteLength!==16||iv.byteLength!==12||ciphertext.byteLength<16||ciphertext.byteLength>25*1024*1024)throw new Error('Повреждённая или слишком большая резервная копия');
    await writeQueue.catch(function(){return undefined});
    record={id:'health',salt,iv,ciphertext,updatedAt:bundle.updatedAt||Date.now()};
    await writeRecord(record);key=null;ready=true;return true;
  }
  async function initialize(db){
    try{record=await readRecord()}catch(error){window.NEXUS_HEALTH_VAULT.error=error}
    ready=true;
    if(record&&db){db.fitnessProfile={};db.workouts=[];db.nutritionEntries=[];db.healthMeasurements=[];db.healthVaultUnlocked=false}
    window.dispatchEvent(new Event('nexus:health-vault-ready'));
    return !!record;
  }
  window.NEXUS_HEALTH_VAULT={initialize:initialize,setup:setup,unlock:unlock,lock:lock,persist:persist,exportEncrypted:exportEncrypted,importEncrypted:importEncrypted,hasVault:function(){return !!record},isReady:function(){return ready},isUnlocked:function(){return !!key}};
})();