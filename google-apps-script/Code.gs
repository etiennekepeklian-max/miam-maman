/** Miam Maman — backend Google Sheets. No storage location is seeded. */
var SPREADSHEET_ID = '1_yC0fdQKQWo84xmK01QVIOPFqHTZF5Ve0mXycFqk3_A';
var OWNER_EMAIL = 'etienne.kepeklian@gmail.com';
var HEADERS = {
  Stock:['ID préparation','Plat','Portions','Emplacement','Repère','Préparé le','Seuil','État'],
  Emplacements:['ID emplacement','Nom'],
  Journal:['Horodatage','ID opération','Action','Compte','ID objet','Nom','Emplacement','Variation portions','Seuil','Préparé le','Repère','Opération annulée','Données événement'],
  Comptes:['Compte','Utilisation'],
  Suggestions:['ID suggestion','Date','Profil','Titre','Suggestion','Lue par EK']
};
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Miam Maman !').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport','width=device-width, initial-scale=1');
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Miam Maman !').addItem('Voir les trois profils','afficherLesProfils').addItem('Reconstruire la vue du stock','reconstruireLeStock').addToUi();
}
function owner_() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== OWNER_EMAIL.toLowerCase()) throw new Error('Cette action est réservée au propriétaire.');
}
function sheet_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function afficherLesProfils() {
  owner_();
  SpreadsheetApp.getUi().alert('Les profils de la maison','MLK, GK et EK ont les mêmes possibilités : ajouter des plats, prendre des portions, gérer les emplacements et les seuils.\n\nAucun mot de passe : chacun choisit son profil dans l’application.',SpreadsheetApp.getUi().ButtonSet.OK);
}
function profilesSheet_() {
  var ss=sheet_();
  Object.keys(HEADERS).forEach(function(name){var s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);if(!s.getLastRow())s.appendRow(HEADERS[name]);});
  var rows=[['MLK','Ajouter les plats, gérer les emplacements et les seuils, prendre des portions'],['GK','Ajouter les plats, gérer les emplacements et les seuils, prendre des portions'],['EK','Ajouter les plats, gérer les emplacements et les seuils, prendre des portions']];
  var sh=ss.getSheetByName('Comptes');
  if(JSON.stringify(sh.getRange(2,1,3,2).getValues())!==JSON.stringify(rows)){
    sh.getRange(2,1,3,2).setValues(rows);
    SpreadsheetApp.flush();
  }
}
// Profiles identify household actions. Choosing one is intentionally not authentication.
function login_(args) {
  var p=MiamCore.profile(args.profile);
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    profilesSheet_();
    var token=Utilities.getUuid()+Utilities.getUuid();
    CacheService.getScriptCache().put('PROFILE_V3_'+token,JSON.stringify({role:p.role,profile:p.id}),21600);
    return {ok:true,role:p.role,profile:p.id,token:token,state:readState_()};
  } finally {lock.releaseLock();}
}
function session_(token) {
  if(typeof token!=='string'||token.length>200)throw new Error('Choisissez votre profil pour continuer.');
  var value=CacheService.getScriptCache().get('PROFILE_V3_'+token);
  if(!value)throw new Error('Choisissez votre profil pour continuer.');
  var s=JSON.parse(value),p=MiamCore.profile(s.profile);
  if(p.role!==s.role)throw new Error('Profil invalide.');
  return s;
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
  sheet_().getSheetByName('Journal').appendRow([e.at,e.id,e.action,e.profile||e.role,d.id,literal_(d.name),literal_(d.locationName),delta,d.threshold==null?'':d.threshold,d.preparedAt||'',literal_(d.detail),d.eventId||'',JSON.stringify(e)]);
  SpreadsheetApp.flush();
}
function project_(s) {
  var ss=sheet_();
  function write(name,rows){var sh=ss.getSheetByName(name);var size=HEADERS[name].length;if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,size).clearContent();if(rows.length){if(sh.getMaxRows()<rows.length+1)sh.insertRowsAfter(sh.getMaxRows(),rows.length+1-sh.getMaxRows());sh.getRange(2,1,rows.length,size).setValues(rows);}}
  write('Stock',s.meals.map(function(m){return [m.id,literal_(m.name),m.quantity,literal_(m.locationName),literal_(m.detail),m.preparedAt,m.threshold,m.quantity===0?'Terminé':m.quantity<=m.threshold?'Bientôt fini':'Disponible'];}));
  write('Emplacements',s.locations.map(function(l){return [l.id,literal_(l.name)];}));
  write('Suggestions',s.suggestions.map(function(item){return [item.id,item.at,item.author,literal_(item.title),literal_(item.text),item.seenBy.indexOf('EK')>=0?'Oui':'Non'];}));
  SpreadsheetApp.flush();
}
function reconstruireLeStock() {owner_();var l=LockService.getScriptLock();l.waitLock(15000);try{project_(readState_());}finally{l.releaseLock();}}
function rpc(action,args) {
  try {
    if(typeof action!=='string'||!args||typeof args!=='object')throw new Error('Requête invalide.');
    if(action==='login')return login_(args);
    var session=session_(args.token);
    if(action==='logout'){CacheService.getScriptCache().remove('PROFILE_V3_'+args.token);return {ok:true};}
    var lock=LockService.getScriptLock();lock.waitLock(15000);
    try {
      var s=readState_();
      if(action==='state')return {ok:true,state:s};
      if(!args.payload||JSON.stringify(args.payload).length>4000)throw new Error('Formulaire invalide.');
      var e=MiamCore.command(s,session.role,action,args.payload,args.id,new Date().toISOString(),session.profile);
      if(e){append_(e);s=MiamCore.replay(s.events.concat([e]));}
      // The journal is authoritative. A projection error must not duplicate a meal take.
      var warning=null;try{project_(s);}catch(projectionError){warning='La vue du Google Sheet doit être actualisée depuis son menu.';}
      return {ok:true,state:s,eventId:e?e.id:args.id,warning:warning};
    } finally {lock.releaseLock();}
  } catch(e) {return {ok:false,error:e.message||'La demande n’a pas pu être enregistrée.',code:e.message==='Choisissez votre profil pour continuer.'?'PROFILE_SESSION_EXPIRED':null};}
}
