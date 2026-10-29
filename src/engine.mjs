// Deterministic domain functions: no DOM, network, storage, or outcome lookup.
export const STYLES = { neutral: '未設定', leader: '逃げ', stalker: '先行', middle: '差し', closer: '追込' };
export const DEFAULT_SETTINGS = { pace: 0, going: 0, noise: 1, seed: 20241124, trials: 2000 };
export const MODEL_VERSION = '0.3.0';
const STYLE_POSITION = { neutral: 0, leader: 1, stalker: 0.55, middle: -0.25, closer: -1 };

function bounded(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name}は${min}〜${max}の数値で指定してください`);
  }
  return value;
}

export function validateRace(input) {
  if (!input || typeof input !== 'object') throw new Error('レース形式が不正です');
  for (const key of ['id','name','venue','date','ratingAsOf']) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 100) throw new Error(`${key}が不正です`);
  }
  for (const key of ['date','ratingAsOf']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input[key]) || new Date(input[key]).toISOString().slice(0,10) !== input[key]) throw new Error(`${key}の日付が不正です`);
  }
  if (input.ratingAsOf > input.date) throw new Error('レース後のレーティングは予想入力に使えません');
  if (input.surface !== '芝') throw new Error('この初期モデルは芝レースのみを対象とします');
  bounded(input.distance, '距離', 1000, 3600);
  if (!['left','right'].includes(input.direction)) throw new Error('directionはleftかrightです');
  if (input.numberStatus !== undefined && !['temporary','official'].includes(input.numberStatus)) throw new Error('番号の状態が不正です');
  if (input.entryStatus !== undefined && !['registered','declared'].includes(input.entryStatus)) throw new Error('登録の状態が不正です');
  if (input.entryStatus === 'registered' && input.numberStatus !== 'temporary') throw new Error('登録段階では仮IDを使ってください');
  if (!Array.isArray(input.horses) || input.horses.length < 2 || input.horses.length > 18) throw new Error('出走馬は2〜18頭です');
  if (!Array.isArray(input.sources) || !input.sources.length) throw new Error('出典URLを指定してください');
  input.sources.forEach(s => {
    if (typeof s.label !== 'string' || s.label.length > 150 || !['http:','https:'].includes(new URL(s.url).protocol)) throw new Error('出典が不正です');
  });
  const numbers = new Set();
  input.horses.forEach(h => {
    bounded(h.number,'馬番',1,18);
    if (!Number.isInteger(h.number) || numbers.has(h.number)) throw new Error('馬番は重複しない整数にしてください');
    numbers.add(h.number);
    if (typeof h.name !== 'string' || !h.name.trim() || h.name.length > 45) throw new Error('馬名が不正です');
    if (typeof h.jockey !== 'string' || h.jockey.length > 60) throw new Error('騎手名が不正です');
    if (input.numberStatus === 'temporary') {
      if (h.frame !== null) throw new Error('仮IDの段階では枠をnullにしてください');
    } else {
      bounded(h.frame,'枠',1,8);
      if (!Number.isInteger(h.frame)) throw new Error('枠は整数です');
    }
    bounded(h.weight,'斤量',40,70);
    for (const key of ['rating','priorRating']) if (h[key] !== null) bounded(h[key],key,60,150);
    if (!Object.hasOwn(STYLES,h.style)) throw new Error('脚質の設定が不正です');
    bounded(h.courseFit,'コース補正',-5,5);
    bounded(h.wetFit,'道悪補正',-3,3);
    bounded(h.jockeyFit,'騎手補正',-3,3);
  });
  if (input.horses.every(h => h.rating === null && h.priorRating === null)) throw new Error('少なくとも1頭のレーティングが必要です');
  return structuredClone(input);
}

export function validateSettings(input) {
  const s = { ...DEFAULT_SETTINGS, ...input };
  bounded(s.pace,'ペース',-1,1);
  bounded(s.going,'馬場',0,2);
  bounded(s.noise,'ばらつき',0.5,2);
  bounded(s.seed,'乱数シード',0,4294967295);
  bounded(s.trials,'試行数',100,10000);
  if (!Number.isInteger(s.seed) || !Number.isInteger(s.trials)) throw new Error('シードと試行数は整数です');
  return s;
}

export function makeRandom(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return ((state >>> 0) + 0.5) / 4294967296;
  };
}

function normal(random) {
  return Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
}

function knownRating(h) {
  if (h.rating !== null && h.priorRating !== null) return h.rating * 0.65 + h.priorRating * 0.35;
  return h.rating ?? h.priorRating;
}

export function prepareField(race, settings = {}) {
  const checked = validateRace(race);
  const s = validateSettings(settings);
  const known = checked.horses.map(knownRating).filter(n=>n!==null).sort((a,b)=>a-b);
  const middle = Math.floor(known.length/2);
  const median = known.length%2 ? known[middle] : (known[middle-1]+known[middle])/2;
  return checked.horses.slice().sort((a,b)=>a.number-b.number).map(h => {
    const original = knownRating(h);
    const imputed = original === null;
    const base = original ?? median;
    const components = {
      base, weight: (58-h.weight)*2, course: h.courseFit*1.3,
      jockey: h.jockeyFit*0.7, pace: -STYLE_POSITION[h.style]*s.pace*3,
      going: h.wetFit*s.going*1.5
    };
    const strength = Object.values(components).reduce((a,b)=>a+b,0);
    return { ...h, base, strength, imputed, components,
      sigma: (imputed ? 7 : 4.5)*s.noise*(1+s.going*0.12) };
  });
}

function drawPrepared(race, field, s, random) {
  const raceShock = normal(random)*0.8;
  const runners = field.map(h => {
    const performance = h.strength + normal(random)*h.sigma - STYLE_POSITION[h.style]*raceShock;
    // Time is illustrative. It does not use the actual finishing time of this race.
    const time = race.distance/16.5 + s.going*3 + Math.abs(s.pace)*0.5 - (performance-115)*0.13;
    return { number:h.number, name:h.name, frame:h.frame, style:h.style,
      performance, time:Math.max(20,time), startDelay:random()*0.35,
      trajectoryA:(random()-0.5)*0.07,trajectoryB:(random()-0.5)*0.03 };
  });
  runners.sort((a,b)=>a.time-b.time || a.number-b.number);
  return runners.map((h,i)=>({...h,rank:i+1}));
}

export function simulateRace(race, settings = {}, seed) {
  const s = validateSettings(settings);
  const field = prepareField(race,s);
  return drawPrepared(race,field,s,makeRandom(seed ?? s.seed));
}

export function runMonteCarlo(race, settings = {}) {
  const s = validateSettings(settings), field = prepareField(race,s), random = makeRandom(s.seed);
  const tally = new Map(field.map(h=>[h.number,{...h,wins:0,top3:0,rankTotal:0}]));
  for(let i=0;i<s.trials;i++) {
    for(const h of drawPrepared(race,field,s,random)) {
      const t = tally.get(h.number);
      if(h.rank===1)t.wins++;
      if(h.rank<=3)t.top3++;
      t.rankTotal+=h.rank;
    }
  }
  return [...tally.values()].map(h=>{
    const p=h.wins/s.trials;
    return {...h,winRate:p*100,top3Rate:h.top3/s.trials*100,meanRank:h.rankTotal/s.trials,
      mcError:1.96*Math.sqrt(p*(1-p)/s.trials)*100};
  }).sort((a,b)=>b.wins-a.wins || a.meanRank-b.meanRank || a.number-b.number);
}

// A monotone progress curve. Animation and displayed finish order use the same draw.
export function progressAt(runner, seconds) {
  if(seconds<=runner.startDelay)return 0;
  if(seconds>=runner.time)return 1;
  const p=(seconds-runner.startDelay)/(runner.time-runner.startDelay);
  // Small, seeded mid-race variations create overtaking even with unknown style.
  // Derivative stays positive (>0.6); both terms vanish at start and finish.
  return p + (STYLE_POSITION[runner.style]*0.06+(runner.trajectoryA??0))*Math.sin(Math.PI*p)
    + (runner.trajectoryB??0)*Math.sin(2*Math.PI*p);
}

export function comparePrediction(prediction, answer, selectedNumber) {
  const ranks = new Map(answer.finish);
  const winners = answer.finish.filter(([,rank])=>rank===1).map(([n])=>n);
  return { topHit:winners.includes(prediction[0]?.number), selectedRank:ranks.get(selectedNumber)??null,
    winnerModelRate:prediction.filter(h=>winners.includes(h.number)).reduce((sum,h)=>sum+h.winRate,0),
    rows:prediction.map((h,i)=>({number:h.number,predictedRank:i+1,actualRank:ranks.get(h.number)??null})) };
}

export function settleVirtualTicket(answer, type, numbers, stake) {
  bounded(stake,'仮想金額',100,5000);
  if(stake%100!==0)throw new Error('仮想金額は100円単位です');
  if(!['win','pair'].includes(type))throw new Error('券種が不正です');
  const allowed = new Set(answer.finish.map(([number])=>number));
  if(!Array.isArray(numbers) || numbers.length!==(type==='win'?1:2) || new Set(numbers).size!==numbers.length || numbers.some(n=>!allowed.has(n)))throw new Error('買い目の馬番が不正です');
  const key=numbers.slice().sort((a,b)=>a-b).join('-');
  const unit=(type==='win'?answer.winPayout:answer.pairPayout)[key]??0;
  return {stake,payout:unit*stake/100,profit:unit*stake/100-stake};
}
