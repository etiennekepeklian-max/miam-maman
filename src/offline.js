/* Durable outbox. The journal operation ID is retained across every retry. */
var MiamOffline=(function(){
  'use strict';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function storage(key){
    var opened=new Promise(function(resolve,reject){if(!window.indexedDB){reject(new Error('Le stockage de ce navigateur est indisponible. Utilisez Chrome hors navigation privée.'));return;}var request=indexedDB.open('miam-maman-offline-v1',1);request.onupgradeneeded=function(){request.result.createObjectStore('households');};request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(new Error('Impossible d’ouvrir le stockage du téléphone.'));};});
    function update(fn){return opened.then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('households','readwrite'),store=tx.objectStore('households'),get=store.get(key),value,result,problem;get.onsuccess=function(){try{value=get.result||{base:null,queue:[],lastSync:null};result=fn(value);store.put(value,key);}catch(e){problem=e;tx.abort();}};tx.oncomplete=function(){resolve(result);};tx.onabort=tx.onerror=function(){reject(problem||new Error('Le téléphone n’a pas pu conserver cette action. Vérifiez son espace disponible.'));};});});}
    return {update:update};
  }
  function create(options){
    var db=options.storage||storage(options.key),core=options.core,send=options.send,online=options.online||function(){return navigator.onLine;},notify=options.onChange||function(){},tokens={},flushing=null,current=null,lastError=null;
    function view(record){var state=record.base?clone(record.base):core.empty(),blocked=false;for(var entry of record.queue){if(entry.status==='conflict'){blocked=true;continue;}if(blocked)continue;try{var event=core.command(state,'maison',entry.action,entry.payload,entry.id,entry.at,entry.profile);if(event)state=core.replay(state.events.concat([event]));}catch(e){entry.status='conflict';entry.error=e.message;entry.confirmedRejected=false;blocked=true;}}return state;}
    function result(record){return {ok:true,state:view(record),pending:record.queue.length>0,offline:!online()||!!lastError,lastSync:record.lastSync,queue:clone(record.queue),error:lastError};}
    async function snapshot(){return db.update(result);}
    async function remember(state){return db.update(function(r){r.base=state;r.lastSync=new Date().toISOString();return result(r);});}
    async function tokenFor(profile,renew){if(tokens[profile]&&!renew)return tokens[profile];var r=await send('login',{profile:profile,token:null});tokens[profile]=r.token;await remember(r.state);return r.token;}
    function changed(){Promise.resolve().then(notify).catch(function(){});}
    async function sync(){if(flushing)return flushing;if(!online())return snapshot();flushing=(async function(){
      try{
        lastError=null;
        for(;;){var head=await db.update(function(r){return r.queue.length?clone(r.queue[0]):null;});if(!head||head.status==='conflict')break;
          try{
            var token=await tokenFor(head.profile),r;
            try{r=await send(head.action,{token:token,id:head.id,payload:head.payload});}catch(e){if(e.code!=='PROFILE_SESSION_EXPIRED')throw e;token=await tokenFor(head.profile,true);r=await send(head.action,{token:token,id:head.id,payload:head.payload});}
            await db.update(function(record){record.base=r.state;record.lastSync=new Date().toISOString();record.queue=record.queue.filter(function(x){return x.id!==head.id;});return result(record);});
          }catch(e){
            if(e.serverReply&&e.code!=='PROFILE_SESSION_EXPIRED'){
              // The server explicitly rejected it; never silently alter its payload or ID.
              try{var refreshed=await send('state',{token:tokens[head.profile]});await remember(refreshed.state);}catch(ignore){}
              await db.update(function(r){var entry=r.queue.find(function(x){return x.id===head.id;});if(entry){entry.status='conflict';entry.error=e.message;entry.confirmedRejected=true;}return result(r);});
            }else lastError=e.message;
            break;
          }
        }
        return await snapshot();
      }finally{flushing=null;changed();}
    })();return flushing;}
    async function login(profile){core.profile(profile);current=profile;if(online()){try{var token=await tokenFor(profile,true);sync().catch(function(){});var r=await snapshot();return Object.assign(r,{profile:profile,role:'maison',token:token});}catch(e){lastError=e.message;}}
      var cached=await db.update(function(record){if(!record.base)throw new Error('Pour utiliser le stock à la cave, ouvrez d’abord l’application une fois avec Internet.');return result(record);});return Object.assign(cached,{profile:profile,role:'maison',token:'offline'});
    }
    async function mutate(action,payload,id,profile){core.profile(profile);var r=await db.update(function(record){if(!record.base)throw new Error('Ouvrez le stock avec Internet avant le premier usage hors connexion.');if(record.queue.some(function(x){return x.status==='conflict';}))throw new Error('Une action attend votre vérification. Ouvrez les envois en attente avant de continuer.');var state=view(record),existing=record.queue.find(function(x){return x.id===id;});if(existing){if(existing.action!==action||existing.profile!==profile||JSON.stringify(existing.payload)!==JSON.stringify(payload))throw new Error('Cette action en attente existe avec un contenu différent.');}else{var at=new Date().toISOString(),event=core.command(state,'maison',action,payload,id,at,profile);if(event)record.queue.push({id:id,action:action,payload:clone(payload),profile:profile,at:at,status:'pending'});}var answer=result(record);answer.eventId=id;return answer;});changed();if(online())setTimeout(function(){sync().catch(function(){});},0);return r;}
    async function refresh(){if(online()){await sync();if(current){try{var token=await tokenFor(current),r=await send('state',{token:token});lastError=null;return remember(r.state);}catch(e){lastError=e.message;}}}return snapshot();}
    async function retry(){await db.update(function(r){r.queue.forEach(function(x){if(x.status==='conflict'&&x.confirmedRejected){x.status='pending';delete x.error;}});return result(r);});return refresh();}
    async function discard(id){await db.update(function(r){var index=r.queue.findIndex(function(x){return x.id===id;});if(index<0)return;if(r.queue[index].status!=='conflict')throw new Error('Un envoi sans confirmation peut déjà avoir été reçu. Reconnectez-vous avant de l’annuler.');r.queue.splice(index,1);r.queue.forEach(function(x){if(x.status==='conflict'&&!x.confirmedRejected){x.status='pending';delete x.error;}});return result(r);});changed();return refresh();}
    async function logout(){current=null;return {ok:true};}
    return {login:login,mutate:mutate,refresh:refresh,snapshot:snapshot,sync:sync,retry:retry,discard:discard,logout:logout};
  }
  return {create:create,storage:storage};
})();
