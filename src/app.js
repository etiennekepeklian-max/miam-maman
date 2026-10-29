(function () {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const app=$('#app'), modal=$('#modal'), body=$('#modalBody');
  const mascot=$('.brand-mascot').src;
  const directGoogle=!!(window.google && google.script && google.script.run);
  const live=directGoogle||!!window.MIAM_GOOGLE_WEBAPP_URL;
  let installPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  window.addEventListener('appinstalled',()=>{$('#installApp').hidden=true;});
  if(window.matchMedia('(display-mode: standalone)').matches)$('#installApp').hidden=true;
  $('#installApp').onclick=async()=>{
    if(installPrompt){await installPrompt.prompt();installPrompt=null;return;}
    dialog('Installer Miam Maman !','<p>Sur Android, ouvrez ce lien dans <strong>Chrome</strong>, puis le menu <strong>⋮ → Ajouter à l’écran d’accueil → Installer</strong>.</p><p>Sur iPhone, ouvrez le lien dans Safari, puis <strong>Partager → Sur l’écran d’accueil</strong>.</p><p class="muted small">L’icône apparaîtra parmi vos applications. Une connexion Internet est nécessaire pour consulter et modifier le stock partagé.</p>');
  };
  const animations=[
    {id:'hello',name:'Coucou !',description:'Un petit bond pour saluer.'},
    {id:'dance',name:'La danse du chef',description:'Deux pas de côté et un saut.'},
    {id:'hearts',name:'Cuisiné avec amour',description:'Une envolée de petits cœurs.'},
    {id:'spoon',name:'La cuillère magique',description:'Une cuillère et des étoiles.'},
    {id:'dinner',name:'À table !',description:'Une assiette et un bon appétit.'}
  ];
  let animationPrefs={opening:'hello',added:'hearts',taken:'dinner'},celebrationTimer;
  try{const saved=JSON.parse(localStorage.getItem('miam-animations-v1')||'{}');for(const key of Object.keys(animationPrefs))if(animations.some(a=>a.id===saved[key]))animationPrefs[key]=saved[key];}catch{}
  function celebrate(name,message){
    if(!animations.some(a=>a.id===name))name='hello';
    let layer=$('#celebration');if(!layer){layer=document.createElement('div');layer.id='celebration';layer.className='cocotte-celebration';layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');document.body.appendChild(layer);}
    clearTimeout(celebrationTimer);
    const symbols=name==='hearts'?['♥','♥','♡','♥']:name==='hello'?['☁','☁','☁','☁']:['✦','✧','✦','✧'];
    layer.innerHTML='<div class="celebration-card"><div class="cocotte-stage anim-'+name+'" aria-hidden="true"><img class="animated-mascot" src="'+mascot+'" alt="">'+symbols.map((symbol,i)=>'<span class="cocotte-particle particle-'+i+'">'+symbol+'</span>').join('')+(name==='spoon'?'<span class="cocotte-spoon">🥄</span>':'')+(name==='dinner'?'<span class="cocotte-plate">🍽️</span>':'')+'</div><p>'+esc(message)+'</p></div>';
    layer.hidden=false;
    celebrationTimer=setTimeout(()=>layer.hidden=true,window.matchMedia('(prefers-reduced-motion: reduce)').matches?1100:name==='dinner'?2300:1900);
  }
  const icons={pot:'<path d="M5 10h14v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-7Z"/><path d="M3 10h18M2 12h3m14 0h3M8 7h8M10 4c-1-1 1-2 0-3m4 3c-1-1 1-2 0-3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',settings:'<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',pin:'<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',heart:'<path d="M20 5c-3-3-6 0-8 2-2-2-5-5-8-2s-1 7 8 14c9-7 11-11 8-14Z"/>',warning:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'};
  const icon=(n)=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+(icons[n]||icons.pot)+'</svg>';
  const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const localDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
  const prettyDate=(s)=>new Date(s+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  let state=MiamCore.empty(), role=null, profile=null, token=null, page='stock', filter='all', query='', busy=false, lastSync=null, refreshing=false, recorder=null, toastTimer, mutationPending=null, selectedEmoji='🍲';
  let previewEvents=[];
  try { previewEvents=JSON.parse(localStorage.getItem('miam-preview-v1')||'[]'); if(!Array.isArray(previewEvents))previewEvents=[]; }catch{}
  function send(action,args={}) {
    const check=r=>{if(!r||!r.ok){const e=new Error(r?.error||'Réponse inattendue.');e.code=r?.code;throw e;}return r;};
    if(!directGoogle)return MiamBridge.send(action,{...args,token}).then(check);
    return new Promise((resolve,reject)=>{
      google.script.run.withSuccessHandler(r=>{try{resolve(check(r));}catch(e){reject(e);}}).withFailureHandler(e=>reject(new Error(e.message||'La connexion a échoué.'))).rpc(action,{...args,token});
    });
  }
  async function rpc(action,args={}) {
    if(live){
      try{return await send(action,args);}
      catch(e){
        if(e.code!=='PROFILE_SESSION_EXPIRED'||!profile||action==='login')throw e;
        const renewed=await send('login',{profile});token=renewed.token;role=renewed.role;
        return send(action,args);
      }
    }
    if(action==='login'){const p=MiamCore.profile(args.profile);return {ok:true,token:'preview',role:p.role,profile:p.id,state:MiamCore.replay(previewEvents)};}
    if(action==='logout')return {ok:true};
    if(action==='state')return {ok:true,state:MiamCore.replay(previewEvents)};
    const s=MiamCore.replay(previewEvents);
    const e=MiamCore.command(s,role,action,args.payload,args.id,new Date().toISOString(),profile);
    if(e){previewEvents.push(e);localStorage.setItem('miam-preview-v1',JSON.stringify(previewEvents));}
    return {ok:true,state:MiamCore.replay(previewEvents),eventId:e?.id||args.id};
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
    if(role)$('#profileButton').innerHTML='<span class="avatar">'+'🍲'+'</span>'+ esc(profile)+' <span aria-hidden="true">⌄</span>';
    document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
    document.querySelectorAll('[data-page]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.page===page);btn.setAttribute('aria-current',btn.dataset.page===page?'page':'false');btn.onclick=()=>{page=btn.dataset.page;render();window.scrollTo({top:0,behavior:'instant'});};});
  }
  function welcome(){
    app.innerHTML='<section class="welcome"><img class="welcome-mascot" src="'+mascot+'" alt="Notre cocotte souriante"><p class="eyebrow">LA CUISINE DE TOUTE LA FAMILLE</p><h1>Qui passe en cuisine ?</h1><p>Choisissez votre profil.<br>Les bons petits plats vous attendent.</p><div class="roles profile-choices">'+MiamCore.profiles.map(p=>'<button class="role-card" data-profile="'+p.id+'"><span aria-hidden="true">'+'🍲'+'</span><h2>'+p.label+'</h2><p>'+'Je cuisine<br>et je me sers.'+'</p><small>C’est moi →</small></button>').join('')+'</div><div id="welcomeError"></div><p class="intro-note">Un stock commun. Trois profils. Beaucoup d’amour.</p><p class="small muted">Si le stock ne s’ouvre pas : <a href="https://script.google.com/macros/s/AKfycbyb6X17lXJRCDwbKCB9_PdCgKzXmCPH599IJnIgqSNq_bTGY7gyg3OTsM5G9RCrXjVk/exec" target="_blank" rel="noopener">ouvrir le stock Google de secours</a>.</p></section>';
    document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>login(b.dataset.profile));
  }
  async function login(nextProfile){
    if(busy)return;busy=true;
    document.querySelectorAll('[data-profile]').forEach(b=>b.disabled=true);
    if($('#welcomeError'))$('#welcomeError').innerHTML='<p role="status">Connexion au stock de la famille…</p>';
    try{
      const r=await rpc('login',{profile:nextProfile});
      token=r.token;role=r.role;profile=r.profile;page='stock';filter='all';query='';mutationPending=null;state=r.state;lastSync=new Date();
      try{localStorage.setItem('miam-profile-v2',profile);}catch{}
      render();
    }catch(e){if($('#welcomeError'))error($('#welcomeError'),e.message);else toast(e.message);}
    finally{busy=false;document.querySelectorAll('[data-profile]').forEach(b=>b.disabled=false);checkSuggestions();}
  }
  $('#profileButton').onclick=()=>dialog('À chacun sa cuisine','<p class="muted">Profil actuel : <strong>'+esc(profile)+'</strong>.</p><button id="switchAccount" class="secondary wide">Changer de profil</button>');
  document.addEventListener('click',async e=>{if(e.target.closest('#switchAccount')){if(busy)return;try{await rpc('logout');}catch{}role=null;profile=null;token=null;mutationPending=null;state=MiamCore.empty();try{localStorage.removeItem('miam-profile-v2');}catch{}close();render();}});
  function render(){mountNav();if(!role)return welcome();if(page==='stock')stock();if(page==='settings')settings();if(page==='history')history();if(page==='suggestions')suggestions();if(page==='help')help();}
  const quantityText=(m,n=m.quantity)=>Number(n).toLocaleString('fr-FR')+' '+(MiamCore.unit(m)==='pieces'?(n===1?'pièce':'pièces'):MiamCore.unit(m)==='portions'?(n===1?'portion':'portions'):MiamCore.unit(m));
  let foodFilter='all';
  function stock(){
    const total=state.meals.filter(m=>MiamCore.unit(m)==='portions').reduce((s,m)=>s+m.quantity,0), low=state.meals.filter(m=>MiamCore.isLow(m)).length;
    app.innerHTML='<section class="hero"><div class="hero-copy"><p class="eyebrow">DU FAIT MAISON, AVEC AMOUR</p><h1>'+ (!!profile?'Qu’est-ce qu’on mijote ?':'Qu’est-ce qu’on mange ?')+'</h1><p>'+ (!!profile?'Un bon petit plat, une place au frais, et la famille se régale.':'Les petits plats de toute la famille vous attendent.')+'</p></div><img src="'+mascot+'" alt="" aria-hidden="true"></section><div class="summary"><div class="summary-pill">'+icon('pot')+'<strong>'+total+'</strong> portion'+(total===1?'':'s')+' en réserve</div><p class="small muted">'+state.meals.filter(m=>m.quantity>0).length+' fiche(s) en stock</p></div>'+(!!profile?'<button class="primary" id="addMeal">'+icon('plus')+' Ajouter un plat</button>':'')+'<div class="toolbar"><label class="search">'+icon('search')+'<input id="search" type="search" aria-label="Rechercher un plat ou un emplacement" placeholder="Un plat, un emplacement…" value="'+esc(query)+'"></label><div class="filters"><button class="chip '+(filter==='all'?'selected':'')+'" data-filter="all">Tous les plats</button><button class="chip '+(filter==='low'?'selected':'')+'" data-filter="low">Bientôt fini'+(low?' · '+low:'')+'</button><button class="chip '+(filter==='empty'?'selected':'')+'" data-filter="empty">Terminés</button></div></div><div id="mealResults"></div><div class="tip">'+icon('heart')+'<span>'+ (!!profile?'Chaque préparation garde sa date et son emplacement. Les plus anciennes apparaissent en premier.':'Une portion prise ? Pensez à la déclarer pour que toute la famille retrouve le bon stock.')+'</span></div>';
    if($('#addMeal'))$('#addMeal').onclick=()=>addMeal();
    $('#addMeal').insertAdjacentHTML('afterend','<button id="beginnerHelp" class="secondary wide beginner-help">Première visite ? Comment faire ?</button>');
    $('#addMeal').insertAdjacentHTML('afterend','<button id="addVegetables" class="primary vegetable-add">🥕 Ajouter des légumes</button><label class="field food-filter"><span>Afficher dans le stock</span><select id="foodFilter"><option value="all">Plats et légumes</option><option value="dish">Plats préparés</option><option value="vegetable">Légumes non cuisinés</option></select></label>');
    $('#addVegetables').onclick=()=>addMeal('vegetable');$('#foodFilter').value=foodFilter;$('#foodFilter').onchange=e=>{foodFilter=e.target.value;results();};
    $('#beginnerHelp').onclick=()=>{page='help';render();window.scrollTo({top:0,behavior:'instant'});};
    $('#search').oninput=e=>{query=e.target.value;results();};
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;stock();});results();
  }
  function results(){
    const meals=state.meals.filter(m=>(foodFilter==='all'||(m.kind||'dish')===foodFilter)&&(filter==='empty'?m.quantity===0:filter==='low'?MiamCore.isLow(m):m.quantity>0)&&MiamCore.norm(m.name+' '+m.locationName+' '+m.detail).includes(MiamCore.norm(query))).sort((a,b)=>a.preparedAt.localeCompare(b.preparedAt));
    const box=$('#mealResults');
    if(!state.meals.length){box.innerHTML='<div class="empty"><img src="'+mascot+'" alt=""><h2>La cocotte attend ses petits plats.</h2><p>'+ (!!profile?(state.locations.length?'Enregistrez votre première préparation. La famille n’aura plus qu’à se régaler.':'Commencez par créer vos propres emplacements, puis ajoutez votre première préparation.'):'Aucune préparation n’a encore été enregistrée.')+'</p>'+(!!profile?'<button id="firstAction" class="secondary">'+icon('plus')+' '+(state.locations.length?'Ajouter un plat':'Créer un emplacement')+'</button>':'')+'</div>';if($('#firstAction'))$('#firstAction').onclick=()=>state.locations.length?addMeal():addLocation(()=>{page='stock';render();});return;}
    box.innerHTML='<div class="section-heading"><h2>'+ (filter==='empty'?'Victimes de leur succès':filter==='low'?'On arrive au bout !':'Les provisions disponibles')+'</h2><span>'+meals.length+' fiche(s)</span></div>'+(meals.length?'<div class="meals">'+meals.map(m=>'<article class="meal">'+(!!profile?'<button class="more icon-button" data-edit="'+esc(m.id)+'" aria-label="Modifier '+esc(m.name)+'">⋯</button>':'')+'<div class="meal-top"><div class="meal-emoji" aria-hidden="true">'+m.emoji+'</div><div class="meal-title"><h3>'+esc(m.name)+'</h3><span class="prepared">'+(m.kind==='vegetable'?'Légumes non cuisinés · Rangés le ':'Préparé le ')+prettyDate(m.preparedAt)+'</span></div></div><div class="place">'+icon('pin')+'<div><strong>'+esc(m.locationName)+'</strong>'+(m.detail?'<br>'+esc(m.detail):'')+'</div></div><div class="meal-bottom"><div class="quantity"><strong>'+Number(m.quantity).toLocaleString('fr-FR')+'</strong><span>'+quantityText(m,1).replace(/^1 /,'')+(MiamCore.unit(m)==='pieces'&&m.quantity!==1?'s':MiamCore.unit(m)==='portions'&&m.quantity!==1?'s':'')+'</span></div>'+(m.quantity>0&&!!profile?'<button class="secondary" data-take="'+esc(m.id)+'">'+icon('minus')+' Je me sers</button>':'')+'</div><p class="threshold-note">Alerte à '+quantityText(m,m.threshold)+' ou moins</p>'+(m.quantity===0?'<span class="badge empty-badge">Victime de son succès !</span>':m.quantity<=m.threshold?'<span class="badge">'+icon('warning')+' Bientôt fini !</span>':'')+'</article>').join('')+'</div>':'<div class="empty"><h3>Aucun plat ici pour le moment.</h3><p>'+ (query?'Essayez un autre nom de plat ou d’emplacement.':'Les plats correspondant à ce filtre apparaîtront ici.')+'</p></div>');
    document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>take(b.dataset.take));
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editMeal(b.dataset.edit));
  }
  async function refresh(silent=false){
    if(!role||refreshing||busy||modal.open)return;refreshing=true;
    try{const r=await rpc('state');state=r.state;lastSync=new Date();if(!modal.open&&!['help','suggestions'].includes(page))render();if(!silent)toast('Le stock est à jour.');}
    catch(e){if(!silent)toast(e.message);}
    finally{refreshing=false;checkSuggestions();}
  }
  async function act(action,payload,message,{keep=false,formError=null}={}){
    if(busy)return;busy=true;
    // Keep the same ID after a transport error. A retry cannot consume twice.
    const signature=JSON.stringify({action,payload});
    if(!mutationPending||mutationPending.signature!==signature)mutationPending={signature,id:id()};
    const requestId=mutationPending.id;
    const buttons=Array.from(document.querySelectorAll('dialog button, [data-take], #toastUndo'));buttons.forEach(b=>b.disabled=true);
    try{const r=await rpc(action,{payload,id:requestId});state=r.state;lastSync=new Date();mutationPending=null;if(!keep)close();render();toast(message,action==='meal.take'?r.eventId:null);if(action==='meal.add')celebrate(animationPrefs.added,payload.kind==='vegetable'?'Les légumes sont bien rangés !':'Un bon petit plat en réserve !');if(action==='meal.take'){const raw=state.meals.find(m=>m.id===payload.id)?.kind==='vegetable';celebrate(raw?'hello':animationPrefs.taken,raw?'Bonne cuisine, '+profile+' !':'Bon appétit, '+profile+' !');}return true;}
    catch(e){if(formError&&$(formError))error($(formError),e.message+' Vous pouvez réessayer.');else toast(e.message);return false;}
    finally{busy=false;buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});checkSuggestions();}
  }
  function addLocation(after){
    dialog('Un nouvel emplacement','<p class="muted small">Donnez-lui le nom que toute la famille reconnaîtra. C’est vous qui choisissez !</p><form id="locationForm"><label class="field"><span>Nom de l’emplacement</span><div class="field-with-button"><input id="locationName" required maxlength="80" placeholder="Le nom de votre choix" autocomplete="off"><button type="button" class="secondary mic" id="dictateLocation" aria-label="Dicter le nom">'+icon('mic')+'</button></div></label><div id="locationError"></div><button class="primary wide" type="submit">'+icon('plus')+' Créer cet emplacement</button></form>');
    $('#dictateLocation').onclick=()=>dictate(t=>$('#locationName').value=t,$('#dictateLocation'));
    $('#locationForm').onsubmit=async e=>{e.preventDefault();const ok=await act('location.add',{name:$('#locationName').value},'Votre emplacement est créé.',{formError:'#locationError'});if(ok&&after)after();};
  }
  function settings(){
    app.innerHTML='<section class="settings-header"><p class="eyebrow">BIENVENUE CHEZ NOUS</p><h1>La maison</h1><p class="muted">Des emplacements à votre façon, pour tout retrouver facilement.</p></section><section class="panel"><h3>'+icon('pin')+' Nos emplacements</h3><p class="muted small">'+(!!profile?'Créez uniquement ceux que vous utilisez. Vous pourrez supprimer un emplacement lorsqu’il ne contient plus de plats.':'Chacun peut créer et gérer les emplacements.')+'</p><div id="locationsList">'+(state.locations.length?state.locations.map(l=>{const total=state.meals.filter(m=>m.locationId===l.id&&m.quantity>0).length;return '<div class="location-row"><div class="location-label"><span class="location-icon">'+icon('pin')+'</span><div class="location-name"><strong>'+esc(l.name)+'</strong><p>'+total+' fiche(s) en stock ici</p></div></div>'+(!!profile?'<button class="quiet" data-delete-location="'+esc(l.id)+'" aria-label="Supprimer '+esc(l.name)+'">'+icon('trash')+'</button>':'')+'</div>';}).join(''):'<p class="muted small">Aucun emplacement pour l’instant.</p>')+'</div>'+(!!profile?'<button id="newLocation" class="secondary wide">'+icon('plus')+' Créer un emplacement</button>':'')+'</section><section class="panel"><h3>'+icon('refresh')+' Le stock de la famille</h3><p class="muted small">'+(live?'Le même stock pour tous, enregistré dans votre Google Sheet.':'Cet aperçu enregistre vos essais sur cet appareil. Le stock partagé Google Sheets n’est pas encore activé.')+'</p><p class="small muted">Dernière actualisation : '+(lastSync?lastSync.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—')+'</p><div class="row-actions"><button id="refresh" class="secondary">'+icon('refresh')+' Actualiser</button><button id="export" class="quiet">Exporter le stock</button></div></section><section class="panel"><h3>'+icon('mic')+' À l’écrit ou à la voix</h3><p class="muted small">Dans le formulaire, utilisez le micro d’un champ ou dictez une phrase avec le nom du plat et le nombre de portions. Vérifiez les informations avant d’enregistrer.</p><p class="muted small">La reconnaissance dépend de votre navigateur et peut utiliser son service en ligne. Si elle n’est pas proposée, utilisez le micro du clavier de votre téléphone.</p></section><button id="logout" class="quiet logout">Changer de profil</button>';
    $('#logout').insertAdjacentHTML('beforebegin','<section class="panel"><h3>'+icon('heart')+' Les idées de la maison</h3><p class="muted small">Une amélioration à proposer ? Chacun peut écrire une idée. EK reçoit les nouvelles suggestions dans une fenêtre à l’ouverture de l’application ou pendant son utilisation.</p><button id="openSuggestions" class="secondary wide">Voir et proposer des idées</button></section><section class="panel"><h3>La cocotte fait son spectacle</h3><p class="muted small">Cinq petites animations à essayer. Choisissez celles de cet appareil pour l’ouverture, les plats ajoutés et les portions prises.</p><div class="animation-gallery">'+animations.map(a=>'<button class="animation-choice" data-animation="'+a.id+'"><strong>'+a.name+'</strong><small>'+a.description+'</small><span>Voir l’animation →</span></button>').join('')+'</div>'+[['opening','À l’ouverture'],['added','Après un ajout'],['taken','Pour souhaiter bon appétit']].map(([key,label])=>'<label class="field"><span>'+label+'</span><select data-animation-setting="'+key+'">'+animations.map(a=>'<option value="'+a.id+'" '+(animationPrefs[key]===a.id?'selected':'')+'>'+a.name+'</option>').join('')+'</select></label>').join('')+'</section>');
    $('#openSuggestions').onclick=()=>{page='suggestions';render();};
    document.querySelectorAll('[data-animation]').forEach(btn=>btn.onclick=()=>celebrate(btn.dataset.animation,btn.dataset.animation==='dinner'?'Bon appétit !':animations.find(a=>a.id===btn.dataset.animation).name));
    document.querySelectorAll('[data-animation-setting]').forEach(select=>select.onchange=()=>{animationPrefs[select.dataset.animationSetting]=select.value;try{localStorage.setItem('miam-animations-v1',JSON.stringify(animationPrefs));}catch{}celebrate(select.value,select.dataset.animationSetting==='taken'?'Bon appétit !':'C’est noté !');});
    if($('#newLocation'))$('#newLocation').onclick=()=>addLocation();
    document.querySelectorAll('[data-delete-location]').forEach(b=>b.onclick=()=>{
      const l=state.locations.find(x=>x.id===b.dataset.deleteLocation),has=state.meals.some(m=>m.locationId===l.id&&m.quantity>0);
      dialog('Supprimer cet emplacement ?', '<p><strong>'+esc(l.name)+'</strong></p>'+(has?'<p class="muted">Il contient encore des plats. Déplacez-les depuis leur fiche avant de supprimer cet emplacement.</p><button class="secondary wide" id="backStock">Voir les plats</button>':'<p class="muted">Il disparaîtra de la liste. Son nom restera dans l’historique des préparations.</p><button id="confirmDeleteLocation" class="danger wide">Supprimer l’emplacement</button>'));
      if($('#backStock'))$('#backStock').onclick=()=>{query=l.name;filter='all';page='stock';close();render();};
      if($('#confirmDeleteLocation'))$('#confirmDeleteLocation').onclick=()=>act('location.delete',{id:l.id},'L’emplacement est supprimé.');
    });
    $('#refresh').onclick=()=>refresh();$('#export').onclick=exportStock;$('#logout').onclick=()=>$('#profileButton').click();
  }
  function addMeal(kind='dish'){
    if(!state.locations.length){addLocation(()=>addMeal(kind));return;}
    selectedEmoji='🍲';
    dialog('Un bon petit plat !','<form id="mealForm"><div class="voice-panel"><button type="button" class="secondary wide" id="dictateMeal">'+icon('mic')+' Dicter ma préparation</button><p>Dites par exemple : « Six portions de lasagnes dans '+esc(state.locations[0].name)+' ». Vous pouvez ajouter : « alerte à deux portions ». Puis vérifiez les champs.</p><div id="transcript" class="voice-transcript" aria-live="polite"></div></div><label class="field"><span>Le petit nom du plat</span><div class="field-with-button"><input id="mealName" maxlength="100" required placeholder="Qu’avez-vous cuisiné ?"><button class="secondary mic" type="button" id="dictateName" aria-label="Dicter le nom du plat">'+icon('mic')+'</button></div></label><div class="emoji-picker" aria-label="Illustration du plat">'+['🍲','🥘','🥣','🍝','🥧','🥗'].map((v,i)=>'<button class="emoji-option '+(i===0?'selected':'')+'" aria-pressed="'+(i===0)+'" type="button" data-emoji="'+v+'" aria-label="Illustration '+['cocotte','poêlée','soupe','pâtes','tarte','salade'][i]+'">'+v+'</button>').join('')+'</div><div class="form-grid"><label class="field"><span>Combien de portions ?</span><input id="mealQuantity" type="number" inputmode="numeric" required min="1" max="999" step="1" value="1"></label><label class="field"><span>Préparé le</span><input id="mealDate" type="date" required value="'+localDate()+'" max="'+localDate()+'"></label></div><label class="field"><span>Où est-il rangé ?</span><select id="mealLocation" required><option value="">Choisir un emplacement</option>'+locationsOptions()+'</select></label><label class="field"><span>Un repère pour le retrouver <span class="muted">(facultatif)</span></span><div class="field-with-button"><input id="mealDetail" maxlength="120" placeholder="Tiroir, étagère, boîte…"><button class="secondary mic" type="button" id="dictateDetail" aria-label="Dicter le repère">'+icon('mic')+'</button></div></label><label class="field"><span>Stock d’alerte (portions)</span><input type="number" inputmode="numeric" id="mealThreshold" min="0" max="999" step="1" required value="2"><small>Le plat sera signalé lorsque son stock atteint ce nombre de portions ou passe en dessous. Vous pourrez modifier ce seuil sur sa fiche.</small></label><div id="mealError"></div><button class="primary wide" type="submit">'+icon('plus')+' Mettre au stock</button></form>');
    if(kind==='vegetable'){
      $('#modalTitle').textContent='Ajouter des légumes non cuisinés';selectedEmoji='🥕';$('#dictateMeal').innerHTML=icon('mic')+' Dicter mes légumes';$('#dictateName').setAttribute('aria-label','Dicter le nom du légume');$('.emoji-picker').setAttribute('aria-label','Illustration des légumes');
      $('#mealName').closest('label').querySelector('span').textContent='Nom du légume';$('#mealName').placeholder='Carottes, courgettes, pommes de terre…';
      $('#mealDate').closest('label').querySelector('span').textContent='Rangés le';
      $('.emoji-picker').innerHTML=['🥕','🥦','🥔','🍅','🥒','🧅'].map(v=>'<button type="button" class="emoji-option '+(v==='🥕'?'selected':'')+'" data-emoji="'+v+'" aria-pressed="'+(v==='🥕')+'" aria-label="Illustration '+v+'">'+v+'</button>').join('');
      $('#mealQuantity').closest('label').insertAdjacentHTML('beforebegin','<label class="field"><span>Comment les compter ?</span><select id="mealUnit"><option value="pieces">En pièces (ex. 6 carottes)</option><option value="g">En grammes (ex. 500 g)</option><option value="kg">En kilos (ex. 1,5 kg)</option></select></label>');
      $('.voice-panel p').textContent='Dites par exemple : « Deux kilos de carottes dans votre emplacement ». Puis vérifiez chaque champ. Vous pouvez aussi dicter le nom seul avec son micro.';
      $('#mealUnit').onchange=()=>{const u=$('#mealUnit').value;$('#mealQuantity').closest('label').querySelector('span').textContent=u==='pieces'?'Combien de pièces ?':'Quelle quantité en '+u+' ?';$('#mealThreshold').closest('label').querySelector('span').textContent='Stock d’alerte ('+(u==='pieces'?'pièces':u)+')';for(const sel of ['#mealQuantity','#mealThreshold']){$(sel).step=u==='kg'?'0.001':'1';$(sel).max=u==='g'?'999999':'999';$(sel).inputMode=u==='kg'?'decimal':'numeric';}$('#mealQuantity').min=u==='kg'?'0.001':'1';$('#mealQuantity').value='1';$('#mealThreshold').value='0';};$('#mealUnit').onchange();
      $('#mealThreshold').closest('label').querySelector('small').textContent='Choisissez la quantité restante qui déclenche Bientôt fini, dans la même unité. Par exemple 2 pièces ou 0,5 kg. Zéro : signaler uniquement quand il n’en reste plus.';
    }
    $('.emoji-picker').insertAdjacentHTML('beforebegin','<p class="small"><strong>Choisir une illustration</strong> · '+MiamCore.illustrations[kind].length+' choix</p>');
    $('.emoji-picker').innerHTML=MiamCore.illustrations[kind].map(x=>'<button type="button" class="emoji-option '+(x.emoji===selectedEmoji?'selected':'')+'" data-emoji="'+x.emoji+'" aria-pressed="'+(x.emoji===selectedEmoji)+'" aria-label="'+esc(x.label)+'" title="'+esc(x.label)+'">'+x.emoji+'</button>').join('');
    $('.voice-panel').insertAdjacentHTML('beforeend','<p class="small">Si le micro ne répond pas, touchez le champ ci-dessous, puis le micro du clavier de votre téléphone. Vous pouvez aussi écrire ou coller la phrase.</p><label class="field"><span>Votre phrase dictée ou écrite</span><textarea id="voiceText" rows="3" maxlength="500" placeholder="Ex. : six portions de soupe dans mon emplacement"></textarea></label><button type="button" class="secondary wide" id="applyVoiceText">Remplir les champs avec cette phrase</button><p class="small">Les informations ne sont enregistrées qu’après votre vérification et le bouton Mettre au stock.</p>');
    document.querySelectorAll('[data-emoji]').forEach(b=>b.onclick=()=>{selectedEmoji=b.dataset.emoji;document.querySelectorAll('[data-emoji]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});});
    $('#dictateName').onclick=()=>dictate(t=>$('#mealName').value=t,$('#dictateName'));
    $('#dictateDetail').onclick=()=>dictate(t=>$('#mealDetail').value=t,$('#dictateDetail'));
    const applyPhrase=t=>{
      $('#voiceText').value=t;$('#transcript').textContent='Phrase reçue : « '+t+' »';const p=MiamCore.parseVoice(t,state.locations);
      if(kind==='vegetable'&&p.unit&&['pieces','g','kg'].includes(p.unit)){$('#mealUnit').value=p.unit;$('#mealUnit').onchange();}
      if(p.name)$('#mealName').value=p.name;if(p.quantity)$('#mealQuantity').value=p.quantity;if(p.locationId)$('#mealLocation').value=p.locationId;if(Number.isFinite(p.threshold))$('#mealThreshold').value=p.threshold;
      voiceStatus(p.name?'Les champs ont été remplis. Vérifiez le nom, la quantité et l’emplacement avant d’enregistrer.':'Phrase reçue. Complétez les champs ci-dessous.');
      if(!p.quantity)voiceStatus('Le nom a été repris. Indiquez aussi la quantité dans le champ prévu.');
    };
    $('#dictateMeal').onclick=()=>dictate(applyPhrase,$('#dictateMeal'));
    $('#applyVoiceText').onclick=()=>{const t=$('#voiceText').value.trim();if(t)applyPhrase(t);else voiceStatus('Touchez le champ Votre phrase dictée ou écrite, puis utilisez le micro du clavier ou écrivez votre phrase.');};
    $('#mealForm').onsubmit=e=>{e.preventDefault();act('meal.add',{kind,unit:kind==='vegetable'?$('#mealUnit').value:'portions',name:$('#mealName').value,quantity:Number($('#mealQuantity').value),threshold:Number($('#mealThreshold').value),locationId:$('#mealLocation').value,detail:$('#mealDetail').value,preparedAt:$('#mealDate').value,emoji:selectedEmoji},kind==='vegetable'?'Les légumes sont enregistrés !':'Un bon petit plat attend la famille !',{formError:'#mealError'});};
  }
  function voiceStatus(message){
    if(modal.open){let status=$('#voiceStatus');if(!status){status=document.createElement('p');status.id='voiceStatus';status.className='voice-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.prepend(status);}status.textContent=message;}else toast(message);
  }
  function dictate(callback,btn){
    if(recorder){try{recorder.stop();}catch{}return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const keyboardHelp='Touchez un champ puis le micro du clavier de votre téléphone pour dicter, ou écrivez votre phrase dans le champ prévu et touchez Remplir les champs.';
    const policy=document.permissionsPolicy||document.featurePolicy;
    if(!SR){voiceStatus('Le micro intégré n’est pas proposé par ce navigateur. '+keyboardHelp);return;}
    if(policy&&typeof policy.allowsFeature==='function'&&!policy.allowsFeature('microphone')){voiceStatus('Cette page Google bloque le micro intégré. Ouvrez l’application à l’adresse etiennekepeklian-max.github.io/miam-maman/ pour utiliser le bouton Dicter, ou utilisez le micro du clavier. '+keyboardHelp);return;}
    const old=btn.innerHTML;let rec,heard='',applied=false,failed=false,timer;
    const finish=()=>{clearTimeout(timer);btn.innerHTML=old;btn.removeAttribute('aria-busy');if(recorder===rec)recorder=null;};
    const apply=()=>{if(heard&&!applied&&modal.open){applied=true;callback(heard);}};
    try{rec=new SR();recorder=rec;rec.lang='fr-FR';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=3;
      btn.innerHTML=icon('mic')+' Arrêter l’écoute';btn.setAttribute('aria-busy','true');
      voiceStatus('Ouverture du micro… Si le navigateur le demande, autorisez le microphone.');
      rec.onstart=()=>{voiceStatus('J’écoute. Parlez distinctement en français. La phrase s’affichera pendant que vous parlez.');};
      rec.onresult=e=>{heard=Array.from(e.results).map(r=>r[0].transcript).join(' ').trim();if(!modal.open)return;if($('#transcript'))$('#transcript').textContent='J’ai entendu : « '+heard+' »';if($('#voiceText')&&btn.id==='dictateMeal')$('#voiceText').value=heard;if(Array.from(e.results).every(r=>r.isFinal)){apply();try{rec.stop();}catch{}}};
      rec.onerror=e=>{failed=true;voiceStatus((({'not-allowed':'L’accès au micro a été refusé. Autorisez-le dans les réglages du site si vous le souhaitez.','service-not-allowed':'Le service de reconnaissance est bloqué ici.','audio-capture':'Aucun microphone utilisable n’a été trouvé.','no-speech':'Aucune parole n’a été entendue. Réessayez après avoir rapproché le téléphone.','network':'La reconnaissance en ligne n’a pas répondu. Vérifiez la connexion Internet.','language-not-supported':'Le service ne propose pas la reconnaissance en français.','aborted':'L’écoute a été arrêtée.'})[e.error]||'La reconnaissance vocale n’a pas abouti.')+' '+keyboardHelp);finish();};
      rec.onend=()=>{if(!failed){apply();if(!heard)voiceStatus('L’écoute est terminée sans texte reconnu. '+keyboardHelp);}finish();};
      timer=setTimeout(()=>{if(!heard)voiceStatus('Aucun texte reçu après 15 secondes. '+keyboardHelp);try{rec.stop();}catch{}finish();},15000);
      rec.start();
    }catch{finish();voiceStatus('Le micro intégré n’a pas pu démarrer. '+keyboardHelp);}
  }
  function take(mealId){
    const m=state.meals.find(x=>x.id===mealId);if(!m||!m.quantity)return;
    dialog('À table !','<form id="takeForm"><div class="take-big"><span class="dish" aria-hidden="true">'+m.emoji+'</span><h3>'+esc(m.name)+'</h3><div class="place">'+icon('pin')+'<div><strong>'+esc(m.locationName)+'</strong>'+(m.detail?'<br>'+esc(m.detail):'')+'</div></div><div class="stepper"><button type="button" id="less" aria-label="Une portion de moins">−</button><input id="takeQuantity" type="number" inputmode="numeric" aria-label="Nombre de portions à prendre" required value="1" min="1" max="'+m.quantity+'" step="1"><button type="button" id="more" aria-label="Une portion de plus">+</button></div><span class="small muted">portion(s) pour ce repas · '+m.quantity+' disponible(s)</span></div><div id="takeError"></div><button class="primary wide" type="submit">Confirmer et me régaler '+icon('heart')+'</button><p class="count-note">Vous pourrez annuler une erreur depuis l’historique.</p></form>');
    const u=MiamCore.unit(m),step=u==='kg'?0.1:1,min=u==='kg'?0.001:1;
    $('#takeQuantity').step=u==='kg'?'0.001':'1';$('#takeQuantity').min=String(min);$('#takeQuantity').value=String(Math.min(m.quantity,u==='kg'?0.1:1));$('#takeQuantity').inputMode=u==='kg'?'decimal':'numeric';
    if(m.kind==='vegetable'){$('#modalTitle').textContent='Prendre des légumes';$('#takeForm .small').textContent='Quantité à retirer en '+(u==='pieces'?'pièces':u)+' · disponible : '+quantityText(m);$('#takeForm button[type=submit]').textContent='Confirmer la quantité prise';$('#less').setAttribute('aria-label','Diminuer la quantité');$('#more').setAttribute('aria-label','Augmenter la quantité');$('#takeQuantity').setAttribute('aria-label','Quantité de légumes à prendre en '+u);}
    $('#less').onclick=()=>$('#takeQuantity').value=Math.max(min,Math.round((Number($('#takeQuantity').value)-step)*1000)/1000);$('#more').onclick=()=>$('#takeQuantity').value=Math.min(m.quantity,Math.round((Number($('#takeQuantity').value)+step)*1000)/1000);
    $('#takeForm').onsubmit=e=>{e.preventDefault();const n=Number($('#takeQuantity').value);act('meal.take',{id:m.id,quantity:n},(m.kind==='vegetable'?'Bonne cuisine ! ':'Bon appétit ! ')+quantityText(m,n)+' retiré(es).',{formError:'#takeError'});};
  }
  function editMeal(mealId){
    const m=state.meals.find(x=>x.id===mealId);
    dialog('Le petit coin de ce plat','<p><strong>'+esc(m.name)+'</strong></p><form id="editForm"><label class="field"><span>Emplacement</span><select id="editLocation" required>'+locationsOptions(m.locationId)+'</select></label><label class="field"><span>Repère (facultatif)</span><input id="editDetail" maxlength="120" value="'+esc(m.detail)+'"></label><label class="field"><span>Stock d’alerte (portions)</span><input id="editThreshold" type="number" min="0" max="999" step="1" inputmode="numeric" required value="'+m.threshold+'"></label><div id="editError"></div><button class="primary wide" type="submit">Enregistrer les modifications</button></form>');
    $('#editThreshold').closest('label').querySelector('span').textContent='Stock d’alerte ('+(MiamCore.unit(m)==='pieces'?'pièces':MiamCore.unit(m))+')';$('#editThreshold').step=MiamCore.unit(m)==='kg'?'0.001':'1';$('#editThreshold').max=MiamCore.unit(m)==='g'?'999999':'999';$('#editThreshold').inputMode=MiamCore.unit(m)==='kg'?'decimal':'numeric';
    $('#editForm').onsubmit=e=>{e.preventDefault();act('meal.edit',{id:m.id,locationId:$('#editLocation').value,detail:$('#editDetail').value,threshold:Number($('#editThreshold').value)},'La fiche du plat est à jour.',{formError:'#editError'});};
  }
  function history(){
    const labels={'location.add':'Emplacement créé','location.delete':'Emplacement supprimé','meal.add':'Ajout au stock','meal.take':'Quantité prise','meal.edit':'Fiche du plat modifiée','meal.undo':'Prise annulée'};
    const events=state.events.filter(e=>Object.prototype.hasOwnProperty.call(labels,e.action)).slice().reverse(), undone=new Set(events.filter(e=>e.action==='meal.undo').map(e=>e.data.eventId));
    app.innerHTML='<p class="eyebrow">LES PETITS MOMENTS DE LA CUISINE</p><h1>Le carnet de la maison</h1><p class="muted">Les préparations, les repas et les emplacements, au fil des jours.</p><section class="panel">'+(events.length?events.map(e=>{const d=e.data,delta=e.action==='meal.take'?'−'+d.quantity:e.action==='meal.add'||e.action==='meal.undo'?'+'+d.quantity:'♡';return '<article class="history-row"><div class="delta">'+delta+(d.quantity?' '+(d.unit||'portions'):'')+'</div><div class="history-content"><p><strong>'+esc(d.name||'Préparation')+'</strong></p><p class="small">'+labels[e.action]+(undone.has(e.id)?' · annulé':'')+'</p><small>'+new Date(e.at).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(e.profile?' · '+esc(e.profile):'')+(d.locationName?' · '+esc(d.locationName):'')+'</small></div>'+(!!profile&&e.action==='meal.take'&&!undone.has(e.id)&&Date.now()-new Date(e.at).getTime()<86400000?'<button class="quiet" data-undo="'+esc(e.id)+'">Annuler</button>':'')+'</article>';}).join(''):'<div class="empty"><h3>Le carnet est encore tout neuf.</h3><p>Vos premières préparations et vos repas apparaîtront ici.</p></div>')+'</section>';
    document.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>act('meal.undo',{eventId:b.dataset.undo},'La prise a été annulée.'));
  }
  const noticedSuggestions=new Set();
  function suggestionCard(item){return '<article class="suggestion-card"><p><strong>'+esc(item.title)+'</strong></p><p class="suggestion-text">'+esc(item.text)+'</p><small>'+esc(item.author||'La famille')+' · '+new Date(item.at).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</small></article>';}
  function suggestions(){
    const items=(state.suggestions||[]).slice().reverse();
    app.innerHTML='<p class="eyebrow">POUR UNE APPLI ENCORE PLUS CHOUETTE</p><h1>Les idées de la maison</h1><p class="muted">Une idée, un petit souci ou une envie ? On vous écoute.</p><section class="panel"><form id="suggestionForm"><label class="field"><span>Votre idée en quelques mots</span><input id="suggestionTitle" maxlength="80" required placeholder="Un titre pour votre suggestion"></label><label class="field"><span>Racontez-nous</span><textarea id="suggestionText" required maxlength="1000" rows="4" placeholder="Qu’aimeriez-vous améliorer ?"></textarea></label><p class="small muted">Votre idée sera enregistrée avec le profil '+esc(profile)+'. EK sera averti dans l’application.</p><div id="suggestionError"></div><button class="primary wide" type="submit">'+icon('heart')+' Envoyer ma suggestion</button></form></section><section class="panel"><h2>Vos suggestions</h2>'+(items.length?items.map(suggestionCard).join(''):'<p class="muted">Le carnet d’idées est encore tout neuf.</p>')+'</section>';
    $('#suggestionForm').onsubmit=e=>{e.preventDefault();act('suggestion.add',{title:$('#suggestionTitle').value,text:$('#suggestionText').value},'Merci, votre idée est enregistrée !',{formError:'#suggestionError'});};
  }
  function checkSuggestions(){
    if(profile!=='EK'||busy||modal.open)return;
    const unread=MiamCore.unreadSuggestions(state,profile).filter(item=>!noticedSuggestions.has(item.id)).slice(0,100);
    if(!unread.length)return;
    unread.forEach(item=>noticedSuggestions.add(item.id));
    dialog(unread.length===1?'Une nouvelle idée pour l’appli !':'De nouvelles idées pour l’appli !',unread.map(suggestionCard).join('')+'<button class="primary wide" id="dismissSuggestions">J’ai lu, merci !</button>');
    $('#dismissSuggestions').onclick=close;
    rpc('suggestion.seen',{id:id(),payload:{ids:unread.map(item=>item.id)}}).then(r=>{state=r.state;lastSync=new Date();}).catch(()=>toast('La lecture sera confirmée à la prochaine ouverture.'));
  }
  function help(){
    const guides=[
      {id:'add',title:'Ajouter un plat',poster:'__HELP_ADD_PNG__',gif:'__HELP_ADD_GIF__',steps:['En bas de l’écran, touchez « Mes plats ». Touchez ensuite le grand bouton « Ajouter un plat ». Si l’application demande un emplacement, écrivez le nom du lieu où vous rangez vos plats, puis touchez « Créer cet emplacement ».','Touchez « Le petit nom du plat » et écrivez ce que vous avez cuisiné. Dans « Combien de portions ? », indiquez pour combien de personnes il y en a : par exemple 6. Vérifiez la date « Préparé le ». Pour parler au lieu d’écrire, touchez « Dicter ma préparation », puis vérifiez les informations remplies.','Touchez « Où est-il rangé ? » et choisissez votre emplacement dans la liste. Le repère est facultatif : vous pouvez préciser un tiroir ou une boîte. Dans « Stock d’alerte », écrivez le nombre de portions à partir duquel vous voulez voir « Bientôt fini » : par exemple 2.','Touchez « Mettre au stock ». Attendez la confirmation : le plat et ses portions apparaissent dans Mes plats.']},
      {id:'take',title:'Prendre des portions',poster:'__HELP_TAKE_PNG__',gif:'__HELP_TAKE_GIF__',steps:['En bas de l’écran, touchez « Mes plats ». Trouvez le plat que vous voulez manger. Vous pouvez faire glisser l’écran pour voir la suite ou écrire son nom dans la recherche. L’emplacement écrit sur sa fiche vous dit où le chercher. Sur cette fiche, touchez « Je me sers ».','Une petite fenêtre « À table ! » s’ouvre. Le nombre au milieu indique les portions que vous allez prendre. Au départ, il vaut 1. Touchez + pour en prendre davantage, ou − pour en prendre moins. Par exemple, pour un repas à deux, choisissez 2.','Touchez « Confirmer et me régaler » et attendez la confirmation avant de recommencer.','La cocotte vous souhaite bon appétit et le stock diminue. Une erreur ? Dans Historique, touchez « Annuler » sur la prise concernée, pendant 24 heures.']}
    ];
    app.innerHTML='<p class="eyebrow">UN PETIT COUP DE MAIN</p><h1>À l’aide, la cocotte !</h1><p class="muted">MLK, GK et EK peuvent tous cuisiner et se servir. Pour commencer, choisissez vos initiales. Un bouton se touche une fois avec le doigt. Pour descendre dans la page, faites glisser votre doigt du bas vers le haut.</p><p class="help-intro">Choisissez ci-dessous ce que vous voulez faire. Lisez les étapes dans l’ordre : 1, 2, 3, 4. Pour voir les gestes, touchez « Lire le GIF » sous l’image. Chaque étape dure environ 4 secondes et l’animation recommence. « Arrêter le GIF » remet la première image.</p><div class="help-guides">'+guides.map(g=>'<section class="panel help-guide"><h2>'+g.title+'</h2><p class="small muted">Exemple illustré avec des lasagnes et un emplacement fictif. Aucun essai n’est ajouté à votre stock.</p><img class="help-demo" id="help-'+g.id+'" src="'+g.poster+'" alt="Guide illustré : '+g.title+'. Les quatre étapes sont détaillées ci-dessous."><button class="secondary wide" data-play-guide="'+g.id+'" aria-pressed="false">Lire le GIF : '+g.title.toLowerCase()+'</button><ol>'+g.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></section>').join('')+'</div><section class="panel"><h2>Ajouter et prendre des légumes non cuisinés</h2><p>Dans Mes plats, touchez « Ajouter des légumes ». Écrivez le nom, puis choisissez comment les compter : en pièces, en grammes ou en kilos. Indiquez la quantité, la date de rangement et votre emplacement. Fixez le stock d’alerte dans la même unité, puis touchez « Mettre au stock ».</p><p>Pour en utiliser, retrouvez leur fiche avec « Légumes non cuisinés » dans la liste de filtrage. Touchez « Je me sers », saisissez la quantité réellement prise dans l’unité affichée, puis « Confirmer la quantité prise ». L’application souhaite bonne cuisine. Une erreur se corrige dans Historique avec « Annuler ».</p><h2>Les autres petits repères</h2><p><strong>Connexion Google de secours :</strong> si votre navigateur bloque la connexion au stock dans l’application installable, <a href="https://script.google.com/macros/s/AKfycbyb6X17lXJRCDwbKCB9_PdCgKzXmCPH599IJnIgqSNq_bTGY7gyg3OTsM5G9RCrXjVk/exec" target="_blank" rel="noopener">ouvrez directement le stock Google</a>. Sur cette page de secours, utilisez le micro du clavier de votre téléphone pour dicter.</p><p><strong>Emplacements :</strong> dans La maison, créez vos propres noms. Un emplacement peut être supprimé lorsqu’il ne contient plus de portions. Déplacez les plats encore présents depuis le bouton ⋯ de leur fiche.</p><p><strong>Modifier une fiche :</strong> le bouton ⋯ permet de changer l’emplacement, le repère ou le stock d’alerte.</p><p><strong>Stock d’alerte :</strong> chaque plat a son seuil. Bientôt fini affiche les plats encore disponibles dont le stock atteint ce seuil ou passe en dessous ; Terminés affiche ceux à zéro.</p><p><strong>Dictée :</strong> touchez Dicter, autorisez le micro si demandé et attendez J’écoute. La phrase reconnue reste visible. Si le navigateur bloque ce micro, touchez Votre phrase dictée ou écrite, utilisez le micro du clavier de votre téléphone, puis Remplir les champs avec cette phrase. Vérifiez avant d’enregistrer.</p><p><strong>Animations :</strong> dans La maison, essayez les cinq cocottes et choisissez celles de cet appareil pour l’ouverture, l’ajout et la prise.</p><p><strong>Vos idées :</strong> chacun peut proposer une amélioration. EK voit le texte complet dans une fenêtre lorsque l’application est ouverte.</p><p><strong>Connexion :</strong> Internet est nécessaire pour le stock commun. Après une erreur réseau, réessayez la même action sans changer les quantités ; l’application évite les doublons.</p></section>';
    document.querySelectorAll('[data-play-guide]').forEach(button=>button.onclick=()=>{
      const guide=guides.find(g=>g.id===button.dataset.playGuide),playing=button.getAttribute('aria-pressed')==='true';
      $('#help-'+guide.id).src=playing?guide.poster:guide.gif;
      button.setAttribute('aria-pressed',String(!playing));button.textContent=playing?'Lire le GIF : '+guide.title.toLowerCase():'Arrêter le GIF';
    });
  }
  function exportStock(){
    const protect=x=>{let v=String(x??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
    const rows=[['Article','Quantité','Emplacement','Repère','Date','Seuil d’alerte','Type','Unité'],...state.meals.map(m=>[m.name,m.quantity,m.locationName,m.detail,m.preparedAt,m.threshold,m.kind==='vegetable'?'Légumes non cuisinés':'Plat préparé',MiamCore.unit(m)])];
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(protect).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Miam-Maman-stock-'+localDate()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#modeBanner').hidden=live;
  window.addEventListener('online',()=>refresh(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
  setInterval(()=>{if(!document.hidden)refresh(true);},30000);
  render();
  celebrate(animationPrefs.opening,'Bienvenue dans la cuisine !');
  try{const remembered=localStorage.getItem('miam-profile-v2');if(MiamCore.profiles.some(p=>p.id===remembered))login(remembered);}catch{}
})();
