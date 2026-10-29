import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const context=vm.createContext({console,Date,Intl});vm.runInContext(fs.readFileSync(new URL('../src/core.js',import.meta.url),'utf8'),context);
const c=context.MiamCore,now='2026-10-27T12:00:00.000Z';
const clone=x=>JSON.parse(JSON.stringify(x));
function perform(s,role,action,args,id){const event=c.command(s,role,action,args,id,now);return event?c.replay([...s.events,event]):s;}
function fixture(){let s=c.empty();s=perform(s,'maman','location.add',{name:'Notre emplacement'},'loc');s=perform(s,'maman','meal.add',{name:'Lasagnes',locationId:'loc',quantity:2,threshold:1,preparedAt:'2026-10-27',detail:'Boîte bleue',emoji:'🥘'},'meal');return s;}
test('starts with no meals and no storage locations',()=>assert.deepEqual(clone(c.empty()),{locations:[],meals:[],events:[],suggestions:[]}));
test('MLK GK and EK share every stock action',()=>{for(const p of c.profiles){let s=c.empty();function act(action,args,id){const e=c.command(s,p.role,action,args,id,now,p.id);s=c.replay([...s.events,e]);}act('location.add',{name:'Notre coin'},'loc');act('meal.add',{name:'Soupe',locationId:'loc',quantity:2,threshold:1,preparedAt:'2026-10-27'},'meal');act('meal.edit',{id:'meal',locationId:'loc',threshold:2},'edit');act('meal.take',{id:'meal',quantity:2},'take');act('meal.undo',{eventId:'take'},'undo');act('meal.take',{id:'meal',quantity:2},'take-again');act('location.delete',{id:'loc'},'delete');assert.equal(s.meals[0].quantity,0);assert.equal(s.locations.length,0);assert.equal(s.events[0].profile,p.id);}});
test('a used location cannot be removed; empty one can, preserving meal history',()=>{let s=fixture();assert.throws(()=>c.command(s,'maman','location.delete',{id:'loc'},'del',now),/Déplacez/);s=perform(s,'famille','meal.take',{id:'meal',quantity:2},'take');s=perform(s,'maman','location.delete',{id:'loc'},'del');assert.equal(s.locations.length,0);assert.equal(s.meals[0].locationName,'Notre emplacement');});
test('moving a meal permits deletion of its previous location',()=>{let s=fixture();s=perform(s,'maman','location.add',{name:'Nouvel endroit'},'loc2');s=perform(s,'maman','meal.edit',{id:'meal',locationId:'loc2',detail:'Étagère haute',threshold:0},'move');s=perform(s,'maman','location.delete',{id:'loc'},'delete');assert.equal(s.locations.length,1);assert.equal(s.meals[0].locationId,'loc2');assert.equal(s.meals[0].quantity,2);});
test('stock never becomes negative and concurrent last-portion requests are rejected',()=>{let s=fixture();s=perform(s,'famille','meal.take',{id:'meal',quantity:2},'take');assert.throws(()=>c.command(s,'famille','meal.take',{id:'meal',quantity:1},'take2',now),/Il ne reste que 0/);assert.equal(s.meals[0].quantity,0);});
test('transport retry with same operation ID is idempotent and altered retry is rejected',()=>{let s=fixture();const payload={id:'meal',quantity:1};s=perform(s,'famille','meal.take',payload,'take');assert.equal(c.command(s,'famille','meal.take',payload,'take',now),null);assert.equal(s.meals[0].quantity,1);assert.throws(()=>c.command(s,'famille','meal.take',{id:'meal',quantity:2},'take',now),/différent/);});
test('an accidental take can be undone exactly once',()=>{let s=fixture();s=perform(s,'famille','meal.take',{id:'meal',quantity:1},'take');s=perform(s,'famille','meal.undo',{eventId:'take'},'undo');assert.equal(s.meals[0].quantity,2);assert.throws(()=>c.command(s,'famille','meal.undo',{eventId:'take'},'undo2',now),/déjà été annulée/);});
test('invalid quantities, missing storage and invalid dates are rejected',()=>{const s=fixture(),base={name:'Soupe',locationId:'loc',quantity:1,threshold:0,preparedAt:'2026-10-27'};for(const quantity of [-1,0,1.2,NaN,1000,'2'])assert.throws(()=>c.command(s,'maman','meal.add',{...base,quantity},'m'+quantity,now));assert.throws(()=>c.command(s,'maman','meal.add',{...base,locationId:'missing'},'no-loc',now),/emplacement/);assert.throws(()=>c.command(s,'maman','meal.add',{...base,preparedAt:'2026-02-31'},'date',now),/date/);});
test('duplicate location names ignore case and accents',()=>{const s=perform(c.empty(),'maman','location.add',{name:'Étage'},'one');assert.throws(()=>c.command(s,'maman','location.add',{name:'etage'},'two',now),/existe déjà/);});
test('voice extracts French quantities and matches only user-created locations',()=>{const r=c.parseVoice('Six portions de lasagnes dans Notre emplacement',[{id:'abc',name:'Notre emplacement'}]);assert.equal(r.quantity,6);assert.equal(r.name,'lasagnes');assert.equal(r.locationId,'abc');const r2=c.parseVoice('2 portions de soupe dans un autre endroit',[]);assert.equal(r2.quantity,2);assert.equal(r2.locationId,undefined);});

test('every preparation keeps its own editable alert threshold',()=>{
  let s=fixture();s=perform(s,'maman','meal.add',{name:'Soupe',locationId:'loc',quantity:5,threshold:4,preparedAt:'2026-10-27'},'soup');
  assert.equal(c.isLow(s.meals[0]),false);assert.equal(c.isLow(s.meals[1]),false);
  s=perform(s,'famille','meal.take',{id:'soup',quantity:1},'take-soup');assert.equal(c.isLow(s.meals[1]),true);
  s=perform(s,'maman','meal.edit',{id:'meal',locationId:'loc',threshold:2},'threshold');assert.equal(c.isLow(s.meals[0]),true);
  assert.equal(s.meals[1].threshold,4);assert.equal(s.meals[0].quantity,2);
  for(const threshold of [-1,1.5,1000,'2'])assert.throws(()=>c.command(s,'maman','meal.edit',{id:'meal',locationId:'loc',threshold},'bad'+threshold,now));
  assert.equal(c.isLow({quantity:0,threshold:4}),false);
});
test('voice can set a separate alert threshold, including zero',()=>{
  const r=c.parseVoice('Six portions de lasagnes dans Notre emplacement, alerte à deux portions',[{id:'loc',name:'Notre emplacement'}]);
  assert.equal(r.quantity,6);assert.equal(r.threshold,2);assert.equal(r.locationId,'loc');assert.equal(r.name,'lasagnes');
  assert.equal(c.parseVoice("3 portions de soupe stock d'alerte zéro",[]).threshold,0);
});

test('suggestions are kept and EK receives their complete text once',()=>{
  let s=c.empty();const add=c.command(s,'maison','suggestion.add',{title:'Une idée',text:'Afficher une liste de courses.'},'idea',now,'GK');
  s=c.replay([add]);assert.equal(s.suggestions[0].author,'GK');assert.equal(c.unreadSuggestions(s,'EK')[0].text,'Afficher une liste de courses.');assert.equal(c.unreadSuggestions(s,'GK').length,0);
  const seen=c.command(s,'maison','suggestion.seen',{ids:['idea']},'seen',now,'EK');s=c.replay([...s.events,seen]);assert.equal(c.unreadSuggestions(s,'EK').length,0);assert.equal(s.suggestions[0].text,'Afficher une liste de courses.');
  assert.throws(()=>c.command(s,'maison','suggestion.add',{title:'Non',text:' '},'empty',now,'MLK'));
  assert.throws(()=>c.command(s,'maison','suggestion.add',{text:'x'.repeat(1001)},'huge',now,'MLK'));
});
test('EK own suggestions do not create a self notification',()=>{const e=c.command(c.empty(),'maison','suggestion.add',{title:'Mon idée',text:'Plus de bonnes choses.'},'own',now,'EK');assert.equal(c.unreadSuggestions(c.replay([e]),'EK').length,0);});
