import { RACES } from './data/races.mjs';
import { RESULTS } from './data/results.mjs';
import { STYLES, DEFAULT_SETTINGS, MODEL_VERSION, validateRace, validateSettings, runMonteCarlo, simulateRace, comparePrediction, settleVirtualTicket } from './engine.mjs';
import { RaceTrack, FRAME_COLORS } from './track.mjs';
import { CURRENT_CATALOG } from './data/current.mjs';
import { validateCatalog, nextScheduled, defaultRaceId, raceFreshness, runnerLabel, compareCatalog, fetchCatalog, japanDate } from './catalog.mjs';

const $=id=>document.getElementById(id);
const copy=value=>structuredClone(value);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=value=>new Intl.NumberFormat('ja-JP').format(value);
const storageKey='racelens.replay.v2';
let catalog=validateCatalog(CURRENT_CATALOG),pendingCatalog=null;
const availableRaces=()=>[...catalog.races,...RACES,...(customRace?[customRace]:[])];
let working=copy(RACES[0]);
let settings={...DEFAULT_SETTINGS};
let excluded=new Set(),selected=3,prediction=[],runIndex=0,dirty=false,busy=false;
let lastRace=null,lastSettings=null,lastComment='',toastTimeout,notes=[],seen=new Set();
let customRace=null,answerVisible=false;

try {
  const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(saved?.version===2 && Array.isArray(saved.notes) && saved.notes.length<=100) {
    saved.notes.forEach(n=>{validateRace(n.race);validateSettings(n.settings);});
    notes=saved.notes;
    seen=new Set(Array.isArray(saved.seen)?saved.seen.filter(v=>typeof v==='string'):[]);
  }
} catch { /* Unreadable state does not prevent the app from starting. */ }

function notify(message) {
  clearTimeout(toastTimeout);$('toast').textContent=message;$('toast').classList.add('visible');
  toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),4500);
}

function persist() {
  try {localStorage.setItem(storageKey,JSON.stringify({version:2,notes,seen:[...seen]}));return true;}
  catch {notify('端末に保存できませんでした。JSONで書き出して保管してください。');return false;}
}

function download(name,content,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function numberBadge(h) {
  return `<span class="num ${working.numberStatus==='temporary'?'temporary-num':''}" style="background:${FRAME_COLORS[h.frame]||'#647e73'};color:${[1,5].includes(h.frame)?'#33452d':'white'}">${runnerLabel(working,h.number)}</span>`;
}

function checkedTime(value) {
  return Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',hour12:false})+' JST':'未確認';
}

function renderLatest() {
  const next=nextScheduled(catalog),today=japanDate();
  const ready=catalog.races.find(r=>r.id===next?.id);
  $('latest-title').textContent=next?`${next.date.slice(5).replace('-','/')} ${next.name}`:'次のGⅠデータを待っています';
  $('latest-detail').textContent=next?`${next.venue}・芝${next.distance.toLocaleString()}m / ${ready?'登録データを収録':'出走データはまだ収録していません'}`:'収録した開催日をすべて経過しました。出典を確認して新しいレースを追加できます。';
  $('catalog-time').textContent=`出典確認：${checkedTime(catalog.checkedAt)}`;
  $('open-current').hidden=!ready;$('open-current').dataset.race=ready?.id??'';
  $('schedule').innerHTML=catalog.schedule.filter(r=>r.date>=today).map(r=>`<div class="schedule-item"><span>${escapeHtml(r.date.slice(5).replace('-','/'))}</span><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.venue)} ${r.distance}m</small>${catalog.races.some(x=>x.id===r.id)?`<button class="text-btn" data-race="${escapeHtml(r.id)}">シミュレーション →</button>`:`<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">日程のみ・出典 ↗</a>`}</div>`).join('');
}

function renderDataState() {
  const state=raceFreshness(working);
  $('race-status').className='race-status '+state.kind;
  $('race-status').innerHTML=`<strong>${escapeHtml(state.label)}</strong><span>${escapeHtml(state.message)}</span>`;
  $('number-heading').textContent=working.numberStatus==='temporary'?'仮ID / 馬名・騎手':'馬番 / 馬名・騎手';
  const confirmed=working.verified?(working.entryStatus==='registered'?'登録馬・公表評価を確認済み':'出典のデータを確認済み'):'利用者の入力 / 内容は未検証';
  $('data-state').innerHTML=`<strong>${confirmed}</strong><br>事前評価：${escapeHtml(working.ratingAsOf)}<br>${working.checkedAt?'出典確認：'+escapeHtml(checkedTime(working.checkedAt)):'確認日：'+escapeHtml(working.retrievedAt??'未入力')}<br>${working.numberStatus==='temporary'?'枠順・騎手・馬場：未確認<br>斤量：年齢・性別の規定値<br>':''}<a href="${escapeHtml(working.sources[0].url)}" target="_blank" rel="noopener noreferrer">公式情報・出典を確認 ↗</a>`;
  const hasAnswer=working.mode==='historical' && !!RESULTS[working.id] && working.verified===true;
  $('reveal').disabled=!hasAnswer;
  $('answer-heading').textContent=hasAnswer?'実際の結果と、答え合わせ。':'予想を残して、本番を待とう。';
  $('answer-help').textContent=hasAnswer?'実際の着順・払戻と照合できます。結果は予想計算に使っていません。':'このレースの結果は未収録です。いまの予想をノートへ保存して、条件や本命をあとから振り返れます。';
  $('reveal').textContent=hasAnswer?'実際の結果を開く ↓':'実結果は未収録';
}

function renderSources() {
  $('source-links').innerHTML=[...catalog.races,...RACES].map(r=>`<h3>${escapeHtml(r.name)} (${r.date})</h3><ul>${r.sources.map(s=>`<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label)}</a></li>`).join('')}</ul>`).join('');
}

async function checkForUpdates(automatic=false) {
  const button=$('refresh-data');
  if(pendingCatalog) {
    catalog=pendingCatalog;pendingCatalog=null;
    renderLatest();renderSources();
    await selectRace(defaultRaceId(catalog,RACES));
    button.textContent='公開データの更新を確認 ↻';
    $('update-status').textContent='新しい確認版を反映しました。選択レースの条件を初期値に戻しました。';
    return;
  }
  if(!['http:','https:'].includes(location.protocol)) {
    $('update-status').textContent='ZIP版は同梱したデータで動きます。更新されたZIPを開くか、出典を確認したレースJSONを読み込んでください。';
    return;
  }
  button.disabled=true;
  try {
    const next=compareCatalog(catalog,await fetchCatalog(new URL('./data/current.json',location.href)));
    pendingCatalog=next;
    button.textContent=next?'新しい版を反映（条件を初期化）':'公開データの更新を確認 ↻';
    $('update-status').textContent=next?`${checkedTime(next.checkedAt)}の確認版があります。反映する前に、残したい予想をノートに保存してください。`:'公開データに新しい版はありません。JRAの出馬表・取消情報は出典リンクで確認してください。';
  }catch(error){$('update-status').textContent=`${error.message}。現在のデータを引き続き表示しています。`;}
  finally{button.disabled=false;renderLatest();renderDataState();}
}

function readSettings() {
  return validateSettings({pace:Number($('pace').value),going:Number($('going').value),noise:Number($('noise').value),trials:Number($('trials').value),seed:Number($('seed').value)});
}

function applySettings() {
  for(const key of ['pace','going','noise','trials','seed'])$(key).value=settings[key];
  $('noise-label').textContent=`${settings.noise.toFixed(1)}×`;
}

function activeRace() {
  return validateRace({...working,horses:working.horses.filter(h=>!excluded.has(h.number))});
}

function markDirty() {
  dirty=true;track.pause();$('play').textContent='▶ 再計算して発走';
  $('fresh-state').textContent='変更あり・未計算';$('fresh-state').classList.add('stale');
  $('scrubber').disabled=true;
  $('race-commentary').textContent='設定を変更しました。再計算すると新しい予想に切り替わります。';
  answerVisible=false;$('actual-result').hidden=true;$('reveal').textContent='実際の結果を開く ↓';
}

const track=new RaceTrack($('track'),state=>{
  if(state.progress<1)$('simulation-finish').hidden=true;
  $('scrubber').value=Math.round(state.progress*1000);
  const min=Math.floor(state.seconds/60),sec=Math.floor(state.seconds%60);
  $('play-time').textContent=`${min}:${String(sec).padStart(2,'0')}`;
  $('live-order').innerHTML=state.order.slice(0,5).map((h,i)=>`<span class="live-chip"><small>${i+1}</small>${numberBadge(h)} ${escapeHtml(h.name)}</span>`).join('');
  if(!dirty && state.seconds>0) {
    const leader=state.order[0],remain=Math.max(0,Math.round((1-state.progress)*lastRace.distance));
    const message=state.progress>=1?`${leader.name}が1着でゴール！ これは今回のシミュレーション結果です。`:
      remain<=600?`残り${Math.ceil(remain/100)*100}m。${leader.name}が先頭、最後の直線へ。`:
      `${leader.name}が先頭。あなたの本命は${state.order.findIndex(h=>h.number===selected)+1}番手。`;
    if(message!==lastComment){$('race-commentary').textContent=message;lastComment=message;}
  }
},runners=>{
  $('play').textContent='▶ もう一度見る';
  $('simulation-finish').hidden=false;
  $('simulation-finish').innerHTML=`<div class="finish-caption">SIMULATED FINISH / 今回の仮想着順</div><div class="finish-podium">${runners.slice(0,3).map((h,i)=>`<div><small>${i+1}着</small><strong>${numberBadge(h)} ${escapeHtml(h.name)}</strong></div>`).join('')}</div><p>あなたの本命：${runners.find(h=>h.number===selected)?.rank??'—'}着。同じ条件でも、別の展開では結果が変わります。</p>`;
});

function renderRaceTabs() {
  const all=availableRaces();
  $('race-tabs').innerHTML=all.map(r=>`<button class="race-tab ${r.id===working.id?'active':''}" data-race="${escapeHtml(r.id)}"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.date)} · ${escapeHtml(raceFreshness(r).label)}</small></button>`).join('');
}

function renderPicks() {
  const horses=working.horses.filter(h=>!excluded.has(h.number));
  if(!horses.some(h=>h.number===selected))selected=horses[0]?.number;
  $('pick').innerHTML=horses.map(h=>`<option value="${h.number}" ${h.number===selected?'selected':''}>${runnerLabel(working,h.number)} ${escapeHtml(h.name)}</option>`).join('');
  const horse=working.horses.find(h=>h.number===selected);
  $('selection-label').textContent=horse?`YOUR PICK  ${runnerLabel(working,horse.number)} ${horse.name}`:'応援馬を選択してください';
  track.selected=selected;track.draw();
}

function renderTable() {
  const marks=['◎','○','▲','△','☆'];
  const byNumber=new Map(prediction.map((h,i)=>[h.number,{...h,modelRank:i}]));
  const order=[...new Set([...prediction.map(h=>h.number),...working.horses.map(h=>h.number)])];
  const rows=order.map(number=>working.horses.find(h=>h.number===number)).filter(Boolean);
  $('forecast-rows').innerHTML=rows.map(h=>{
    const off=excluded.has(h.number),p=off?undefined:byNumber.get(h.number);
    return `<tr class="${h.number===selected?'chosen':''} ${off?'excluded':''}"><td class="mark">${p?marks[p.modelRank]??'·':'—'}</td><td><div class="horse">${numberBadge(h)}<button class="horse-link" data-pick="${h.number}"><strong>${escapeHtml(h.name)}</strong><small>${escapeHtml(h.jockey)} / ${h.weight}kg ${p?.imputed?' / 中央値で仮置き':''}</small></button></div></td><td class="rating-value">${h.rating??'—'} <small>/ ${h.priorRating??'—'}</small></td><td>${p?`<div class="probability"><b>${p.winRate.toFixed(1)}<small>%</small></b><small>/ ${p.top3Rate.toFixed(1)}%</small></div><div class="bar"><i style="width:${p.winRate}%"></i></div>`:'除外'}</td><td><select aria-label="${escapeHtml(h.name)}の脚質" class="hypothesis style-input" data-number="${h.number}" data-field="style">${Object.entries(STYLES).map(([value,label])=>`<option value="${value}" ${h.style===value?'selected':''}>${label}</option>`).join('')}</select></td>${['courseFit','wetFit','jockeyFit'].map(key=>`<td><input aria-label="${escapeHtml(h.name)}の${{courseFit:'コース補正',wetFit:'道悪補正',jockeyFit:'騎手補正'}[key]}" class="hypothesis" type="number" min="${key==='courseFit'?-5:-3}" max="${key==='courseFit'?5:3}" step="1" value="${h[key]}" data-number="${h.number}" data-field="${key}"></td>`).join('')}<td><input aria-label="${escapeHtml(h.name)}を除外" class="exclude-input" type="checkbox" data-exclude="${h.number}" ${off?'checked':''}></td></tr>`;
  }).join('');
  const missing=prediction.filter(h=>h.imputed);
  $('missing-note').textContent=missing.length?`公表値なし：${missing.map(h=>h.name).join('・')}。基礎値を中央値で仮置きし、不確実性を広げています。`:'事前レーティングの今年値または前年値を全頭で確認済み。';
}

function renderInsights() {
  const top=prediction[0];
  const values=[['01','モデルの本命',`${escapeHtml(top.name)}<small>${top.winRate.toFixed(1)}% / モデル内1着率</small>`],['02','繰り返しシミュレーション',`${settings.trials.toLocaleString()}<small>回 / seed ${settings.seed}</small>`],['03','実レースの条件',`${escapeHtml(working.venue)}・芝${working.distance.toLocaleString()}m<small>${working.date} / 実際の馬場：${escapeHtml(working.officialGoing||'未確認・シナリオで設定')}</small>`]];
  $('insights').innerHTML=values.map(([icon,label,value])=>`<div class="insight"><span class="insight-icon">${icon}</span><div><div class="insight-label">${label}</div><div class="insight-value">${value}</div></div></div>`).join('');
}

function prepareReplay() {
  const seed=(lastSettings.seed+runIndex)>>>0;
  const draw=simulateRace(lastRace,lastSettings,seed);
  track.load(lastRace,draw,selected);
  $('run-label').textContent=`RUN #${String(runIndex+1).padStart(3,'0')} · ${seed}`;
  $('race-commentary').textContent='準備完了。応援する馬を選んで、発走してください。';
  lastComment='';$('play').textContent='▶ 発走';
}

async function recalculate() {
  if(busy)return false;
  busy=true;$('calculate').disabled=true;$('calculate').textContent='計算中…';track.pause();
  try {
    const nextSettings=readSettings(),race=activeRace();
    // Calculation is synchronous so edits cannot race against a pending snapshot.
    const next=runMonteCarlo(race,nextSettings);
    settings=nextSettings;prediction=next;lastRace=copy(race);lastSettings=copy(settings);
    dirty=false;runIndex=0;
    $('fresh-state').textContent='計算済み';$('fresh-state').classList.remove('stale');$('scrubber').disabled=false;
    renderPicks();renderTable();renderInsights();prepareReplay();
    $('race-meta').textContent=`${working.date} / ${working.venue} ${working.distance}m`;
    renderDataState();
    answerVisible=false;$('actual-result').hidden=true;
    return true;
  } catch(error) {notify(error.message);return false;}
  finally {busy=false;$('calculate').disabled=false;$('calculate').textContent='予想を再計算する ↗';}
}

async function selectRace(id) {
  const race=availableRaces().find(r=>r.id===id);
  if(!race)return;
  working=copy(race);excluded=new Set();selected=working.horses[0].number;
  settings={...DEFAULT_SETTINGS,seed:Number(race.date.replaceAll('-','')),going:race.officialGoing==='重'?2:0};
  applySettings();renderRaceTabs();await recalculate();
}

function navigate(tab) {
  if(!['lab','notes','about'].includes(tab))tab='lab';
  if(tab!=='lab')track.pause();
  for(const key of ['lab','notes','about'])$(key+'-view').hidden=key!==tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab));});
  if(tab==='notes')renderNotes();
  if(tab==='lab')track.draw();
  window.scrollTo(0,0);
}

function renderNotes() {
  $('note-count').textContent=notes.length;
  $('notes-list').innerHTML=notes.length?notes.slice().reverse().map(n=>`<article class="panel note"><div class="note-head"><div><div class="eyebrow">${escapeHtml(new Date(n.savedAt).toLocaleString('ja-JP'))}</div><h2>${escapeHtml(n.race.name)}</h2><p>${escapeHtml(n.race.date)} / ${n.settings.trials}回 / seed ${n.settings.seed}<br>本命：${escapeHtml(n.pickName)} / ${n.afterReveal?'実結果を開いた後の記録':'実結果を開く前の記録'}<br>モデル ${escapeHtml(n.modelVersion)}</p></div><div class="note-actions"><button class="btn light" data-restore="${escapeHtml(n.id)}">条件を復元して再計算</button></div></div></article>`).join(''):'<div class="panel empty"><h2>最初の予想を、残しておこう。</h2><p>レースラボの「この予想を保存」で、<br>入力・条件・シード・モデルの予想をまとめて保存します。</p><button class="btn green" data-tab="lab" style="width:auto">レースラボへ →</button></div>';
}

async function saveNote() {
  if(dirty && !await recalculate())return;
  if(notes.length>=100)return notify('保存は100件までです。まずJSONを書き出してください。');
  const pick=lastRace.horses.find(h=>h.number===selected);
  notes.push({id:crypto.randomUUID(),savedAt:new Date().toISOString(),modelVersion:MODEL_VERSION,race:copy(lastRace),settings:copy(lastSettings),prediction:copy(prediction),pick:selected,pickName:pick.name,afterReveal:seen.has(working.id)});
  renderNotes();if(persist())notify('入力・条件・予想結果をノートに保存しました');
}

async function revealAnswer() {
  if(dirty && !await recalculate())return;
  const answer=RESULTS[working.id];if(!answer || !working.verified || working.mode!=='historical')return;
  if(answerVisible){answerVisible=false;$('actual-result').hidden=true;$('reveal').textContent='実際の結果を開く ↓';return;}
  const all=RACES.find(r=>r.id===working.id).horses;
  const comparison=comparePrediction(prediction,answer,selected);
  const podium=answer.finish.filter(([,rank])=>rank<=3);
  const selectOptions=all.map(h=>`<option value="${h.number}">${h.number} ${escapeHtml(h.name)}</option>`).join('');
  $('actual-result').innerHTML=`<div class="answer-grid"><div><div class="actual-list">${podium.map(([number,rank])=>{const h=all.find(h=>h.number===number);return `<div class="actual-horse"><small>実際の${rank}着${answer.finish.filter(([,r])=>r===rank).length>1?'（同着）':''}</small><strong>${number} ${escapeHtml(h.name)}</strong><span>${escapeHtml(h.jockey)}</span></div>`;}).join('')}</div><div class="answer-summary">あなたの本命は<strong>${comparison.selectedRank}着</strong>。モデル本命は${comparison.topHit?'1着と一致':'1着と不一致'}。<br>実際の勝ち馬のモデル内1着率：${comparison.winnerModelRate.toFixed(1)}%<br>結果を見た後の変更は、事前予想の精度として扱えません。</div></div><div class="ticket"><h3>仮想馬券の答え合わせ</h3><p>実際の払戻を使った計算遊びです。購入・送金は行いません。各入力は1点の仮想計算です。</p><div class="ticket-fields"><select id="ticket-type" aria-label="仮想券種"><option value="win">単勝</option><option value="pair">馬連</option></select><select id="ticket-one" aria-label="仮想買い目1頭目">${selectOptions}</select><select id="ticket-two" aria-label="仮想買い目2頭目" hidden>${selectOptions}</select><input id="ticket-stake" type="number" aria-label="仮想金額" min="100" max="5000" step="100" value="100"></div><button id="settle" class="btn light">仮想精算する</button><div class="ticket-result" id="ticket-result" role="status"></div></div></div>`;
  $('ticket-one').value=String(selected);$('ticket-two').value=String(all.find(h=>h.number!==selected).number);
  $('ticket-type').onchange=()=>{$('ticket-two').hidden=$('ticket-type').value!=='pair';};
  $('settle').onclick=()=>{try{const type=$('ticket-type').value;const nums=[Number($('ticket-one').value)];if(type==='pair')nums.push(Number($('ticket-two').value));const result=settleVirtualTicket(answer,type,nums,Number($('ticket-stake').value));$('ticket-result').textContent=`仮想購入 ${yen(result.stake)}円 → 払戻 ${yen(result.payout)}円 / 収支 ${result.profit>=0?'+':''}${yen(result.profit)}円`;}catch(error){$('ticket-result').textContent=error.message;}};
  answerVisible=true;$('actual-result').hidden=false;$('reveal').textContent='結果を閉じる ↑';seen.add(working.id);persist();
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.tab)navigate(button.dataset.tab);
  if(button.dataset.race)await selectRace(button.dataset.race);
  if(button.dataset.pick){selected=Number(button.dataset.pick);renderPicks();renderTable();}
  if(button.dataset.restore){
    const note=notes.find(n=>n.id===button.dataset.restore);if(!note)return;
    working=copy(note.race);settings=copy(note.settings);selected=note.pick;excluded=new Set();
    if(!availableRaces().some(r=>r.id===working.id))customRace=copy(working);
    applySettings();renderRaceTabs();navigate('lab');await recalculate();
    notify('保存した入力と条件を復元しました');
  }
});

$('forecast-rows').addEventListener('change',event=>{
  const input=event.target;
  if(input.dataset.field){
    const horse=working.horses.find(h=>h.number===Number(input.dataset.number));
    horse[input.dataset.field]=input.dataset.field==='style'?input.value:input.value.trim()===''?NaN:Number(input.value);
    markDirty();
  }
  if(input.dataset.exclude){
    const number=Number(input.dataset.exclude);
    if(input.checked && working.horses.length-excluded.size<=2){input.checked=false;notify('2頭以上を残してください');return;}
    input.checked?excluded.add(number):excluded.delete(number);renderPicks();markDirty();
  }
});
for(const id of ['pace','going','trials','seed'])$(id).addEventListener('change',markDirty);
$('noise').addEventListener('input',()=>{$('noise-label').textContent=Number($('noise').value).toFixed(1)+'×';markDirty();});
$('pick').onchange=()=>{selected=Number($('pick').value);renderPicks();renderTable();};
$('speed').onchange=()=>{track.speed=Number($('speed').value);};
$('calculate').onclick=recalculate;
$('play').onclick=async()=>{
  if(track.running){track.pause();$('play').textContent='▶ 再開';return;}
  if(dirty && !await recalculate())return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){track.seek(1);return;}
  track.play();$('play').textContent='Ⅱ 一時停止';
};
$('rerun').onclick=async()=>{if(dirty && !await recalculate())return;runIndex++;prepareReplay();if(matchMedia('(prefers-reduced-motion: reduce)').matches)track.seek(1);else{track.play();$('play').textContent='Ⅱ 一時停止';}};
$('scrubber').oninput=()=>{track.seek(Number($('scrubber').value)/1000);$('play').textContent=track.done?'▶ もう一度見る':'▶ 再開';};
$('save-note').onclick=saveNote;$('reveal').onclick=revealAnswer;
$('reset-scenario').onclick=()=>selectRace(working.id);
$('export-notes').onclick=()=>download('racelens-notes.json',JSON.stringify({version:2,exportedAt:new Date().toISOString(),notes,seen:[...seen]},null,2));
$('export-race').onclick=()=>{try{const race=activeRace();download(`${race.id}.json`,JSON.stringify(race,null,2));}catch(error){notify(error.message);}};
$('import-race').onclick=()=>$('race-file').click();
$('race-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>200000)throw new Error('JSONは200KB以下にしてください');
    const race=validateRace(JSON.parse(await file.text()));
    // Imported content can never claim bundled verification or acquire an answer key.
    customRace={...race,id:'import-'+Date.now(),verified:false,mode:'custom'};
    await selectRace(customRace.id);notify('レースを読み込みました。出典と数値は利用者が確認してください。');
  } catch(error){notify(error.message);}finally{event.target.value='';}
};
$('export-forecast').onclick=async()=>{
  if(dirty && !await recalculate())return;
  const csvCell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const rows=[['race','seed','number_or_temporary_id','horse','model_win_percent','model_top3_percent','mean_rank','rating_imputed'],...prediction.map(h=>[working.name,settings.seed,runnerLabel(working,h.number),h.name,h.winRate,h.top3Rate,h.meanRank,h.imputed])];
  download('racelens-forecast.csv','\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
};
$('refresh-data').onclick=()=>checkForUpdates();
renderLatest();renderSources();renderNotes();
await selectRace(defaultRaceId(catalog,RACES));
checkForUpdates(true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderLatest();renderDataState();renderRaceTabs();}});
