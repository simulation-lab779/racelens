import { validateRace } from './engine.mjs';

export function japanDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function catalogDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) throw new Error('開催日が不正です');
}

export function validateCatalog(input, now = new Date()) {
  if (!input || input.schemaVersion !== 1) throw new Error('配信データの形式が未対応です');
  const stamp = Date.parse(input.checkedAt);
  if (typeof input.checkedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(input.checkedAt) || !Number.isFinite(stamp) || stamp > now.getTime()+300000) throw new Error('確認日時が不正、または未来になっています');
  if (!Array.isArray(input.races) || input.races.length > 30 || !Array.isArray(input.schedule) || !input.schedule.length || input.schedule.length > 40) throw new Error('配信レース数が不正です');
  const ids = new Set();
  for (const race of input.races) {
    validateRace(race);
    if (ids.has(race.id) || race.mode!=='upcoming' || race.grade!=='GⅠ') throw new Error('GⅠ配信レースのID・分類が不正です');
    if (!['registered','declared'].includes(race.entryStatus) || !['temporary','official'].includes(race.numberStatus)) throw new Error('出走・枠順の確認状態が必要です');
    if (race.checkedAt!==input.checkedAt || race.ratingAsOf>japanDate(new Date(stamp))) throw new Error('資料公表日・確認日時を確認してください');
    if (race.entryStatus==='declared' && race.horses.some(h=>!h.jockey.trim() || h.jockey==='未確認')) throw new Error('出走確定には騎手の確認が必要です');
    ids.add(race.id);
  }
  const scheduled = new Set();
  for (const item of input.schedule) {
    catalogDate(item.date);
    for(const key of ['id','name','venue']) if(typeof item[key]!=='string'||!item[key].trim()||item[key].length>100) throw new Error('日程が不正です');
    if(scheduled.has(item.id)||!Number.isInteger(item.distance)||item.distance<1000||item.distance>3600) throw new Error('日程の重複・距離を確認してください');
    if (!['http:','https:'].includes(new URL(item.url).protocol)) throw new Error('日程の出典URLが不正です');
    scheduled.add(item.id);
  }
  for(const race of input.races) {
    const item=input.schedule.find(s=>s.id===race.id);
    if(!item || item.date!==race.date || item.name!==race.name || item.distance!==race.distance || item.venue!==race.venue) throw new Error('日程と出走データが一致しません');
  }
  return structuredClone(input);
}

export function nextScheduled(catalog, now = new Date()) {
  const today = japanDate(now);
  return catalog.schedule.filter(r=>r.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]??null;
}

export function defaultRaceId(catalog, historical, now = new Date()) {
  const next=nextScheduled(catalog,now);
  // Never skip an unprepared nearer GⅠ and advertise a later race as "next".
  return catalog.races.find(r=>r.id===next?.id)?.id ?? historical[0].id;
}

export function raceFreshness(race, now = new Date()) {
  if (race.mode==='historical') return {kind:'archive',label:'過去レース',message:'実際の結果と比べられる回顧モードです。'};
  if (race.mode!=='upcoming') return {kind:'custom',label:'利用者の入力',message:'読み込んだデータです。出典と更新日時を確認してください。'};
  const today=japanDate(now), hours=(now-Date.parse(race.checkedAt))/3600000;
  if (race.date<today) return {kind:'expired',label:'開催日を経過',message:'開催前のデータを保存したものです。今週の出馬表ではありません。'};
  if (race.date===today) return {kind:'stale',label:'開催当日・要確認',message:'取消、乗り替わり、馬場をJRAの確定情報で再確認してください。'};
  if (!Number.isFinite(hours)||hours>=24) return {kind:'stale',label:'再確認が必要',message:'確認から24時間以上経過しています。公開データの更新とJRAの出馬表を確認してください。'};
  return {kind:'current',label:race.entryStatus==='registered'?'登録段階・暫定':'出走情報のスナップショット',message:race.numberStatus==='temporary'?'仮IDは画面内の識別用です。馬番・枠番ではありません。':'確認後の取消・乗り替わりは自動反映されません。'};
}

export function runnerLabel(race, number) {
  return race.numberStatus==='temporary'?`仮${String(number).padStart(2,'0')}`:String(number);
}

export function compareCatalog(current, candidate, now = new Date()) {
  const checked=validateCatalog(candidate,now);
  const oldTime=Date.parse(current.checkedAt),newTime=Date.parse(checked.checkedAt);
  if(newTime<oldTime)throw new Error('配信データが現在の版より古いため、更新しませんでした');
  if(newTime===oldTime) {
    if(JSON.stringify(checked)!==JSON.stringify(current))throw new Error('内容が変わっていますが確認日時が同じです。配信側の更新が必要です');
    return null;
  }
  return checked;
}

export async function fetchCatalog(url, fetcher=fetch) {
  const response=await fetcher(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`公開データを取得できませんでした (${response.status})`);
  if(Number(response.headers.get('content-length'))>200000)throw new Error('公開データのサイズが上限を超えています');
  const text=await response.text();
  if(new TextEncoder().encode(text).length>200000)throw new Error('公開データのサイズが上限を超えています');
  return JSON.parse(text);
}
