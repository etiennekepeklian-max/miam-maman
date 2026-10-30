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

test('raw vegetables use pieces grams or precise kilos without changing existing dishes',()=>{
  for(const [unit,quantity,threshold,take,remaining] of [['pieces',6,2,2,4],['g',1500,300,250,1250],['kg',0.3,0.1,0.2,0.1]]){
    let s=fixture();s=perform(s,'maison','meal.add',{name:'Carottes',kind:'vegetable',unit,quantity,threshold,locationId:'loc',preparedAt:'2026-10-27',emoji:'🥕'},'veg');
    s=perform(s,'maison','meal.take',{id:'veg',quantity:take},'take-veg');assert.equal(s.meals[1].quantity,remaining);assert.equal(c.unit(s.meals[1]),unit);assert.equal(s.meals[1].kind,'vegetable');assert.equal(s.meals[0].quantity,2);assert.equal(c.unit(s.meals[0]),'portions');
    s=perform(s,'maison','meal.edit',{id:'veg',locationId:'loc',threshold:remaining},'edit-veg');assert.equal(c.isLow(s.meals[1]),true);
    s=perform(s,'maison','meal.undo',{eventId:'take-veg'},'undo-veg');assert.equal(s.meals[1].quantity,quantity);
    assert.throws(()=>c.command(s,'maison','meal.take',{id:'veg',quantity:quantity+1},'too-much',now),/Il ne reste/);
  }
});
test('invalid vegetable units and fractional pieces or grams are rejected',()=>{
  const s=fixture(),base={name:'Carottes',kind:'vegetable',unit:'pieces',quantity:6,threshold:2,preparedAt:'2026-10-27',locationId:'loc'};
  for(const change of [{unit:'litres'},{unit:'portions'},{kind:'unknown'},{quantity:1.2},{unit:'g',quantity:1.5},{unit:'kg',quantity:0.0001},{unit:'kg',quantity:NaN},{threshold:-1}])assert.throws(()=>c.command(s,'maison','meal.add',{...base,...change},'bad',now));
});
test('old journal entries remain portions and raw vegetable dictation extracts weight',()=>{
  const old=fixture().events.map(e=>{const copy=clone(e);delete copy.data.kind;delete copy.data.unit;return copy;});assert.equal(c.unit(c.replay(old).meals[0]),'portions');
  for(const phrase of ['Deux kilos de carottes dans Notre emplacement','1,5 kg de carottes dans Notre emplacement']){const r=c.parseVoice(phrase,[{id:'loc',name:'Notre emplacement'}]);assert.equal(r.unit,'kg');assert.equal(r.name,'carottes');assert.equal(r.locationId,'loc');assert.ok(r.quantity>0);}
});

test('dictation fills a name even without a quantity and accepts parts or a trailing weight',()=>{
  assert.equal(c.parseVoice('Soupe de légumes',[]).name,'Soupe de légumes');assert.equal(c.parseVoice('1,5 kilos de carottes, alerte à 500 grammes',[]).name,'carottes');
  assert.equal(c.parseVoice('Soupe de légumes',[]).quantity,undefined);
  const parts=c.parseVoice('Six parts de lasagnes dans Notre emplacement',[{id:'loc',name:'Notre emplacement'}]);assert.equal(parts.quantity,6);assert.equal(parts.name,'lasagnes');assert.equal(parts.unit,'portions');
  const trailing=c.parseVoice('Carottes 500 grammes',[]);assert.equal(trailing.name,'Carottes');assert.equal(trailing.quantity,500);assert.equal(trailing.unit,'g');
});
test('spoken decimal kilos and alert quantities in grams are understood',()=>{
  const r=c.parseVoice('Un virgule cinq kilos de carottes dans Notre emplacement, alerte à 500 grammes',[{id:'loc',name:'Notre emplacement'}]);assert.equal(r.quantity,1.5);assert.equal(r.unit,'kg');assert.equal(r.threshold,0.5);assert.equal(r.name,'carottes');assert.equal(r.locationId,'loc');
  const pieces=c.parseVoice('Six carottes dans Notre emplacement',[]);assert.equal(pieces.quantity,6);assert.equal(pieces.unit,'pieces');assert.equal(pieces.name,'carottes');
});
test('all offered illustrations can be saved with the proper food category',()=>{
  for(const kind of ['dish','vegetable']){assert.ok(c.illustrations[kind].length>=18);for(const item of c.illustrations[kind]){const e=c.command(fixture(),'maison','meal.add',{kind,name:item.label,emoji:item.emoji,unit:kind==='dish'?'portions':'pieces',quantity:2,threshold:1,preparedAt:'2026-10-27',locationId:'loc'},'icon',now);assert.equal(e.data.emoji,item.emoji);}}
});

test('locations are unique within a level and renamed locations update cards without rewriting history',()=>{
 let s=fixture();s=perform(s,'maison','location.add',{name:'Congélateur',level:'Rez-de-chaussée'},'ground');s=perform(s,'maison','location.add',{name:'Congélateur',level:'Sous-sol'},'basement');
 assert.throws(()=>c.command(s,'maison','location.add',{name:'congelateur',level:'Sous-sol'},'dup',now),/existe/);
 s=perform(s,'maison','location.edit',{id:'loc',name:'Tiroir de la commode',level:'Sous-sol'},'rename');assert.equal(s.meals[0].locationName,'Tiroir de la commode');assert.equal(s.meals[0].locationLevel,'Sous-sol');assert.equal(s.events.find(e=>e.id==='meal').data.locationName,'Notre emplacement');
 const ambiguous=c.parseVoice('Deux portions de soupe dans Congélateur',s.locations);assert.equal(ambiguous.locationId,undefined);assert.equal(ambiguous.locationAmbiguous,true);
 assert.equal(c.parseVoice('Deux portions de soupe dans Congélateur au sous-sol',s.locations).locationId,'basement');
});
test('all metadata and quantity can be edited without overwriting a concurrent take',()=>{
 let s=fixture();const payload={id:'meal',name:'Soupe maison',emoji:'art:soup',people:4,comments:'Sans sel\nAvec des pâtes',preparedAt:'2026-10-26',locationId:'loc',detail:'Boîte',threshold:3,quantity:6,expectedQuantity:2,expectedUnit:'portions'};
 s=perform(s,'maison','meal.edit',payload,'full-edit');assert.equal(s.meals[0].name,'Soupe maison');assert.equal(s.meals[0].quantity,6);assert.equal(s.meals[0].people,4);assert.equal(s.meals[0].emoji,'art:soup');assert.equal(s.meals[0].comments,payload.comments);assert.equal(s.events.at(-1).data.quantityDelta,4);
 const stale={...payload,expectedQuantity:6,quantity:8};s=perform(s,'maison','meal.take',{id:'meal',quantity:1},'concurrent');assert.throws(()=>c.command(s,'maison','meal.edit',stale,'stale-edit',now),/stock a changé/);assert.equal(s.meals[0].quantity,5);
 s=perform(s,'maison','meal.edit',{id:'meal',locationId:'loc',threshold:1,detail:''},'old-client');assert.equal(s.meals[0].comments,payload.comments);assert.equal(s.meals[0].quantity,5);
});
test('meat and new stock keep units and separate preparation dates',()=>{
 let s=fixture();s=perform(s,'maison','meal.add',{name:'Jambon',kind:'meat',unit:'paquets',quantity:3,threshold:1,preparedAt:'2026-10-27',locationId:'loc',emoji:'art:ham',comments:'Pour les croques'},'ham');assert.equal(s.meals[1].kind,'meat');assert.equal(c.unit(s.meals[1]),'paquets');
 s=perform(s,'maison','meal.add',{name:'Lasagnes',quantity:4,threshold:1,preparedAt:'2026-10-26',locationId:'loc'},'new-batch');assert.equal(s.meals[0].quantity,2);assert.equal(s.meals[2].quantity,4);assert.equal(s.meals[0].preparedAt,'2026-10-27');assert.equal(s.meals[2].preparedAt,'2026-10-26');
 assert.throws(()=>c.command(s,'maison','meal.edit',{id:'ham',locationId:'loc',threshold:1,people:0},'bad-people',now));
});
test('undo converts weights after a unit change and cannot exceed the stock limit',()=>{
 let s=fixture();s=perform(s,'maison','meal.add',{name:'Carottes',kind:'vegetable',unit:'kg',quantity:2,threshold:0.5,preparedAt:'2026-10-27',locationId:'loc'},'veg');s=perform(s,'maison','meal.take',{id:'veg',quantity:0.5},'take-veg');s=perform(s,'maison','meal.edit',{id:'veg',locationId:'loc',unit:'g',quantity:1500,expectedQuantity:1.5,expectedUnit:'kg',threshold:500},'change-unit');s=perform(s,'maison','meal.undo',{eventId:'take-veg'},'undo-g');assert.equal(s.meals[1].quantity,2000);
 let r=fixture();r=perform(r,'maison','meal.take',{id:'meal',quantity:1},'take');r=perform(r,'maison','meal.edit',{id:'meal',locationId:'loc',quantity:999,expectedQuantity:1,expectedUnit:'portions',threshold:1},'correct');assert.throws(()=>c.command(r,'maison','meal.undo',{eventId:'take'},'overflow',now));
});
