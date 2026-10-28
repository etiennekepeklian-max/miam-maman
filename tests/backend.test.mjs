import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
function server(){
  const props=new Map(),cache=new Map(),tabs=new Map();let lockDepth=0;
  const headers={Stock:['ID préparation','Plat','Portions','Emplacement','Repère','Préparé le','Seuil','État'],Emplacements:['ID emplacement','Nom'],Journal:['Horodatage','ID opération','Action','Compte','ID objet','Nom','Emplacement','Variation portions','Seuil','Préparé le','Repère','Opération annulée','Données événement'],Comptes:['Compte','Utilisation']};
  function tab(name){const rows=[headers[name].slice()];return {rows,getLastRow:()=>rows.length,getMaxRows:()=>1000,appendRow:r=>{assert.ok(lockDepth>0,'writes require server lock');rows.push(r);},getRange:(r,c,n=1,w=1)=>({getValues:()=>rows.slice(r-1,r-1+n).map(a=>Array.from({length:w},(_,i)=>a[c-1+i]??'')),setValues:values=>values.forEach((a,i)=>{rows[r-1+i]??=[];a.forEach((v,j)=>rows[r-1+i][c-1+j]=v);}),clearContent:()=>rows.splice(r-1,n)})};}
  Object.keys(headers).forEach(n=>tabs.set(n,tab(n)));
  const p={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),setProperties:o=>Object.entries(o).forEach(([k,v])=>props.set(k,v)),deleteProperty:k=>props.delete(k)};
  const c=vm.createContext({Date,Intl,console,Session:{getActiveUser:()=>({getEmail:()=> 'etienne.kepeklian@gmail.com'})},PropertiesService:{getScriptProperties:()=>p},Utilities:{getUuid:()=>crypto.randomUUID(),computeHmacSha256Signature:(v,k)=>[...crypto.createHmac('sha256',k).update(v).digest()],base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url')},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock:()=>lockDepth++,releaseLock:()=>lockDepth--})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>tabs.get(n)}),flush:()=>{}}});
  for(const f of ['src/core.js','google-apps-script/Code.gs'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
  return {c,tabs,props,cache};
}
test('three profiles are selectable without passwords and map to fixed roles',()=>{
  const {c,tabs}=server();
  for(const [profile,role] of [['MLK','maman'],['GK','famille'],['EK','famille']]){
    const r=c.rpc('login',{profile,role:'maman'});assert.equal(r.ok,true);assert.equal(r.profile,profile);assert.equal(r.role,role);assert.equal(r.state.locations.length,0);assert.equal(r.state.meals.length,0);
  }
  assert.deepEqual(tabs.get('Comptes').rows.slice(1).map(row=>row[0]),['MLK','GK','EK']);
  for(const profile of ['unknown','mlk','',null])assert.equal(c.rpc('login',{profile}).ok,false);
});
test('selected family profiles cannot use MLK actions by forging a role',()=>{
  const {c}=server();const mom=c.rpc('login',{profile:'MLK'}),gk=c.rpc('login',{profile:'GK'}),ek=c.rpc('login',{profile:'EK'});
  assert.equal(c.rpc('location.add',{token:mom.token,id:'loc',payload:{name:'Mon emplacement'}}).ok,true);
  for(const user of [gk,ek])assert.equal(c.rpc('location.add',{token:user.token,role:'maman',profile:'MLK',id:'fake'+user.profile,payload:{name:'Forgé'}}).ok,false);
  assert.equal(c.rpc('state',{token:gk.token}).state.locations.length,1);
});
test('consumption is idempotent and history records the selected profile',()=>{
  const {c,tabs}=server();const mom=c.rpc('login',{profile:'MLK'}),fam=c.rpc('login',{profile:'GK'});
  c.rpc('location.add',{token:mom.token,id:'loc',payload:{name:'Notre coin'}});
  c.rpc('meal.add',{token:mom.token,id:'meal',payload:{name:'Soupe',quantity:1,threshold:1,preparedAt:'2026-10-27',locationId:'loc'}});
  const take={token:fam.token,id:'take1',payload:{id:'meal',quantity:1}};
  assert.equal(c.rpc('meal.take',take).state.meals[0].quantity,0);assert.equal(c.rpc('meal.take',take).ok,true);
  assert.equal(c.rpc('meal.take',{...take,id:'take2'}).ok,false);assert.equal(tabs.get('Journal').rows.length,4);
  assert.equal(tabs.get('Journal').rows[3][3],'GK');assert.equal(tabs.get('Journal').rows[3][5],'Soupe');assert.equal(tabs.get('Journal').rows[3][7],-1);
});
test('GK and EK only undo their own new takes',()=>{
  const {c}=server();const mom=c.rpc('login',{profile:'MLK'}),gk=c.rpc('login',{profile:'GK'}),ek=c.rpc('login',{profile:'EK'});
  c.rpc('location.add',{token:mom.token,id:'loc',payload:{name:'Chez nous'}});
  c.rpc('meal.add',{token:mom.token,id:'meal',payload:{name:'Gratin',quantity:2,threshold:1,preparedAt:'2026-10-27',locationId:'loc'}});
  c.rpc('meal.take',{token:gk.token,id:'take',payload:{id:'meal',quantity:1}});
  assert.equal(c.rpc('meal.undo',{token:ek.token,id:'undo-ek',payload:{eventId:'take'}}).ok,false);
  assert.equal(c.rpc('meal.undo',{token:gk.token,id:'undo-gk',payload:{eventId:'take'}}).state.meals[0].quantity,2);
});
test('expired sessions never mutate and can be renewed by selecting a profile',()=>{
  const {c,cache}=server();const user=c.rpc('login',{profile:'MLK'});cache.clear();
  const expired=c.rpc('location.add',{token:user.token,id:'fake',payload:{name:'No'}});
  assert.equal(expired.ok,false);assert.equal(expired.code,'PROFILE_SESSION_EXPIRED');
  assert.equal(c.rpc('login',{profile:'MLK'}).state.locations.length,0);
});
test('individual alert threshold survives server editing without changing quantity',()=>{
  const {c}=server();const user=c.rpc('login',{profile:'MLK'});
  c.rpc('location.add',{token:user.token,id:'loc',payload:{name:'Mon coin'}});
  c.rpc('meal.add',{token:user.token,id:'meal',payload:{name:'Ratatouille',quantity:5,threshold:2,preparedAt:'2026-10-27',locationId:'loc'}});
  const edited=c.rpc('meal.edit',{token:user.token,id:'edit',payload:{id:'meal',locationId:'loc',detail:'',threshold:4}});
  assert.equal(edited.ok,true);assert.equal(edited.state.meals[0].threshold,4);assert.equal(edited.state.meals[0].quantity,5);
});
