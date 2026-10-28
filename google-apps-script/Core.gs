/* Shared domain rules: browser preview and Google Apps Script. */
var MiamCore = (function () {
  'use strict';
  function empty() { return {locations: [], meals: [], events: []}; }
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
      if (e.action === 'meal.take' && m) m.quantity -= d.quantity;
      if (e.action === 'meal.edit' && m) Object.assign(m, {locationId:d.locationId, locationName:d.locationName, detail:d.detail, threshold:d.threshold});
      if (e.action === 'meal.undo' && m) m.quantity += d.quantity;
      s.events.push(e);
    });
    return s;
  }
  function command(s, role, action, args, id, now) {
    if (role !== 'maman' && role !== 'famille') fail('Connexion nécessaire.');
    key(id);
    var duplicate = s.events.find(function(e) { return e.id === id; });
    if (duplicate) {
      if (duplicate.role !== role || duplicate.action !== action || duplicate.request !== JSON.stringify(args)) fail('Cette opération existe déjà avec un contenu différent.');
      return null;
    }
    if (['location.add','location.delete','meal.add','meal.edit'].indexOf(action) >= 0 && role !== 'maman') fail('Seul le compte Maman peut gérer les préparations et les emplacements.');
    if (action === 'meal.take' && role !== 'famille') fail('Utilisez le compte Famille pour vous servir.');
    var d, meal, loc;
    if (action === 'location.add') {
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
      var date = text(args.preparedAt, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date+'T00:00:00Z').toISOString().slice(0,10) !== date) fail('La date de préparation est invalide.');
      var today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Paris'}).format(new Date(now));
      if (date > today) fail('La date de préparation ne peut pas être dans le futur.');
      d = {id:id, name:text(args.name,100), quantity:integer(args.quantity,1,999), threshold:integer(args.threshold,0,999), locationId:loc.id, locationName:loc.name, detail:String(args.detail || '').trim().slice(0,120), preparedAt:date, emoji:['🍲','🥘','🥣','🍝','🥧','🥗'].indexOf(args.emoji)>=0?args.emoji:'🍲'};
    } else if (action === 'meal.take') {
      meal = s.meals.find(function(x) { return x.id === args.id; });
      if (!meal) fail('Ce plat est introuvable.');
      var n = integer(args.quantity,1,999);
      if (n > meal.quantity) fail('Il ne reste que '+meal.quantity+' portion(s). Actualisez le stock.');
      d = {id:meal.id, name:meal.name, quantity:n, locationName:meal.locationName};
    } else if (action === 'meal.edit') {
      meal = s.meals.find(function(x) { return x.id === args.id; });
      loc = s.locations.find(function(x) { return x.id === args.locationId; });
      if (!meal || !loc) fail('Le plat ou l’emplacement est introuvable.');
      d = {id:meal.id, name:meal.name, locationId:loc.id, locationName:loc.name, detail:String(args.detail || '').trim().slice(0,120), threshold:integer(args.threshold,0,999)};
    } else if (action === 'meal.undo') {
      var taken = s.events.find(function(e) { return e.id === args.eventId && e.action === 'meal.take'; });
      if (!taken || taken.role !== role || role !== 'famille') fail('Cette prise ne peut pas être annulée avec ce compte.');
      if (s.events.some(function(e) { return e.action === 'meal.undo' && e.data.eventId === taken.id; })) fail('Cette prise a déjà été annulée.');
      if (new Date(now).getTime()-new Date(taken.at).getTime()>24*3600000) fail('L’annulation est possible pendant 24 heures.');
      var undoMeal = s.meals.find(function(m) { return m.id === taken.data.id; });
      if (!undoMeal || !s.locations.some(function(l) { return l.id === undoMeal.locationId; })) fail('Cet emplacement a été supprimé. Demandez à Maman de replacer ce plat dans un emplacement avant d’annuler.');
      d = {id:taken.data.id, name:taken.data.name, quantity:taken.data.quantity, eventId:taken.id};
    } else fail('Action inconnue.');
    return {id:id, at:now, action:action, role:role, data:d, request:JSON.stringify(args)};
  }
  function parseVoice(input, locations) {
    var original = String(input).trim(), normalized = norm(original), result = {};
    var match = normalized.match(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt)\s+portions?\b/);
    var nums = {un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,onze:11,douze:12,treize:13,quatorze:14,quinze:15,seize:16,vingt:20};
    if (match) {
      result.quantity = /^\d+$/.test(match[1]) ? Number(match[1]) : nums[match[1]];
      var start = original.slice(match.index+match[0].length).replace(/^\s*(?:de |d[’'])/i,'');
      result.name = start.split(/\s+(?:dans|au|aux|a la|à la|a l[’']|à l[’']|sur|seuil|alerte)\s+/i)[0].replace(/[,.;]+$/,'').trim();
    }
    var candidates = locations.filter(function(l) { return normalized.indexOf(norm(l.name))>=0; }).sort(function(a,b) { return b.name.length-a.name.length; });
    if (candidates[0]) result.locationId = candidates[0].id;
    return result;
  }
  return {empty:empty,replay:replay,command:command,parseVoice:parseVoice,norm:norm};
})();
