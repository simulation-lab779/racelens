import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { RACES } from '../src/data/races.mjs';
import { RESULTS } from '../src/data/results.mjs';
import { validateRace,validateSettings,prepareField,simulateRace,runMonteCarlo,progressAt,comparePrediction,settleVirtualTicket } from '../src/engine.mjs';
const clone=()=>structuredClone(RACES[0]);

test('実在2レースの出走馬と結果キーが全頭一致する',()=>{
  for(const race of RACES){validateRace(race);const numbers=race.horses.map(h=>h.number).sort((a,b)=>a-b);assert.deepEqual(RESULTS[race.id].finish.map(([n])=>n).sort((a,b)=>a-b),numbers);assert.ok(race.ratingAsOf<race.date);}
  assert.equal(RACES[0].horses.length,14);assert.equal(RACES[1].horses.length,13);
});
test('同じシードの全試行結果は完全に再現できる',()=>{assert.deepEqual(simulateRace(clone(),{seed:42}),simulateRace(clone(),{seed:42}));assert.deepEqual(runMonteCarlo(clone(),{seed:12,trials:500}),runMonteCarlo(clone(),{seed:12,trials:500}));});
test('シードを変えると別の展開になる',()=>{assert.notDeepEqual(simulateRace(clone(),{seed:1}),simulateRace(clone(),{seed:2}));});
test('未来の着順を追加・変更しても予想は変化しない',()=>{const race=clone(),baseline=runMonteCarlo(race,{trials:100});race.result={winner:14,finish:[14,1,2]};race.horses.forEach(h=>{h.finalPosition=1;h.finalOdds=1.1;});assert.deepEqual(runMonteCarlo(race,{trials:100}).map(h=>[h.number,h.winRate]),baseline.map(h=>[h.number,h.winRate]));});
test('エンジンは結果モジュールをimportしていない',async()=>{assert.doesNotMatch(await readFile(new URL('../src/engine.mjs',import.meta.url),'utf8'),/import.*results/);});
test('1着回数は試行数、3着内回数は試行数×3に一致',()=>{const r=runMonteCarlo(clone(),{trials:1000});assert.equal(r.reduce((s,h)=>s+h.wins,0),1000);assert.equal(r.reduce((s,h)=>s+h.top3,0),3000);assert.ok(Math.abs(r.reduce((s,h)=>s+h.winRate,0)-100)<1e-8);});
test('2頭立てでも全馬の3着内率は100%',()=>{const race=clone();race.horses=race.horses.slice(0,2);assert.ok(runMonteCarlo(race,{trials:100}).every(h=>h.top3Rate===100));});
test('取消で除外した馬は試行に出ない',()=>{const race=clone();race.horses=race.horses.filter(h=>h.number!==3);assert.ok(simulateRace(race).every(h=>h.number!==3));assert.equal(simulateRace(race).length,13);});
test('不明なレーティングを明示して中央値で仮置きし分散を広げる',()=>{const f=prepareField(clone());const missing=f.find(h=>h.number===11);assert.equal(missing.imputed,true);assert.equal(missing.base,119);assert.ok(missing.sigma>f[0].sigma);});
test('今年と前年の混合を手計算と照合',()=>{const f=prepareField(RACES[1]);assert.equal(f.find(h=>h.number===4).base,115*.65+124*.35);assert.equal(f.find(h=>h.number===8).base,114);});
test('斤量補正の重複加算をしない',()=>{const f=prepareField(clone());assert.equal(f.find(h=>h.number===9).components.weight,8);assert.equal(f.find(h=>h.number===14).components.weight,4);});
test('同一シードなら騎手補正を上げると個別performanceが上がる',()=>{const a=clone(),before=simulateRace(a,{seed:20}).find(h=>h.number===3);a.horses.find(h=>h.number===3).jockeyFit=3;const after=simulateRace(a,{seed:20}).find(h=>h.number===3);assert.ok(Math.abs(after.performance-before.performance-2.1)<1e-8);});
test('ハイペースで追込を相対加点、逃げを相対減点',()=>{const a=clone();a.horses[0].style='leader';const slow=prepareField(a,{pace:-1}),fast=prepareField(a,{pace:1});assert.ok(fast[0].strength<slow[0].strength);assert.ok(fast[2].strength>slow[2].strength);});
test('適性0なら馬場は補正点を捏造しない',()=>{assert.ok(prepareField(clone(),{going:2}).every(h=>h.components.going===0));});
test('道悪適性を入力すると重馬場でのみ補正される',()=>{const a=clone();a.horses[0].wetFit=3;assert.equal(prepareField(a,{going:0})[0].components.going,0);assert.equal(prepareField(a,{going:2})[0].components.going,9);});
test('アニメーションの進行は単調増加で逆走せず全馬ゴール',()=>{for(const runner of simulateRace(clone())){let previous=0;for(let t=0;t<runner.time+1;t+=0.1){const p=progressAt(runner,t);assert.ok(p>=previous-1e-12);assert.ok(p>=0&&p<=1);previous=p;}assert.equal(progressAt(runner,runner.time),1);}});
test('描画のゴール時刻とモデル着順が一致',()=>{const r=simulateRace(clone());for(let i=0;i<r.length-1;i++){assert.ok(r[i].time<=r[i+1].time);assert.equal(progressAt(r[i],r[i].time),1);assert.ok(progressAt(r[i+1],r[i].time)<1);}});
test('ジャパンカップの2着同着を壊さず比較',()=>{const a=RESULTS['japan-cup-2024'];assert.equal(new Map(a.finish).get(7),2);assert.equal(new Map(a.finish).get(10),2);const p=runMonteCarlo(clone(),{trials:100});assert.equal(comparePrediction(p,a,10).selectedRank,2);});
test('同着の両方の馬連払戻を正しく精算',()=>{const a=RESULTS['japan-cup-2024'];assert.equal(settleVirtualTicket(a,'pair',[7,3],100).payout,1510);assert.equal(settleVirtualTicket(a,'pair',[3,10],200).payout,2300);assert.equal(settleVirtualTicket(a,'pair',[7,10],100).payout,0);assert.equal(settleVirtualTicket(a,'win',[3],100).payout,230);});
test('存在しない馬番・重複馬番・範囲外金額を精算しない',()=>{const a=RESULTS['japan-cup-2024'];for(const numbers of [[3,3],[3,18]])assert.throws(()=>settleVirtualTicket(a,'pair',numbers,100));assert.throws(()=>settleVirtualTicket(a,'win',[3],150));assert.throws(()=>settleVirtualTicket(a,'win',[3],5100));});
test('入力を変更しない純粋関数',()=>{const a=clone(),before=structuredClone(a);runMonteCarlo(a,{trials:100});assert.deepEqual(a,before);});
test('出走馬の配列順が変わっても結果は同じ',()=>{const a=clone(),b=clone();b.horses.reverse();assert.deepEqual(simulateRace(a),simulateRace(b));});
test('馬番重複、範囲外、NaN、結果後の入力、危険なURLを拒否',()=>{const mutations=[r=>r.horses[0].number=2,r=>r.horses[0].rating=Infinity,r=>r.horses[0].wetFit=4,r=>r.horses[0].courseFit=NaN,r=>r.ratingAsOf='2024-11-25',r=>r.sources[0].url='javascript:alert(1)'];for(const mutate of mutations){const a=clone();mutate(a);assert.throws(()=>validateRace(a));}});
test('全頭評価欠損や未対応のダートは実行を拒否',()=>{const a=clone();a.horses.forEach(h=>{h.rating=null;h.priorRating=null;});assert.throws(()=>validateRace(a));const dirt=clone();dirt.surface='ダート';assert.throws(()=>validateRace(dirt));});
test('試行数・シード・ばらつきの境界値検証',()=>{assert.throws(()=>validateSettings({trials:0}));assert.throws(()=>validateSettings({seed:1.5}));assert.throws(()=>validateSettings({noise:NaN}));assert.doesNotThrow(()=>validateSettings({seed:0,trials:10000,noise:0.5}));});
