/** Miam Maman — backend Google Sheets. No storage location is seeded. */
var SPREADSHEET_ID = '1_yC0fdQKQWo84xmK01QVIOPFqHTZF5Ve0mXycFqk3_A';
var OWNER_EMAIL = 'etienne.kepeklian@gmail.com';
var HEADERS = {
  Stock:['ID préparation','Plat','Portions','Emplacement','Repère','Préparé le','Seuil','État'],
  Emplacements:['ID emplacement','Nom'],
  Journal:['Horodatage','ID opération','Action','Compte','ID objet','Nom','Emplacement','Variation portions','Seuil','Préparé le','Repère','Opération annulée','Données événement'],
  Comptes:['Compte','Utilisation']
};
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Miam Maman !').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport','width=device-width, initial-scale=1');
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Miam Maman !').addItem('Configurer les deux comptes','configurerLesComptes').addItem('Reconstruire la vue du stock','reconstruireLeStock').addToUi();
}
function owner_() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== OWNER_EMAIL.toLowerCase()) throw new Error('Cette action est réservée au propriétaire.');
}
function sheet_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function configurerLesComptes() {
  owner_();
  var html = '<!doctype html><html lang="fr"><meta charset="utf-8"><style>body{font:15px system-ui;color:#294536;padding:18px;background:#fff8ec}label{display:block;margin:15px 0}input{display:block;padding:12px;width:90%;margin-top:8px;border:1px solid #aaa;border-radius:9px}button{padding:14px;border:0;border-radius:12px;background:#e77761;color:white;font-weight:bold}p{line-height:1.5}</style><h2>Les accès de la maison</h2><p>Choisissez un code différent pour chaque compte, avec au moins 6 caractères. Partagez ensuite le code Famille avec vos proches.</p><form id="f"><label>Code du compte Maman<input type="password" id="m" minlength="6" maxlength="64" required autocomplete="new-password"></label><label>Code du compte Famille<input type="password" id="a" minlength="6" maxlength="64" required autocomplete="new-password"></label><button id="b">Enregistrer les accès</button></form><p id="r" role="status"></p><script>document.getElementById("f").onsubmit=function(e){e.preventDefault();document.getElementById("b").disabled=true;google.script.run.withSuccessHandler(function(){document.getElementById("m").value="";document.getElementById("a").value="";document.getElementById("r").textContent="Les deux comptes sont prêts. Vous pouvez fermer cette fenêtre.";}).withFailureHandler(function(e){document.getElementById("r").textContent=e.message;document.getElementById("b").disabled=false;}).enregistrerComptes(document.getElementById("m").value,document.getElementById("a").value);};</script></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(470).setHeight(530),'Configurer Miam Maman');
}
function enregistrerComptes(maman, famille) {
  owner_();
  if (typeof maman !== 'string' || typeof famille !== 'string' || maman.length<6 || famille.length<6 || maman.length>64 || famille.length>64 || maman===famille) throw new Error('Choisissez deux codes différents de 6 à 64 caractères.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var p=PropertiesService.getScriptProperties(),pepper=Utilities.getUuid()+Utilities.getUuid(), ms=Utilities.getUuid(),fs=Utilities.getUuid();
    p.setProperties({PEPPER:pepper,MAMAN_SALT:ms,FAMILLE_SALT:fs,MAMAN_HASH:hash_(maman,pepper+ms),FAMILLE_HASH:hash_(famille,pepper+fs),AUTH_EPOCH:Utilities.getUuid()});
    p.deleteProperty('FAIL_MAMAN');p.deleteProperty('FAIL_FAMILLE');
    var ss=sheet_();
    Object.keys(HEADERS).forEach(function(name){var s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);if(!s.getLastRow())s.appendRow(HEADERS[name]);});
    ss.getSheetByName('Comptes').getRange(2,1,2,2).setValues([['Maman','Ajouter les préparations, gérer les emplacements et les seuils'],['Famille','Consulter les plats et déclarer les portions prises']]);
    SpreadsheetApp.flush();
  } finally {lock.releaseLock();}
  return true;
}
function hash_(value,key) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,key)); }
function same_(a,b) { if(typeof a!=='string'||typeof b!=='string')return false;var diff=a.length^b.length;for(var i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0; }
function login_(args) {
  if(args.role!=='maman'&&args.role!=='famille')throw new Error('Compte inconnu.');
  var role=args.role.toUpperCase(),p=PropertiesService.getScriptProperties();
  if(!p.getProperty('AUTH_EPOCH')||!p.getProperty(role+'_HASH'))throw new Error('Les accès ne sont pas encore configurés. Le propriétaire doit les créer depuis le menu Miam Maman du Google Sheet.');
  if(typeof args.password!=='string'||args.password.length>64)throw new Error('Code incorrect.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    var key='FAIL_'+role,now=Date.now(),limit=JSON.parse(p.getProperty(key)||'{"count":0,"until":0}');
    if(now>limit.until)limit={count:0,until:now+15*60000};
    if(limit.count>=8)throw new Error('Trop d’essais. Réessayez dans quelques minutes.');
    if(!same_(hash_(args.password,p.getProperty('PEPPER')+p.getProperty(role+'_SALT')),p.getProperty(role+'_HASH'))){limit.count++;p.setProperty(key,JSON.stringify(limit));throw new Error('Code incorrect.');}
    p.deleteProperty(key);
    var token=Utilities.getUuid()+Utilities.getUuid();
    CacheService.getScriptCache().put('SESSION_'+hash_(token,'session'),JSON.stringify({role:args.role,epoch:p.getProperty('AUTH_EPOCH')}),21600);
    return {ok:true,role:args.role,token:token,state:readState_()};
  } finally {lock.releaseLock();}
}
function session_(token) {
  if(typeof token!=='string'||token.length>200)throw new Error('Reconnectez-vous pour continuer.');
  var v=CacheService.getScriptCache().get('SESSION_'+hash_(token,'session'));
  if(!v)throw new Error('Votre session est terminée. Changez de compte pour vous reconnecter.');
  var s=JSON.parse(v);if(s.epoch!==PropertiesService.getScriptProperties().getProperty('AUTH_EPOCH'))throw new Error('Vos accès ont changé. Reconnectez-vous.');return s;
}
function events_() {
  var s=sheet_().getSheetByName('Journal');if(!s)throw new Error('Le journal Google Sheets est introuvable.');
  var n=s.getLastRow()-1;if(n<=0)return [];
  if(n>20000)throw new Error('Le journal a atteint sa limite. Un archivage est nécessaire avant de continuer.');
  return s.getRange(2,13,n,1).getValues().filter(function(r){return r[0]!=='';}).map(function(r){return JSON.parse(r[0]);});
}
function readState_() { return MiamCore.replay(events_()); }
function literal_(v) { var s=String(v==null?'':v);return /^[=+\-@\t\r]/.test(s)?"'"+s:s; }
function append_(e) {
  var d=e.data,delta=e.action==='meal.take'?-d.quantity:e.action==='meal.add'||e.action==='meal.undo'?d.quantity:'';
  sheet_().getSheetByName('Journal').appendRow([e.at,e.id,e.action,e.role,d.id,literal_(d.name),literal_(d.locationName),delta,d.threshold==null?'':d.threshold,d.preparedAt||'',literal_(d.detail),d.eventId||'',JSON.stringify(e)]);
  SpreadsheetApp.flush();
}
function project_(s) {
  var ss=sheet_();
  function write(name,rows){var sh=ss.getSheetByName(name);var size=HEADERS[name].length;if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,size).clearContent();if(rows.length){if(sh.getMaxRows()<rows.length+1)sh.insertRowsAfter(sh.getMaxRows(),rows.length+1-sh.getMaxRows());sh.getRange(2,1,rows.length,size).setValues(rows);}}
  write('Stock',s.meals.map(function(m){return [m.id,literal_(m.name),m.quantity,literal_(m.locationName),literal_(m.detail),m.preparedAt,m.threshold,m.quantity===0?'Terminé':m.quantity<=m.threshold?'Bientôt fini':'Disponible'];}));
  write('Emplacements',s.locations.map(function(l){return [l.id,literal_(l.name)];}));
  SpreadsheetApp.flush();
}
function reconstruireLeStock() {owner_();var l=LockService.getScriptLock();l.waitLock(15000);try{project_(readState_());}finally{l.releaseLock();}}
function rpc(action,args) {
  try {
    if(typeof action!=='string'||!args||typeof args!=='object')throw new Error('Requête invalide.');
    if(action==='ownerLogin') {
      owner_();
      var properties=PropertiesService.getScriptProperties();
      if(!properties.getProperty('AUTH_EPOCH'))properties.setProperty('AUTH_EPOCH',Utilities.getUuid());
      var ownerToken=Utilities.getUuid()+Utilities.getUuid();
      CacheService.getScriptCache().put('SESSION_'+hash_(ownerToken,'session'),JSON.stringify({role:'maman',epoch:properties.getProperty('AUTH_EPOCH')}),21600);
      return {ok:true,role:'maman',token:ownerToken,state:readState_()};
    }
    if(action==='login')return login_(args);
    var session=session_(args.token);
    if(action==='logout'){CacheService.getScriptCache().remove('SESSION_'+hash_(args.token,'session'));return {ok:true};}
    var lock=LockService.getScriptLock();lock.waitLock(15000);
    try {
      var s=readState_();
      if(action==='state')return {ok:true,state:s};
      if(!args.payload||JSON.stringify(args.payload).length>4000)throw new Error('Formulaire invalide.');
      var e=MiamCore.command(s,session.role,action,args.payload,args.id,new Date().toISOString());
      if(e){append_(e);s=MiamCore.replay(s.events.concat([e]));}
      // The journal is authoritative. A projection error must not duplicate a meal take.
      var warning=null;try{project_(s);}catch(projectionError){warning='La vue du Google Sheet doit être actualisée depuis son menu.';}
      return {ok:true,state:s,eventId:e?e.id:args.id,warning:warning};
    } finally {lock.releaseLock();}
  } catch(e) {return {ok:false,error:e.message||'La demande n’a pas pu être enregistrée.'};}
}
