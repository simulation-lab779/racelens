// Integration smoke test with an in-memory DOM double, NOT a real browser test.
// Checks the actual app wiring, snapshot preservation, and state transitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function boot() {
  const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
  const nodes=new Map(),listeners=new Map(),storage=new Map();
  function element(id) {
    return {id,value:'',textContent:'',hidden:false,disabled:false,dataset:{},
      classList:{add(){},remove(){},toggle(){}},setAttribute(){},remove(){},append(){},click(){},
      listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},
      set innerHTML(value){this.html=value;for(const m of value.matchAll(/\bid="([^"]+)"/g))if(!nodes.has(m[1]))nodes.set(m[1],element(m[1]));},
      get innerHTML(){return this.html??'';},
      getContext(){return new Proxy({},{get:(_t,key)=>key==='measureText'?()=>({width:50}):()=>{},set:()=>true});},
      getBoundingClientRect(){return {width:1000,height:510};}
    };
  }
  for(const m of html.matchAll(/\bid="([^"]+)"/g)){
    assert.ok(!nodes.has(m[1]),`Duplicate element ID: ${m[1]}`);nodes.set(m[1],element(m[1]));
  }
  const document={getElementById(id){assert.ok(nodes.has(id),`Missing UI element: ${id}`);return nodes.get(id);},
    addEventListener(name,fn){listeners.set(name,fn);},querySelectorAll(){return [];},createElement(){return element('created');},body:{append(){}}};
  const files=['engine.mjs','catalog.mjs','data/current.mjs','data/races.mjs','data/results.mjs','track.mjs','app.mjs'];
  const code=(await Promise.all(files.map(f=>readFile(new URL('../src/'+f,import.meta.url),'utf8')))).map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const execute=new AsyncFunction('document','window','localStorage','location','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia','setTimeout','clearTimeout',code);
  await execute(document,{devicePixelRatio:1,scrollTo(){}},{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    {protocol:'file:'},class{observe(){}},()=>1,()=>{},()=>({matches:true}),()=>1,()=>{});
  return {nodes,storage,async select(id){await listeners.get('click')({target:{closest:()=>({dataset:{race:id}})}});}};
}

test('実アプリの起動・当年GⅠ・観戦ゴール・ノート・過去結果がつながる',async()=>{
  const app=await boot(),el=id=>app.nodes.get(id);
  // Select explicitly; the default selection intentionally depends on today's date.
  await app.select('tenno-sho-autumn-2026');
  assert.match(el('forecast-rows').innerHTML,/クロワデュノール/);
  assert.match(el('forecast-rows').innerHTML,/仮02/);
  assert.equal(el('number-heading').textContent,'仮ID / 馬名・騎手');
  assert.equal(el('reveal').disabled,true);
  await el('play').onclick();
  assert.equal(el('simulation-finish').hidden,false);
  assert.match(el('simulation-finish').innerHTML,/今回の仮想着順/);
  await el('save-note').onclick();
  const saved=JSON.parse(app.storage.get('racelens.replay.v2'));
  assert.equal(saved.notes.length,1);assert.equal(saved.notes[0].race.horses.length,17);
  assert.equal(saved.notes[0].modelVersion,'0.3.0');assert.equal(saved.notes[0].afterReveal,false);
  await app.select('japan-cup-2024');
  assert.equal(el('simulation-finish').hidden,true);
  assert.equal(el('reveal').disabled,false);
  await el('reveal').onclick();
  assert.match(el('actual-result').innerHTML,/ドウデュース/);
  assert.match(el('actual-result').innerHTML,/同着/);
  assert.equal(el('actual-result').hidden,false);
  assert.equal(saved.notes[0].race.id,'tenno-sho-autumn-2026');
});

test('画面の脚質変更から再計算すると仮説を保存できる',async()=>{
  const app=await boot(),el=id=>app.nodes.get(id);
  await app.select('tenno-sho-autumn-2026');
  el('forecast-rows').listeners.get('change')({target:{dataset:{field:'style',number:'2'},value:'leader'}});
  assert.equal(el('scrubber').disabled,true);
  el('pace').value='1';await el('calculate').onclick();
  assert.equal(el('scrubber').disabled,false);
  await el('save-note').onclick();
  const n=JSON.parse(app.storage.get('racelens.replay.v2')).notes[0];
  assert.equal(n.race.horses.find(h=>h.number===2).style,'leader');
  assert.equal(n.settings.pace,1);
});
