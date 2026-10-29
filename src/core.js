/* Shared domain rules: browser preview and Google Apps Script. */
var MiamCore = (function () {
  'use strict';
  var PROFILES = [{id:'MLK',role:'maison',label:'MLK'},{id:'GK',role:'maison',label:'GK'},{id:'EK',role:'maison',label:'EK'}];
  var ILLUSTRATIONS={"dish": [{"emoji": "🍲", "label": "Cocotte"}, {"emoji": "🥘", "label": "Poêlée"}, {"emoji": "🥣", "label": "Soupe"}, {"emoji": "🍝", "label": "Pâtes"}, {"emoji": "🥧", "label": "Tarte"}, {"emoji": "🥗", "label": "Salade"}, {"emoji": "🍛", "label": "Curry et riz"}, {"emoji": "🍚", "label": "Riz"}, {"emoji": "🍜", "label": "Nouilles"}, {"emoji": "🍕", "label": "Pizza"}, {"emoji": "🍔", "label": "Burger"}, {"emoji": "🥪", "label": "Sandwich"}, {"emoji": "🌮", "label": "Tacos"}, {"emoji": "🌯", "label": "Wrap"}, {"emoji": "🥙", "label": "Pain garni"}, {"emoji": "🧆", "label": "Falafels"}, {"emoji": "🥟", "label": "Raviolis"}, {"emoji": "🍗", "label": "Volaille"}, {"emoji": "🥩", "label": "Viande"}, {"emoji": "🥓", "label": "Lardons"}, {"emoji": "🐟", "label": "Poisson"}, {"emoji": "🍤", "label": "Crevettes"}, {"emoji": "🍳", "label": "Œufs"}, {"emoji": "🥚", "label": "Œuf dur"}, {"emoji": "🥔", "label": "Pommes de terre"}, {"emoji": "🫘", "label": "Légumineuses"}, {"emoji": "🍄", "label": "Champignons"}, {"emoji": "🥦", "label": "Brocoli"}, {"emoji": "🥕", "label": "Carottes"}, {"emoji": "🥬", "label": "Légumes verts"}, {"emoji": "🧀", "label": "Fromage"}, {"emoji": "🥖", "label": "Pain"}, {"emoji": "🥞", "label": "Crêpes"}, {"emoji": "🧇", "label": "Gaufres"}, {"emoji": "🍰", "label": "Gâteau"}, {"emoji": "🍮", "label": "Dessert"}], "vegetable": [{"emoji": "🥕", "label": "Carottes"}, {"emoji": "🥦", "label": "Brocoli"}, {"emoji": "🥔", "label": "Pommes de terre"}, {"emoji": "🍅", "label": "Tomates"}, {"emoji": "🥒", "label": "Concombre ou courgette"}, {"emoji": "🧅", "label": "Oignons"}, {"emoji": "🧄", "label": "Ail"}, {"emoji": "🥬", "label": "Salade ou chou"}, {"emoji": "🍆", "label": "Aubergines"}, {"emoji": "🫑", "label": "Poivrons"}, {"emoji": "🌶️", "label": "Piments"}, {"emoji": "🌽", "label": "Maïs"}, {"emoji": "🫛", "label": "Petits pois"}, {"emoji": "🫘", "label": "Haricots"}, {"emoji": "🍄", "label": "Champignons"}, {"emoji": "🍠", "label": "Patates douces"}, {"emoji": "🥑", "label": "Avocat"}, {"emoji": "🫒", "label": "Olives"}]};
  function profile(id) { var found=PROFILES.find(function(p){return p.id===id;}); if(!found) fail('Choisissez MLK, GK ou EK.'); return Object.assign({},found); }
  function isLow(meal) { return meal.quantity>0 && meal.quantity<=meal.threshold; }
  function unit(m) { return m.unit || 'portions'; }
  function amount(v,u,zero) {
    var max=u==='g'?999999:999,scale=u==='kg'?1000:1;
    if(typeof v!=='number'||!Number.isFinite(v)||v<(zero?0:1/scale)||v>max||Math.abs(v*scale-Math.round(v*scale))>1e-7)fail('Quantité invalide : utilisez un nombre entier, ou jusqu’à trois décimales pour les kg.');
    return Math.round(v*scale)/scale;
  }
  function rounded(v){return Math.round(v*1000)/1000;}
  function empty() { return {locations: [], meals: [], events: [], suggestions: []}; }
  function fail(message) { throw new Error(message); }
  function text(value, max) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail('Merci de compléter les champs avec un texte valide.');
    return value.trim();
  }
  function integer(value, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) fail('Le nombre de portions doit être un entier valide.');
    return value;
  }
  function key(value) { return text(value, 100); }
  function norm(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function replay(events) {
    var s = empty();
    events.forEach(function(e) {
      var d = e.data, m = s.meals.find(function(x) { return x.id === d.id; });
      if (e.action === 'location.add') s.locations.push({id: d.id, name: d.name});
      if (e.action === 'location.delete') s.locations = s.locations.filter(function(x) { return x.id !== d.id; });
      if (e.action === 'meal.add') s.meals.push(Object.assign({}, d));
      if (e.action === 'meal.take' && m) m.quantity = rounded(m.quantity-d.quantity);
      if (e.action === 'meal.edit' && m) Object.assign(m, {locationId:d.locationId, locationName:d.locationName, detail:d.detail, threshold:d.threshold});
      if (e.action === 'meal.undo' && m) m.quantity = rounded(m.quantity+d.quantity);
      if (e.action === 'suggestion.add') s.suggestions.push({id:d.id,title:d.name,text:d.text,author:e.profile,at:e.at,seenBy:e.profile==='EK'?['EK']:[]});
      if (e.action === 'suggestion.seen') s.suggestions.forEach(function(item){if(d.ids.indexOf(item.id)>=0 && item.seenBy.indexOf(e.profile)<0)item.seenBy.push(e.profile);});
      s.events.push(e);
    });
    return s;
  }
  function command(s, role, action, args, id, now, actor) {
    if (role !== 'maison' && role !== 'maman' && role !== 'famille') fail('Connexion nécessaire.');
    key(id);
    var duplicate = s.events.find(function(e) { return e.id === id; });
    if (duplicate) {
      if ((duplicate.profile || null) !== (actor || null) || duplicate.role !== role || duplicate.action !== action || duplicate.request !== JSON.stringify(args)) fail('Cette opération existe déjà avec un contenu différent.');
      return null;
    }
    var d, meal, loc;
    if (action === 'suggestion.add') {
      profile(actor);
      d = {id:id,name:text(args.title||'Une idée pour l’appli',80),text:text(args.text,1000)};
    } else if (action === 'suggestion.seen') {
      profile(actor);
      if(!Array.isArray(args.ids)||!args.ids.length||args.ids.length>100)fail('Suggestions invalides.');
      var ids=args.ids.filter(function(value,index,list){return typeof value==='string'&&list.indexOf(value)===index&&s.suggestions.some(function(item){return item.id===value;});});
      if(ids.length!==args.ids.length)fail('Suggestions invalides.');
      d={id:id,ids:ids};
    } else if (action === 'location.add') {
      var name = text(args.name, 80);
      if (s.locations.some(function(x) { return norm(x.name) === norm(name); })) fail('Cet emplacement existe déjà.');
      d = {id:id, name:name};
    } else if (action === 'location.delete') {
      loc = s.locations.find(function(x) { return x.id === args.id; });
      if (!loc) fail('Cet emplacement a déjà été supprimé.');
      if (s.meals.some(function(x) { return x.locationId === args.id && x.quantity > 0; })) fail('Déplacez d’abord les plats encore stockés ici.');
      d = {id:loc.id, name:loc.name};
    } else if (action === 'meal.add') {
      loc = s.locations.find(function(x) { return x.id === args.locationId; });
      if (!loc) fail('Créez ou choisissez un emplacement avant d’enregistrer le plat.');
      var kind=args.kind||'dish',u=args.unit||(kind==='vegetable'?'pieces':'portions');
      if(['dish','vegetable'].indexOf(kind)<0 || (kind==='dish'?u!=='portions':['pieces','g','kg'].indexOf(u)<0))fail('Type ou unité invalide.');
      var date = text(args.preparedAt, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date+'T00:00:00Z').toISOString().slice(0,10) !== date) fail('La date de préparation est invalide.');
      var today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Paris'}).format(new Date(now));
      if (date > today) fail('La date de préparation ne peut pas être dans le futur.');
      d = {id:id, name:text(args.name,100), kind:kind,unit:u,quantity:amount(args.quantity,u,false), threshold:amount(args.threshold,u,true), locationId:loc.id, locationName:loc.name, detail:String(args.detail || '').trim().slice(0,120), preparedAt:date, emoji:ILLUSTRATIONS[kind].some(function(x){return x.emoji===args.emoji;})?args.emoji:ILLUSTRATIONS[kind][0].emoji};
    } else if (action === 'meal.take') {
      meal = s.meals.find(function(x) { return x.id === args.id; });
      if (!meal) fail('Ce plat est introuvable.');
      var n = amount(args.quantity,unit(meal),false);
      if (n > meal.quantity) fail('Il ne reste que '+meal.quantity+' '+unit(meal)+'. Actualisez le stock.');
      d = {id:meal.id, name:meal.name, quantity:n, unit:unit(meal),kind:meal.kind||'dish', locationName:meal.locationName};
    } else if (action === 'meal.edit') {
      meal = s.meals.find(function(x) { return x.id === args.id; });
      loc = s.locations.find(function(x) { return x.id === args.locationId; });
      if (!meal || !loc) fail('Le plat ou l’emplacement est introuvable.');
      d = {id:meal.id, name:meal.name, locationId:loc.id, locationName:loc.name, detail:String(args.detail || '').trim().slice(0,120), threshold:amount(args.threshold,unit(meal),true)};
    } else if (action === 'meal.undo') {
      var taken = s.events.find(function(e) { return e.id === args.eventId && e.action === 'meal.take'; });
      if (!taken) fail('Cette prise ne peut pas être annulée avec ce compte.');
      if (s.events.some(function(e) { return e.action === 'meal.undo' && e.data.eventId === taken.id; })) fail('Cette prise a déjà été annulée.');
      if (new Date(now).getTime()-new Date(taken.at).getTime()>24*3600000) fail('L’annulation est possible pendant 24 heures.');
      var undoMeal = s.meals.find(function(m) { return m.id === taken.data.id; });
      if (!undoMeal || !s.locations.some(function(l) { return l.id === undoMeal.locationId; })) fail('Cet emplacement a été supprimé. Replacez ce plat dans un emplacement avant d’annuler.');
      d = {id:taken.data.id, name:taken.data.name, quantity:taken.data.quantity,unit:unit(undoMeal),kind:undoMeal.kind||'dish', eventId:taken.id};
    } else fail('Action inconnue.');
    return {id:id, at:now, action:action, role:role, profile:actor||null, data:d, request:JSON.stringify(args)};
  }
  function parseVoice(input, locations) {
    var nums={zero:0,un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,onze:11,douze:12,treize:13,quatorze:14,quinze:15,seize:16,vingt:20};
    var original=String(input||'').trim().replace(/(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf)\s+virgule\s+(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf)/gi,function(_,a,b){return (nums[norm(a)]==null?a:nums[norm(a)])+'.'+(nums[norm(b)]==null?b:nums[norm(b)]);});
    var normalized=norm(original),result={},number='(\\d+(?:[,.]\\d+)?|zero|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt)';
    function value(v){return /^\d/.test(v)?Number(v.replace(',','.')):nums[v];}
    function unitOf(v){return /^(k)/.test(v)?'kg':/^(g)/.test(v)?'g':/^(p(?:ortion|art))/.test(v)?'portions':'pieces';}
    var alert=normalized.match(new RegExp("(?:stock d[’']alerte|seuil(?: d[’']alerte)?|alerte)\\s*(?:a|de|:)?\\s*"+number+'(?:\\s*(kg|kilos?|kilogrammes?|g|grammes?|pieces?|portions?|parts?))?'));
    var spoken=alert?original.slice(0,alert.index):original;
    var match=norm(spoken).match(new RegExp('\\b'+number+'\\s*(kilos?|kilogrammes?|kg|grammes?|g|pieces?|portions?|parts?)\\b'));
    if(!match)match=norm(spoken).match(new RegExp('^'+number+'\\s+(?=[a-z])'));
    var name=spoken;
    if(match){result.quantity=value(match[1]);if(match[2])result.unit=unitOf(match[2]);else result.unit='pieces';var after=spoken.slice(match.index+match[0].length).replace(/^\s*(?:de\s+|d[’'])/i,'');var before=spoken.slice(0,match.index).trim();name=after.trim()?after:before;}
    name=name.split(/\s+(?:dans|au|aux|à la|a la|à l[’']|a l[’']|sur)\s+/i)[0].replace(/^(?:j[’']ai\s+(?:fait|cuisiné|prepare|préparé)|je\s+(?:prepare|prépare|cuisine)|ajouter?|enregistrer)\s+/i,'').trim().replace(/[,.;:]+$/,'').trim();
    if(name)result.name=name;
    if(alert){result.threshold=value(alert[1]);var alertUnit=alert[2]?unitOf(alert[2]):result.unit;if(result.unit==='kg'&&alertUnit==='g')result.threshold=result.threshold/1000;else if(result.unit==='g'&&alertUnit==='kg')result.threshold=result.threshold*1000;}
    var candidates=locations.filter(function(l){return normalized.indexOf(norm(l.name))>=0;}).sort(function(a,b){return b.name.length-a.name.length;});
    if(candidates[0])result.locationId=candidates[0].id;
    return result;
  }
  function unreadSuggestions(s,actor){return actor==='EK'?s.suggestions.filter(function(item){return item.author!==actor&&item.seenBy.indexOf(actor)<0;}):[];}
  return {illustrations:ILLUSTRATIONS,unit:unit,unreadSuggestions:unreadSuggestions,profiles:PROFILES,profile:profile,isLow:isLow,empty:empty,replay:replay,command:command,parseVoice:parseVoice,norm:norm};
})();
