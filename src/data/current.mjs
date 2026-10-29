// Official facts checked at the timestamp below. No actual results or final odds.
// number is a temporary display ID in alphabetical order, NOT a horse number.
const checkedAt = '2026-10-29T11:35:00+09:00';
const registered = [
  ['エルトンバローズ',58,111],
  ['クロワデュノール',58,122],
  ['コスモキュランダ',58,118],
  ['サクラファレル',58,112],
  ['シェイクユアハート',58,117],
  ['シャンパンカラー',58,113],
  ['ジュンブロッサム',58,107],
  ['ジョバンニ',58,116],
  ['セイウンハーデス',58,116],
  ['タガノデュード',58,117],
  ['ダノンデサイル',58,118],
  ['ネブラディスク',58,null],
  ['ホウオウビスケッツ',58,114],
  ['マスカレードボール',58,122],
  ['リアライズシリウス',56,117],
  ['レガレイラ',56,104],
  ['レディネス',58,112]
];

export const CURRENT_CATALOG = {
  schemaVersion: 1, checkedAt,
  races: [{
    id: 'tenno-sho-autumn-2026', name: '天皇賞（秋）', grade: 'GⅠ',
    date: '2026-11-01', venue: '東京', distance: 2000, direction: 'left', surface: '芝',
    officialGoing: null, ratingAsOf: '2026-10-26', checkedAt,
    mode: 'upcoming', entryStatus: 'registered', numberStatus: 'temporary', verified: true,
    sources: [
      {label:'JRA・天皇賞（秋） 出馬表（確認時は公開前）',url:'https://www.jra.go.jp/keiba/g1/akiten/syutsuba.html',kind:'card'},
      {label:'JRA・2026年10月26日 プレレーティング / 登録17頭',url:'https://www.jra.go.jp/datafile/ranking/g1/2026/akiten.html',kind:'prerace'},
      {label:'JRA・天皇賞（秋） レース条件',url:'https://www.jra.go.jp/keiba/g1/akiten.html',kind:'schedule'}
    ],
    horses: registered.map(([name,weight,rating],index)=>({
      number:index+1,frame:null,name,jockey:'未確認',weight,rating,priorRating:null,
      style:'neutral',courseFit:0,wetFit:0,jockeyFit:0
    }))
  }],
  schedule: [
    {id:'tenno-sho-autumn-2026',name:'天皇賞（秋）',date:'2026-11-01',venue:'東京',distance:2000,url:'https://www.jra.go.jp/keiba/g1/akiten.html'},
    {id:'queen-elizabeth-2026',name:'エリザベス女王杯',date:'2026-11-15',venue:'京都',distance:2200,url:'https://www.jra.go.jp/keiba/tokubetsu/'},
    {id:'mile-championship-2026',name:'マイルチャンピオンシップ',date:'2026-11-22',venue:'京都',distance:1600,url:'https://www.jra.go.jp/keiba/tokubetsu/'},
    {id:'japan-cup-2026',name:'ジャパンカップ',date:'2026-11-29',venue:'東京',distance:2400,url:'https://www.jra.go.jp/keiba/tokubetsu/'}
  ]
};
