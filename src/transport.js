/* Bridge from the installable GitHub app to the existing Google Sheet service. */
var MiamBridge=(function(){
  'use strict';
  var nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),function(b){return b.toString(16).padStart(2,'0');}).join('');
  var remote=null,origin=null,frame=null,ready=null,sequence=0,pending=new Map();
  function connect(){
    if(ready)return ready;
    ready=new Promise(function(resolve,reject){
      var timer=setTimeout(function(){ready=null;if(frame)frame.remove();frame=null;window.removeEventListener('message',hello);reject(new Error('Le stock Google ne répond pas. Vérifiez Internet puis réessayez. Si le navigateur bloque les contenus intégrés, ouvrez le stock depuis le lien Google proposé dans l’aide.'));},25000);
      function hello(e){var d=e.data;if(!d||d.type!=='miam.ready'||d.nonce!==nonce||!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(e.origin)||!e.source)return;remote=e.source;origin=e.origin;clearTimeout(timer);window.removeEventListener('message',hello);resolve();}
      window.addEventListener('message',hello);
      frame=document.createElement('iframe');frame.title='Connexion au stock familial';frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.src=window.MIAM_GOOGLE_WEBAPP_URL+'?bridge=1&nonce='+nonce;document.body.appendChild(frame);
    });return ready;
  }
  window.addEventListener('message',function(e){var d=e.data;if(!remote||e.source!==remote||e.origin!==origin||!d||d.type!=='miam.result'||d.nonce!==nonce)return;var item=pending.get(d.id);if(!item)return;pending.delete(d.id);clearTimeout(item.timer);if(d.failure)item.reject(new Error('La connexion au stock a échoué. Vous pouvez réessayer.'));else item.resolve(d.result);});
  async function send(action,args){await connect();return new Promise(function(resolve,reject){var id=++sequence;var timer=setTimeout(function(){pending.delete(id);reject(new Error('La réponse du stock tarde. Réessayez la même action pour éviter un doublon.'));},25000);pending.set(id,{resolve:resolve,reject:reject,timer:timer});remote.postMessage({type:'miam.rpc',nonce:nonce,id:id,action:action,args:args},origin);});}
  return {send:send};
})();
