(function () {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const app=$('#app'), modal=$('#modal'), body=$('#modalBody');
  const mascot=$('.brand-mascot').src;
  const live=!!(window.google && google.script && google.script.run);
  let installPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  window.addEventListener('appinstalled',()=>{$('#installApp').hidden=true;});
  if(window.matchMedia('(display-mode: standalone)').matches)$('#installApp').hidden=true;
  $('#installApp').onclick=async()=>{
    if(installPrompt){await installPrompt.prompt();installPrompt=null;return;}
    dialog('Installer Miam Maman !','<p>Sur Android, ouvrez ce lien dans <strong>Chrome</strong>, puis le menu <strong>⋮ → Ajouter à l’écran d’accueil → Installer</strong>.</p><p>Sur iPhone, ouvrez le lien dans Safari, puis <strong>Partager → Sur l’écran d’accueil</strong>.</p><p class="muted small">L’icône apparaîtra parmi vos applications. Le partage du stock reste soumis à l’activation Google, indiquée en haut de l’écran.</p>');
  };
  const icons={pot:'<path d="M5 10h14v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-7Z"/><path d="M3 10h18M2 12h3m14 0h3M8 7h8M10 4c-1-1 1-2 0-3m4 3c-1-1 1-2 0-3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',settings:'<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',pin:'<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',heart:'<path d="M20 5c-3-3-6 0-8 2-2-2-5-5-8-2s-1 7 8 14c9-7 11-11 8-14Z"/>',warning:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'};
  const icon=(n)=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+(icons[n]||icons.pot)+'</svg>';
  const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const localDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
  const prettyDate=(s)=>new Date(s+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  let state=MiamCore.empty(), role=null, token=null, page='stock', filter='all', query='', busy=false, lastSync=null, refreshing=false, recorder=null, toastTimer, mutationPending=null, selectedEmoji='🍲';
  let previewEvents=[];
  try { previewEvents=JSON.parse(localStorage.getItem('miam-preview-v1')||'[]'); if(!Array.isArray(previewEvents))previewEvents=[]; }catch{}
  function rpc(action,args={}) {
    if(live) return new Promise((resolve,reject)=>{
      google.script.run.withSuccessHandler(r=>{if(!r||!r.ok)reject(new Error(r?.error||'Réponse inattendue.'));else resolve(r);}).withFailureHandler(e=>reject(new Error(e.message||'La connexion a échoué.'))).rpc(action,{...args,token});
    });
    return new Promise((resolve,reject)=>{try{
      if(action==='login'){role=args.role;return resolve({ok:true,token:'preview',role,state:MiamCore.replay(previewEvents)});}
      if(action==='logout')return resolve({ok:true});
      if(action==='state')return resolve({ok:true,state:MiamCore.replay(previewEvents)});
      const s=MiamCore.replay(previewEvents);
      const e=MiamCore.command(s,role,action,args.payload,args.id,new Date().toISOString());
      if(e){previewEvents.push(e);localStorage.setItem('miam-preview-v1',JSON.stringify(previewEvents));}
      resolve({ok:true,state:MiamCore.replay(previewEvents),eventId:e?.id||args.id});
    }catch(e){reject(e);}});
  }
  function toast(message,undo) {
    clearTimeout(toastTimer);const t=$('#toast');t.innerHTML='<span>'+esc(message)+'</span>'+(undo?'<button id="toastUndo">Annuler</button>':'');t.hidden=false;
    if(undo)$('#toastUndo').onclick=()=>act('meal.undo',{eventId:undo},'La portion est de retour dans le stock.');
    toastTimer=setTimeout(()=>t.hidden=true,undo?14000:6500);
  }
  function error(target,message){target.innerHTML='<div class="form-error" role="alert">'+esc(message)+'</div>';}
  function dialog(title,html){if(modal.open)modal.close();$('#modalTitle').textContent=title;body.innerHTML=html;modal.showModal();}
  function close(){if(recorder){try{recorder.abort();}catch{}recorder=null;}modal.close();}
  $('#closeModal').onclick=close;modal.addEventListener('cancel',close);
  $('.brand').onclick=e=>{e.preventDefault();page='stock';render();};
  const locationsOptions=(value)=>state.locations.map(l=>'<option value="'+esc(l.id)+'" '+(value===l.id?'selected':'')+'>'+esc(l.name)+'</option>').join('');
  function mountNav(){
    $('#navigation').hidden=!role;$('#profileButton').hidden=!role;
    if(role)$('#profileButton').innerHTML='<span class="avatar">'+(role==='maman'?'👩‍🍳':'🍽️')+'</span>'+ (role==='maman'?'Maman':'Famille')+' <span aria-hidden="true">⌄</span>';
    document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
    document.querySelectorAll('[data-page]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.page===page);btn.setAttribute('aria-current',btn.dataset.page===page?'page':'false');btn.onclick=()=>{page=btn.dataset.page;render();window.scrollTo({top:0,behavior:'instant'});};});
  }
  function welcome(){
    app.innerHTML='<section class="welcome"><img class="welcome-mascot" src="'+mascot+'" alt="Notre cocotte souriante"><p class="eyebrow">LA CUISINE DE TOUTE LA FAMILLE</p><h1>Bienvenue à la maison.</h1><p>Les bons petits plats de Maman,<br>et le plaisir de les retrouver en un clin d’œil.</p><div class="roles"><button class="role-card" data-role="maman"><span aria-hidden="true">👩‍🍳</span><h2>C’est Maman !</h2><p>Je cuisine, je range<br>et je remplis le stock.</p><small>Entrer dans ma cuisine →</small></button><button class="role-card" data-role="famille"><span aria-hidden="true">🍽️</span><h2>La famille</h2><p>Je choisis un bon plat<br>et je me sers.</p><small>Voir ce qu’il reste →</small></button></div><p class="intro-note">Un stock commun. Deux comptes. Beaucoup d’amour.</p></section>';
    document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>login(b.dataset.role));
  }
  function login(nextRole){
    if(!live){rpc('login',{role:nextRole}).then(r=>{role=nextRole;page='stock';filter='all';query='';state=r.state;lastSync=new Date();render();});return;}
    if(nextRole==='maman'){
      rpc('ownerLogin').then(r=>{token=r.token;role=r.role;page='stock';filter='all';query='';state=r.state;lastSync=new Date();render();}).catch(()=>passwordLogin(nextRole));return;
    }
    passwordLogin(nextRole);
  }
  function passwordLogin(nextRole){
    dialog(nextRole==='maman'?'Bienvenue, Maman !':'À table, la famille !','<div class="login-role" aria-hidden="true">'+(nextRole==='maman'?'👩‍🍳':'🍽️')+'</div><form id="loginForm"><label class="field"><span>Votre code d’accès</span><input type="password" id="password" required autocomplete="current-password" minlength="6" maxlength="64" placeholder="Code du compte '+(nextRole==='maman'?'Maman':'Famille')+'"></label><div id="loginError"></div><button class="primary wide" type="submit">Entrer dans la cuisine '+icon('arrow')+'</button></form>');
    $('#loginForm').onsubmit=async e=>{e.preventDefault();const btn=$('button[type=submit]',e.target);btn.disabled=true;try{const r=await rpc('login',{role:nextRole,password:$('#password').value});token=r.token;role=r.role;page='stock';filter='all';query='';state=r.state;lastSync=new Date();close();render();}catch(e){error($('#loginError'),e.message);}finally{btn.disabled=false;}};
  }
  $('#profileButton').onclick=()=>dialog('À chacun sa cuisine','<p class="muted">Compte actuel : <strong>'+ (role==='maman'?'Maman':'Famille')+'</strong>.</p><button id="switchAccount" class="secondary wide">Changer de compte</button>');
  document.addEventListener('click',async e=>{if(e.target.closest('#switchAccount')){if(busy)return;try{await rpc('logout');}catch{}role=null;token=null;state=MiamCore.empty();close();render();}});
  function render(){mountNav();if(!role)return welcome();if(page==='stock')stock();if(page==='settings')settings();if(page==='history')history();}
  function stock(){
    const total=state.meals.reduce((s,m)=>s+m.quantity,0), low=state.meals.filter(m=>m.quantity>0&&m.quantity<=m.threshold).length;
    app.innerHTML='<section class="hero"><div class="hero-copy"><p class="eyebrow">DU FAIT MAISON, AVEC AMOUR</p><h1>'+ (role==='maman'?'Qu’est-ce qu’on mijote ?':'Qu’est-ce qu’on mange ?')+'</h1><p>'+ (role==='maman'?'Un bon petit plat, une place au frais, et la famille se régale.':'Il reste toujours un peu d’amour dans les petits plats de Maman.')+'</p></div><img src="'+mascot+'" alt="" aria-hidden="true"></section><div class="summary"><div class="summary-pill">'+icon('pot')+'<strong>'+total+'</strong> portion'+(total===1?'':'s')+' en réserve</div><p class="small muted">'+state.meals.filter(m=>m.quantity>0).length+' préparation(s)</p></div>'+(role==='maman'?'<button class="primary" id="addMeal">'+icon('plus')+' Maman a cuisiné</button>':'')+'<div class="toolbar"><label class="search">'+icon('search')+'<input id="search" type="search" aria-label="Rechercher un plat ou un emplacement" placeholder="Un plat, un emplacement…" value="'+esc(query)+'"></label><div class="filters"><button class="chip '+(filter==='all'?'selected':'')+'" data-filter="all">Tous les plats</button><button class="chip '+(filter==='low'?'selected':'')+'" data-filter="low">Bientôt fini'+(low?' · '+low:'')+'</button><button class="chip '+(filter==='empty'?'selected':'')+'" data-filter="empty">Terminés</button></div></div><div id="mealResults"></div><div class="tip">'+icon('heart')+'<span>'+ (role==='maman'?'Chaque préparation garde sa date et son emplacement. Les plus anciennes apparaissent en premier.':'Une portion prise ? Pensez à la déclarer pour que toute la famille retrouve le bon stock.')+'</span></div>';
    if($('#addMeal'))$('#addMeal').onclick=()=>addMeal();
    $('#search').oninput=e=>{query=e.target.value;results();};
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;stock();});results();
  }
  function results(){
    const meals=state.meals.filter(m=>(filter==='empty'?m.quantity===0:filter==='low'?m.quantity>0&&m.quantity<=m.threshold:m.quantity>0)&&MiamCore.norm(m.name+' '+m.locationName+' '+m.detail).includes(MiamCore.norm(query))).sort((a,b)=>a.preparedAt.localeCompare(b.preparedAt));
    const box=$('#mealResults');
    if(!state.meals.length){box.innerHTML='<div class="empty"><img src="'+mascot+'" alt=""><h2>La cocotte attend ses petits plats.</h2><p>'+ (role==='maman'?(state.locations.length?'Enregistrez votre première préparation. La famille n’aura plus qu’à se régaler.':'Commencez par créer vos propres emplacements, puis ajoutez votre première préparation.'):'Maman n’a pas encore enregistré de préparation. Revenez bientôt !')+'</p>'+(role==='maman'?'<button id="firstAction" class="secondary">'+icon('plus')+' '+(state.locations.length?'Ajouter un plat':'Créer un emplacement')+'</button>':'')+'</div>';if($('#firstAction'))$('#firstAction').onclick=()=>state.locations.length?addMeal():addLocation(()=>{page='stock';render();});return;}
    box.innerHTML='<div class="section-heading"><h2>'+ (filter==='empty'?'Victimes de leur succès':filter==='low'?'On arrive au bout !':'Les petits plats disponibles')+'</h2><span>'+meals.length+' préparation(s)</span></div>'+(meals.length?'<div class="meals">'+meals.map(m=>'<article class="meal">'+(role==='maman'?'<button class="more icon-button" data-edit="'+esc(m.id)+'" aria-label="Modifier '+esc(m.name)+'">⋯</button>':'')+'<div class="meal-top"><div class="meal-emoji" aria-hidden="true">'+m.emoji+'</div><div class="meal-title"><h3>'+esc(m.name)+'</h3><span class="prepared">Préparé le '+prettyDate(m.preparedAt)+'</span></div></div><div class="place">'+icon('pin')+'<div><strong>'+esc(m.locationName)+'</strong>'+(m.detail?'<br>'+esc(m.detail):'')+'</div></div><div class="meal-bottom"><div class="quantity"><strong>'+m.quantity+'</strong><span>portion'+(m.quantity===1?'':'s')+'</span></div>'+(m.quantity>0&&role==='famille'?'<button class="secondary" data-take="'+esc(m.id)+'">'+icon('minus')+' Je me sers</button>':'')+'</div>'+(m.quantity===0?'<span class="badge empty-badge">Victime de son succès !</span>':m.quantity<=m.threshold?'<span class="badge">'+icon('warning')+' Bientôt fini !</span>':'')+'</article>').join('')+'</div>':'<div class="empty"><h3>Aucun plat ici pour le moment.</h3><p>'+ (query?'Essayez un autre nom de plat ou d’emplacement.':'Les plats correspondant à ce filtre apparaîtront ici.')+'</p></div>');
    document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>take(b.dataset.take));
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editMeal(b.dataset.edit));
  }
  async function refresh(silent=false){
    if(!role||refreshing||busy||modal.open)return;refreshing=true;
    try{const r=await rpc('state');state=r.state;lastSync=new Date();if(!modal.open)render();if(!silent)toast('Le stock est à jour.');}
    catch(e){if(!silent)toast(e.message);}
    finally{refreshing=false;}
  }
  async function act(action,payload,message,{keep=false,formError=null}={}){
    if(busy)return;busy=true;
    // Keep the same ID after a transport error. A retry cannot consume twice.
    const signature=JSON.stringify({action,payload});
    if(!mutationPending||mutationPending.signature!==signature)mutationPending={signature,id:id()};
    const requestId=mutationPending.id;
    const buttons=Array.from(document.querySelectorAll('dialog button, [data-take], #toastUndo'));buttons.forEach(b=>b.disabled=true);
    try{const r=await rpc(action,{payload,id:requestId});state=r.state;lastSync=new Date();mutationPending=null;if(!keep)close();render();toast(message,action==='meal.take'?r.eventId:null);return true;}
    catch(e){if(formError&&$(formError))error($(formError),e.message+' Vous pouvez réessayer.');else toast(e.message);return false;}
    finally{busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});}
  }
  function addLocation(after){
    dialog('Un nouvel emplacement','<p class="muted small">Donnez-lui le nom que toute la famille reconnaîtra. C’est vous qui choisissez !</p><form id="locationForm"><label class="field"><span>Nom de l’emplacement</span><div class="field-with-button"><input id="locationName" required maxlength="80" placeholder="Le nom de votre choix" autocomplete="off"><button type="button" class="secondary mic" id="dictateLocation" aria-label="Dicter le nom">'+icon('mic')+'</button></div></label><div id="locationError"></div><button class="primary wide" type="submit">'+icon('plus')+' Créer cet emplacement</button></form>');
    $('#dictateLocation').onclick=()=>dictate(t=>$('#locationName').value=t,$('#dictateLocation'));
    $('#locationForm').onsubmit=async e=>{e.preventDefault();const ok=await act('location.add',{name:$('#locationName').value},'Votre emplacement est créé.',{formError:'#locationError'});if(ok&&after)after();};
  }
  function settings(){
    app.innerHTML='<section class="settings-header"><p class="eyebrow">BIENVENUE CHEZ NOUS</p><h1>La maison</h1><p class="muted">Des emplacements à votre façon, pour tout retrouver facilement.</p></section><section class="panel"><h3>'+icon('pin')+' Nos emplacements</h3><p class="muted small">'+(role==='maman'?'Créez uniquement ceux que vous utilisez. Vous pourrez supprimer un emplacement lorsqu’il ne contient plus de plats.':'Les emplacements sont créés et gérés par le compte Maman.')+'</p><div id="locationsList">'+(state.locations.length?state.locations.map(l=>{const total=state.meals.filter(m=>m.locationId===l.id).reduce((s,m)=>s+m.quantity,0);return '<div class="location-row"><div class="location-label"><span class="location-icon">'+icon('pin')+'</span><div class="location-name"><strong>'+esc(l.name)+'</strong><p>'+total+' portion(s) ici</p></div></div>'+(role==='maman'?'<button class="quiet" data-delete-location="'+esc(l.id)+'" aria-label="Supprimer '+esc(l.name)+'">'+icon('trash')+'</button>':'')+'</div>';}).join(''):'<p class="muted small">Aucun emplacement pour l’instant.</p>')+'</div>'+(role==='maman'?'<button id="newLocation" class="secondary wide">'+icon('plus')+' Créer un emplacement</button>':'')+'</section><section class="panel"><h3>'+icon('refresh')+' Le stock de la famille</h3><p class="muted small">'+(live?'Le même stock pour tous, enregistré dans votre Google Sheet.':'Cet aperçu enregistre vos essais sur cet appareil. Le stock partagé Google Sheets n’est pas encore activé.')+'</p><p class="small muted">Dernière actualisation : '+(lastSync?lastSync.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—')+'</p><div class="row-actions"><button id="refresh" class="secondary">'+icon('refresh')+' Actualiser</button><button id="export" class="quiet">Exporter le stock</button></div></section><section class="panel"><h3>'+icon('mic')+' À l’écrit ou à la voix</h3><p class="muted small">Dans le formulaire, utilisez le micro d’un champ ou dictez une phrase avec le nom du plat et le nombre de portions. Vérifiez les informations avant d’enregistrer.</p><p class="muted small">La reconnaissance dépend de votre navigateur et peut utiliser son service en ligne. Si elle n’est pas proposée, utilisez le micro du clavier de votre téléphone.</p></section><button id="logout" class="quiet logout">Changer de compte</button>';
    if($('#newLocation'))$('#newLocation').onclick=()=>addLocation();
    document.querySelectorAll('[data-delete-location]').forEach(b=>b.onclick=()=>{
      const l=state.locations.find(x=>x.id===b.dataset.deleteLocation),has=state.meals.some(m=>m.locationId===l.id&&m.quantity>0);
      dialog('Supprimer cet emplacement ?', '<p><strong>'+esc(l.name)+'</strong></p>'+(has?'<p class="muted">Il contient encore des plats. Déplacez-les depuis leur fiche avant de supprimer cet emplacement.</p><button class="secondary wide" id="backStock">Voir les plats</button>':'<p class="muted">Il disparaîtra de la liste. Son nom restera dans l’historique des préparations.</p><button id="confirmDeleteLocation" class="danger wide">Supprimer l’emplacement</button>'));
      if($('#backStock'))$('#backStock').onclick=()=>{query=l.name;filter='all';page='stock';close();render();};
      if($('#confirmDeleteLocation'))$('#confirmDeleteLocation').onclick=()=>act('location.delete',{id:l.id},'L’emplacement est supprimé.');
    });
    $('#refresh').onclick=()=>refresh();$('#export').onclick=exportStock;$('#logout').onclick=()=>$('#profileButton').click();
  }
  function addMeal(){
    if(!state.locations.length){addLocation(()=>addMeal());return;}
    selectedEmoji='🍲';
    dialog('Maman a cuisiné !','<form id="mealForm"><div class="voice-panel"><button type="button" class="secondary wide" id="dictateMeal">'+icon('mic')+' Dicter ma préparation</button><p>Dites par exemple : « Six portions de lasagnes dans '+esc(state.locations[0].name)+' ». Puis vérifiez les champs.</p><div id="transcript" class="voice-transcript" aria-live="polite"></div></div><label class="field"><span>Le petit nom du plat</span><div class="field-with-button"><input id="mealName" maxlength="100" required placeholder="Qu’avez-vous cuisiné ?"><button class="secondary mic" type="button" id="dictateName" aria-label="Dicter le nom du plat">'+icon('mic')+'</button></div></label><div class="emoji-picker" aria-label="Illustration du plat">'+['🍲','🥘','🥣','🍝','🥧','🥗'].map((v,i)=>'<button class="emoji-option '+(i===0?'selected':'')+'" aria-pressed="'+(i===0)+'" type="button" data-emoji="'+v+'" aria-label="Illustration '+['cocotte','poêlée','soupe','pâtes','tarte','salade'][i]+'">'+v+'</button>').join('')+'</div><div class="form-grid"><label class="field"><span>Combien de portions ?</span><input id="mealQuantity" type="number" inputmode="numeric" required min="1" max="999" step="1" value="1"></label><label class="field"><span>Préparé le</span><input id="mealDate" type="date" required value="'+localDate()+'" max="'+localDate()+'"></label></div><label class="field"><span>Où est-il rangé ?</span><select id="mealLocation" required><option value="">Choisir un emplacement</option>'+locationsOptions()+'</select></label><label class="field"><span>Un repère pour le retrouver <span class="muted">(facultatif)</span></span><div class="field-with-button"><input id="mealDetail" maxlength="120" placeholder="Tiroir, étagère, boîte…"><button class="secondary mic" type="button" id="dictateDetail" aria-label="Dicter le repère">'+icon('mic')+'</button></div></label><label class="field"><span>M’avertir lorsqu’il reste…</span><input type="number" inputmode="numeric" id="mealThreshold" min="0" max="999" step="1" required value="2"><small>portions ou moins. À zéro, le plat apparaît dans « Terminés ».</small></label><div id="mealError"></div><button class="primary wide" type="submit">'+icon('plus')+' Mettre au stock</button></form>');
    document.querySelectorAll('[data-emoji]').forEach(b=>b.onclick=()=>{selectedEmoji=b.dataset.emoji;document.querySelectorAll('[data-emoji]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});});
    $('#dictateName').onclick=()=>dictate(t=>$('#mealName').value=t,$('#dictateName'));
    $('#dictateDetail').onclick=()=>dictate(t=>$('#mealDetail').value=t,$('#dictateDetail'));
    $('#dictateMeal').onclick=()=>dictate(t=>{
      $('#transcript').textContent='« '+t+' »';const p=MiamCore.parseVoice(t,state.locations);
      if(p.name)$('#mealName').value=p.name;if(p.quantity)$('#mealQuantity').value=p.quantity;if(p.locationId)$('#mealLocation').value=p.locationId;
      if(!p.quantity)toast('Phrase reçue. Complétez le nom et le nombre de portions, ou dictez ces champs séparément.');
    },$('#dictateMeal'));
    $('#mealForm').onsubmit=e=>{e.preventDefault();act('meal.add',{name:$('#mealName').value,quantity:Number($('#mealQuantity').value),threshold:Number($('#mealThreshold').value),locationId:$('#mealLocation').value,detail:$('#mealDetail').value,preparedAt:$('#mealDate').value,emoji:selectedEmoji},'Un bon petit plat attend la famille !',{formError:'#mealError'});};
  }
  function dictate(callback,btn){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){toast('Utilisez le micro du clavier de votre téléphone pour dicter dans le champ.');return;}
    if(recorder){try{recorder.stop();}catch{}return;}
    const old=btn.innerHTML;recorder=new SR();const rec=recorder;rec.lang='fr-FR';rec.interimResults=false;rec.maxAlternatives=1;
    btn.innerHTML=icon('mic')+' J’écoute…';btn.setAttribute('aria-busy','true');
    rec.onresult=e=>{if(modal.open)callback(e.results[0][0].transcript);};
    rec.onerror=e=>toast(({ 'not-allowed':'Le micro est refusé. Autorisez-le dans le navigateur, ou utilisez la saisie écrite.', 'no-speech':'Je n’ai rien entendu. Vous pouvez réessayer.', 'network':'La dictée ne répond pas. Utilisez le micro du clavier ou la saisie écrite.'})[e.error]||'La dictée n’est pas disponible ici. Utilisez le micro du clavier ou la saisie écrite.');
    rec.onend=()=>{btn.innerHTML=old;btn.removeAttribute('aria-busy');recorder=null;};
    try{rec.start();}catch{recorder=null;btn.innerHTML=old;btn.removeAttribute('aria-busy');toast('La dictée n’a pas démarré. Utilisez le micro du clavier ou la saisie écrite.');}
  }
  function take(mealId){
    const m=state.meals.find(x=>x.id===mealId);if(!m||!m.quantity)return;
    dialog('À table !','<form id="takeForm"><div class="take-big"><span class="dish" aria-hidden="true">'+m.emoji+'</span><h3>'+esc(m.name)+'</h3><div class="place">'+icon('pin')+'<div><strong>'+esc(m.locationName)+'</strong>'+(m.detail?'<br>'+esc(m.detail):'')+'</div></div><div class="stepper"><button type="button" id="less" aria-label="Une portion de moins">−</button><input id="takeQuantity" type="number" inputmode="numeric" aria-label="Nombre de portions à prendre" required value="1" min="1" max="'+m.quantity+'" step="1"><button type="button" id="more" aria-label="Une portion de plus">+</button></div><span class="small muted">portion(s) pour ce repas · '+m.quantity+' disponible(s)</span></div><div id="takeError"></div><button class="primary wide" type="submit">Confirmer et me régaler '+icon('heart')+'</button><p class="count-note">Vous pourrez annuler une erreur depuis l’historique.</p></form>');
    $('#less').onclick=()=>$('#takeQuantity').value=Math.max(1,Number($('#takeQuantity').value)-1);$('#more').onclick=()=>$('#takeQuantity').value=Math.min(m.quantity,Number($('#takeQuantity').value)+1);
    $('#takeForm').onsubmit=e=>{e.preventDefault();const n=Number($('#takeQuantity').value);act('meal.take',{id:m.id,quantity:n},'Bon appétit ! '+n+' portion(s) retirée(s).',{formError:'#takeError'});};
  }
  function editMeal(mealId){
    const m=state.meals.find(x=>x.id===mealId);
    dialog('Le petit coin de ce plat','<p><strong>'+esc(m.name)+'</strong></p><form id="editForm"><label class="field"><span>Emplacement</span><select id="editLocation" required>'+locationsOptions(m.locationId)+'</select></label><label class="field"><span>Repère (facultatif)</span><input id="editDetail" maxlength="120" value="'+esc(m.detail)+'"></label><label class="field"><span>Seuil d’alerte en portions</span><input id="editThreshold" type="number" min="0" max="999" step="1" inputmode="numeric" required value="'+m.threshold+'"></label><div id="editError"></div><button class="primary wide" type="submit">Enregistrer les modifications</button></form>');
    $('#editForm').onsubmit=e=>{e.preventDefault();act('meal.edit',{id:m.id,locationId:$('#editLocation').value,detail:$('#editDetail').value,threshold:Number($('#editThreshold').value)},'La fiche du plat est à jour.',{formError:'#editError'});};
  }
  function history(){
    const labels={'location.add':'Emplacement créé','location.delete':'Emplacement supprimé','meal.add':'Maman a cuisiné','meal.take':'La famille s’est servie','meal.edit':'Fiche du plat modifiée','meal.undo':'Prise annulée'};
    const events=state.events.slice().reverse(), undone=new Set(events.filter(e=>e.action==='meal.undo').map(e=>e.data.eventId));
    app.innerHTML='<p class="eyebrow">LES PETITS MOMENTS DE LA CUISINE</p><h1>Le carnet de la maison</h1><p class="muted">Les préparations, les repas et les emplacements, au fil des jours.</p><section class="panel">'+(events.length?events.map(e=>{const d=e.data,delta=e.action==='meal.take'?'−'+d.quantity:e.action==='meal.add'||e.action==='meal.undo'?'+'+d.quantity:'♡';return '<article class="history-row"><div class="delta">'+delta+'</div><div class="history-content"><p><strong>'+esc(d.name||'Préparation')+'</strong></p><p class="small">'+labels[e.action]+(undone.has(e.id)?' · annulé':'')+'</p><small>'+new Date(e.at).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(d.locationName?' · '+esc(d.locationName):'')+'</small></div>'+(role==='famille'&&e.action==='meal.take'&&!undone.has(e.id)&&Date.now()-new Date(e.at).getTime()<86400000?'<button class="quiet" data-undo="'+esc(e.id)+'">Annuler</button>':'')+'</article>';}).join(''):'<div class="empty"><h3>Le carnet est encore tout neuf.</h3><p>Vos premières préparations et vos repas apparaîtront ici.</p></div>')+'</section>';
    document.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>act('meal.undo',{eventId:b.dataset.undo},'La prise a été annulée.'));
  }
  function exportStock(){
    const protect=x=>{let v=String(x??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
    const rows=[['Plat','Portions','Emplacement','Repère','Préparé le','Seuil d’alerte'],...state.meals.map(m=>[m.name,m.quantity,m.locationName,m.detail,m.preparedAt,m.threshold])];
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(protect).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Miam-Maman-stock-'+localDate()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#modeBanner').hidden=live;
  window.addEventListener('online',()=>refresh(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
  setInterval(()=>{if(!document.hidden)refresh(true);},30000);
  render();
})();
