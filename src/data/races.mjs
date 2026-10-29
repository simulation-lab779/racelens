// Facts transcribed from the linked JRA pages; no result fields live here.
// style is a model hypothesis, NOT official race data. All fit adjustments start at zero.
function horse(number, frame, name, jockey, weight, rating, priorRating, style) {
  return { number, frame, name, jockey, weight, rating, priorRating,
    style, courseFit: 0, wetFit: 0, jockeyFit: 0 };
}

export const RACES = [
  {
    id: 'japan-cup-2024', name: 'ジャパンカップ', grade: 'GⅠ',
    date: '2024-11-24', venue: '東京', distance: 2400, direction: 'left',
    surface: '芝', officialGoing: '良', ratingAsOf: '2024-11-18',
    mode: 'historical', verified: true, retrievedAt: '2026-10-28',
    sources: [
      { label: 'JRA・出走情報 / 結果', url: 'https://www.jra.go.jp/datafile/seiseki/g1/jc/result/jc2024.html', kind: 'result' },
      { label: 'JRA・レース前レーティング', url: 'https://www.jra.go.jp/datafile/ranking/g1/2024/jc.html', kind: 'prerace' },
      { label: 'JRA・海外馬を含む事前評価', url: 'https://japanracing.jp/en/japancup/news_results/news2024/241118-02.html', kind: 'prerace' }
    ],
    horses: [
      horse(1, 1, 'ゴリアット', 'C.スミヨン', 58, 125, null, 'middle'),
      horse(2, 2, 'ブローザホーン', '菅原明良', 58, 121, null, 'closer'),
      horse(3, 3, 'ドウデュース', '武豊', 58, 122, null, 'closer'),
      horse(4, 3, 'ジャスティンパレス', 'C.デムーロ', 58, 118, null, 'middle'),
      horse(5, 4, 'シュトルーヴェ', '鮫島克駿', 58, 114, null, 'closer'),
      horse(6, 4, 'ダノンベルーガ', '松山弘平', 58, 118, null, 'middle'),
      horse(7, 5, 'シンエンペラー', '坂井瑠星', 56, 120, null, 'stalker'),
      horse(8, 5, 'オーギュストロダン', 'R.ムーア', 58, 122, null, 'middle'),
      horse(9, 6, 'チェルヴィニア', 'C.ルメール', 54, 115, null, 'middle'),
      horse(10, 6, 'ドゥレッツァ', 'W.ビュイック', 58, 112, null, 'stalker'),
      horse(11, 7, 'カラテ', '杉原誠人', 58, null, null, 'middle'),
      horse(12, 7, 'ソールオリエンス', '横山武史', 58, 117, null, 'closer'),
      horse(13, 8, 'ファンタスティックムーン', 'R.ピーヒュレク', 58, 120, null, 'closer'),
      horse(14, 8, 'スターズオンアース', '川田将雅', 56, null, null, 'stalker')
    ]
  },
  {
    id: 'takarazuka-2024', name: '宝塚記念', grade: 'GⅠ',
    date: '2024-06-23', venue: '京都', distance: 2200, direction: 'right',
    surface: '芝', officialGoing: '重', ratingAsOf: '2024-06-17',
    mode: 'historical', verified: true, retrievedAt: '2026-10-28',
    sources: [
      { label: 'JRA・出走情報 / 結果', url: 'https://www.jra.go.jp/datafile/seiseki/g1/takara/result/takara2024.html', kind: 'result' },
      { label: 'JRA・レース前レーティング', url: 'https://jra.jp/datafile/ranking/g1/2024/takara.html', kind: 'prerace' }
    ],
    horses: [
      horse(1, 1, 'シュトルーヴェ', 'D.レーン', 58, 114, null, 'closer'),
      horse(2, 2, 'ジャスティンパレス', 'C.ルメール', 58, 118, 121, 'middle'),
      horse(3, 3, 'ベラジオオペラ', '横山和生', 58, 117, 117, 'stalker'),
      horse(4, 4, 'ドウデュース', '武豊', 58, 115, 124, 'closer'),
      horse(5, 4, 'ディープボンド', '幸英明', 58, 114, 117, 'stalker'),
      horse(6, 5, 'ヒートオンビート', '坂井瑠星', 58, null, 113, 'middle'),
      horse(7, 5, 'プラダリア', '池添謙一', 58, 116, 116, 'stalker'),
      horse(8, 6, 'カラテ', '岩田望来', 58, null, 114, 'middle'),
      horse(9, 6, 'ソールオリエンス', '横山武史', 58, 113, 119, 'closer'),
      horse(10, 7, 'ローシャムパーク', '戸崎圭太', 58, 116, 116, 'middle'),
      horse(11, 7, 'ヤマニンサンパ', '団野大成', 58, 108, 101, 'closer'),
      horse(12, 8, 'ブローザホーン', '菅原明良', 58, 115, 107, 'closer'),
      horse(13, 8, 'ルージュエヴァイユ', '川田将雅', 56, 112, 112, 'middle')
    ]
  }
];
