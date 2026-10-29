import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_CATALOG } from '../src/data/current.mjs';
import { RACES } from '../src/data/races.mjs';
import { RESULTS } from '../src/data/results.mjs';
import { validateRace, prepareField, simulateRace, runMonteCarlo, progressAt } from '../src/engine.mjs';
import { japanDate, validateCatalog, nextScheduled, defaultRaceId, raceFreshness, runnerLabel, compareCatalog, fetchCatalog } from '../src/catalog.mjs';

const at=value=>new Date(value);
const now=at('2026-10-29T12:00:00+09:00');
const clone=()=>structuredClone(CURRENT_CATALOG);
const race=()=>clone().races[0];

test('2026天皇賞秋の実登録17頭・事前評価を収録、結果は持たない',()=>{
  const data=validateCatalog(clone(),now),r=data.races[0];
  assert.equal(r.horses.length,17);assert.equal(r.ratingAsOf,'2026-10-26');
  assert.equal(r.horses.find(h=>h.name==='クロワデュノール').rating,122);
  assert.equal(r.horses.find(h=>h.name==='マスカレードボール').rating,122);
  assert.equal(r.horses.find(h=>h.name==='リアライズシリウス').weight,56);
  assert.equal(r.horses.find(h=>h.name==='レガレイラ').weight,56);
  assert.equal(r.horses.find(h=>h.name==='ネブラディスク').rating,null);
  assert.equal(RESULTS[r.id],undefined);
  assert.ok(r.horses.every(h=>h.frame===null&&h.jockey==='未確認'&&h.style==='neutral'));
});
test('未設定脚質はペースで根拠のない補正をしない',()=>{
  assert.deepEqual(prepareField(race(),{pace:-1}).map(h=>h.strength),prepareField(race(),{pace:1}).map(h=>h.strength));
});
test('仮IDには公式枠色を割り当てず、馬番と区別する',()=>{
  assert.equal(runnerLabel(race(),2),'仮02');assert.equal(runnerLabel(RACES[0],2),'2');
  const r=race();r.horses[0].frame=1;assert.throws(()=>validateRace(r));
});
test('確定出走データは騎手の確認が必要',()=>{
  const c=clone();c.races[0].entryStatus='declared';assert.throws(()=>validateCatalog(c,now));
});
test('公式馬番に切り替えた場合は全枠が必要',()=>{
  const r=race();r.numberStatus='official';r.entryStatus='declared';assert.throws(()=>validateRace(r));
});
test('開催前データでも再現性・率の合計・欠損フラグを維持する',()=>{
  const r=race();assert.deepEqual(simulateRace(r,{seed:99}),simulateRace(r,{seed:99}));
  const p=runMonteCarlo(r,{trials:1000});assert.ok(Math.abs(p.reduce((s,h)=>s+h.winRate,0)-100)<1e-8);
  assert.ok(p.find(h=>h.name==='ネブラディスク').imputed);
});
test('脚質未設定でも道中に変化があり、全馬が逆走せず決めた時刻にゴールする',()=>{
  const runners=simulateRace(race(),{seed:55});
  assert.ok(new Set(runners.map(h=>h.trajectoryA)).size>1);
  for(const h of runners){let last=0;for(let t=0;t<h.time;t+=0.1){const p=progressAt(h,t);assert.ok(p>=last&&p<=1);last=p;}assert.equal(progressAt(h,h.time),1);}
});
test('日本時間の境界で開催日を判定する',()=>{
  assert.equal(japanDate(at('2026-10-31T15:00:00Z')),'2026-11-01');
  assert.equal(japanDate(at('2026-10-31T14:59:59Z')),'2026-10-31');
});
test('次のGⅠは天皇賞秋、初期選択も一致する',()=>{
  assert.equal(nextScheduled(clone(),now).id,'tenno-sho-autumn-2026');
  assert.equal(defaultRaceId(clone(),RACES,now),'tenno-sho-autumn-2026');
});
test('翌週の出走データがなければ過去データを最新扱いしない',()=>{
  const after=at('2026-11-02T00:00:00+09:00');
  assert.equal(nextScheduled(clone(),after).id,'queen-elizabeth-2026');
  assert.equal(defaultRaceId(clone(),RACES,after),RACES[0].id);
  assert.equal(raceFreshness(race(),after).kind,'expired');
});
test('当日・24時間経過・過去レース・ユーザー入力を区別する',()=>{
  assert.equal(raceFreshness(race(),now).kind,'current');
  assert.equal(raceFreshness(race(),at('2026-10-30T11:35:00+09:00')).kind,'stale');
  assert.equal(raceFreshness(race(),at('2026-11-01T00:00:00+09:00')).kind,'stale');
  assert.equal(raceFreshness(RACES[0],now).kind,'archive');
  assert.equal(raceFreshness({...race(),mode:'custom'},now).kind,'custom');
});
test('カレンダーの収録期間終了を検出する',()=>{
  assert.equal(nextScheduled(clone(),at('2026-11-30T00:00:00+09:00')),null);
});
test('未来の確認日時・重複・危険なURL・日程不整合を拒否する',()=>{
  for(const mutate of [c=>c.checkedAt='2099-01-01T00:00:00Z',c=>c.schedule.push(c.schedule[0]),c=>c.races.push(c.races[0]),c=>c.schedule[0].url='javascript:alert(1)',c=>c.schedule[0].date='2026-11-02',c=>c.races[0].checkedAt='2026-10-28T11:35:00+09:00',c=>c.schedule[0].date='2026-02-30']) {
    const c=clone();mutate(c);assert.throws(()=>validateCatalog(c,now));
  }
});
test('同じ配信は変更なし、新しい確認版だけ受け入れる',()=>{
  const c=clone();assert.equal(compareCatalog(c,clone(),now),null);
  const next=clone();next.checkedAt='2026-10-29T11:50:00+09:00';next.races[0].checkedAt=next.checkedAt;
  assert.equal(compareCatalog(c,next,now).checkedAt,next.checkedAt);
  assert.equal(c.checkedAt,CURRENT_CATALOG.checkedAt);
  assert.throws(()=>compareCatalog(next,c,now));
});
test('同じ確認日時で変わったデータは黙って反映しない',()=>{
  const c=clone();c.races[0].horses[0].rating=112;
  assert.throws(()=>compareCatalog(clone(),c,now));
});
test('更新失敗や大きすぎる配信を拒否する',async()=>{
  const original=clone();
  await assert.rejects(fetchCatalog('https://example.invalid/data',async()=>new Response('missing',{status:404})));
  await assert.rejects(fetchCatalog('https://example.invalid/data',async()=>new Response('x'.repeat(200001))));
  await assert.rejects(fetchCatalog('https://example.invalid/data',async()=>new Response('<html>')));
  assert.deepEqual(original,CURRENT_CATALOG);
});
test('更新リクエストはキャッシュを避け、読み込んだJSONを検証できる',async()=>{
  const data=await fetchCatalog('https://example.invalid/data',async(url,options)=>{
    assert.equal(options.cache,'no-store');return new Response(JSON.stringify(clone()));
  });
  assert.deepEqual(validateCatalog(data,now),CURRENT_CATALOG);
});
