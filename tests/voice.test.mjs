import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('  function voiceStatus('),app.indexOf('  function take('));
function setup(available=true){const nodes={'#transcript':{},'#voiceText':{}},created=[],calls=[],timers=[];const button={innerHTML:'Dicter',id:'dictateMeal',setAttribute(){},removeAttribute(){}};class Recognition{constructor(){created.push(this);}start(){this.onstart();}stop(){this.onend();}}
 const context=vm.createContext({window:available?{SpeechRecognition:Recognition}:{},document:{createElement:()=>({setAttribute(){}})},modal:{open:true},body:{prepend:n=>nodes['#'+n.id]=n},$:(s)=>nodes[s],recorder:null,icon:()=>'',toast:m=>calls.push(m),setTimeout:f=>(timers.push(f),timers.length),clearTimeout(){},console});vm.runInContext(source,context);context.dictate(t=>calls.push(t),button);return {context,nodes,created,calls,button,timers};}
function result(text,final){const row=[{transcript:text}];row.isFinal=final;return {results:[row]};}
test('speech shows interim text, fills on final and does not apply twice on end',()=>{const s=setup(),rec=s.created[0];rec.onresult(result('Soupe',false));assert.equal(s.nodes['#voiceText'].value,'Soupe');assert.equal(s.calls.length,0);rec.onresult(result('Soupe de légumes',true));assert.deepEqual(s.calls,['Soupe de légumes']);assert.equal(s.context.recorder,null);assert.equal(s.button.innerHTML,'Dicter');});
test('microphone error is visible inside the modal with usable fallback instructions',()=>{const s=setup();s.created[0].onerror({error:'not-allowed'});assert.match(s.nodes['#voiceStatus'].textContent,/refusé/);assert.match(s.nodes['#voiceStatus'].textContent,/micro du clavier/);assert.equal(s.calls.length,0);assert.equal(s.context.recorder,null);});
test('unsupported recognition and silent timeout explain how to enter dictated text',()=>{const unsupported=setup(false);assert.match(unsupported.nodes['#voiceStatus'].textContent,/pas proposé/);assert.equal(unsupported.created.length,0);const silent=setup();silent.timers[0]();assert.match(silent.nodes['#voiceStatus'].textContent,/sans texte reconnu/);assert.equal(silent.context.recorder,null);});
