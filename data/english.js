// 英単語の問題データ。絵（絵文字）を見て、英語で答える。
// WORDS: [英語, 絵文字, レベル(1〜5), 日本語の意味（答え合わせで読み上げる）, ほかに正解にする言い方]
// レベル1: はじめての単語 / 2: よく知っている身近な単語 / 3: 少し長い単語 / 4: 冒険の単語 / 5: かなり難しい単語
(function (root) {
  'use strict';
  var WORDS = [
    // レベル1
    ['cat', '🐱', 1, 'ねこ'], ['dog', '🐶', 1, 'いぬ'], ['bird', '🐦', 1, 'とり'], ['fish', '🐟', 1, 'さかな'], ['pig', '🐷', 1, 'ぶた'],
    ['cow', '🐮', 1, 'うし'], ['apple', '🍎', 1, 'りんご'], ['banana', '🍌', 1, 'バナナ'], ['red', '🔴', 1, 'あか'], ['blue', '🔵', 1, 'あお'],
    ['green', '🟢', 1, 'みどり'], ['yellow', '🟡', 1, 'きいろ'], ['sun', '☀️', 1, 'たいよう'], ['star', '⭐', 1, 'ほし'], ['moon', '🌙', 1, 'つき'],
    ['car', '🚗', 1, 'くるま'], ['bus', '🚌', 1, 'バス'], ['book', '📖', 1, 'ほん'], ['egg', '🥚', 1, 'たまご'], ['milk', '🥛', 1, 'ぎゅうにゅう'],
    ['hat', '🎩', 1, 'ぼうし'], ['ball', '⚽', 1, 'ボール', ['soccer ball', 'football']], ['tree', '🌳', 1, 'き'], ['flower', '🌸', 1, 'はな'],
    // レベル2
    ['rabbit', '🐰', 2, 'うさぎ'], ['monkey', '🐵', 2, 'さる'], ['lion', '🦁', 2, 'ライオン'], ['tiger', '🐯', 2, 'とら'], ['elephant', '🐘', 2, 'ぞう'],
    ['bear', '🐻', 2, 'くま'], ['horse', '🐴', 2, 'うま'], ['sheep', '🐑', 2, 'ひつじ'], ['frog', '🐸', 2, 'かえる'], ['orange', '🍊', 2, 'オレンジ'],
    ['grapes', '🍇', 2, 'ぶどう'], ['strawberry', '🍓', 2, 'いちご'], ['bread', '🍞', 2, 'パン'], ['cake', '🍰', 2, 'ケーキ'], ['rice', '🍚', 2, 'ごはん'],
    ['water', '💧', 2, 'みず'], ['hand', '✋', 2, 'て'], ['eye', '👁️', 2, 'め'], ['ear', '👂', 2, 'みみ'], ['nose', '👃', 2, 'はな'],
    ['mouth', '👄', 2, 'くち'], ['foot', '🦶', 2, 'あし', ['feet']], ['house', '🏠', 2, 'いえ'], ['train', '🚃', 2, 'でんしゃ'], ['bike', '🚲', 2, 'じてんしゃ'],
    ['rain', '🌧️', 2, 'あめ', ['rainy']], ['snow', '🌨️', 2, 'ゆき', ['snowy']], ['black', '⚫', 2, 'くろ'], ['white', '⚪', 2, 'しろ'], ['purple', '🟣', 2, 'むらさき'],
    // レベル3
    ['penguin', '🐧', 3, 'ペンギン'], ['giraffe', '🦒', 3, 'きりん'], ['dolphin', '🐬', 3, 'いるか'], ['whale', '🐳', 3, 'くじら'], ['snake', '🐍', 3, 'へび'],
    ['turtle', '🐢', 3, 'かめ'], ['butterfly', '🦋', 3, 'ちょうちょ'], ['spider', '🕷️', 3, 'くも'], ['chicken', '🐔', 3, 'にわとり'], ['mouse', '🐭', 3, 'ねずみ'],
    ['carrot', '🥕', 3, 'にんじん'], ['tomato', '🍅', 3, 'トマト'], ['potato', '🥔', 3, 'じゃがいも'], ['corn', '🌽', 3, 'とうもろこし'], ['cheese', '🧀', 3, 'チーズ'],
    ['pizza', '🍕', 3, 'ピザ'], ['ice cream', '🍦', 3, 'アイスクリーム'], ['cookie', '🍪', 3, 'クッキー'], ['chair', '🪑', 3, 'いす'], ['clock', '⏰', 3, 'とけい', ['alarm clock', 'alarm']],
    ['key', '🔑', 3, 'かぎ'], ['umbrella', '☂️', 3, 'かさ'], ['pencil', '✏️', 3, 'えんぴつ'], ['scissors', '✂️', 3, 'はさみ'], ['airplane', '✈️', 3, 'ひこうき'],
    ['boat', '⛵', 3, 'ふね', ['ship', 'sailboat', 'yacht']], ['rocket', '🚀', 3, 'ロケット'], ['rainbow', '🌈', 3, 'にじ'], ['cloud', '☁️', 3, 'くも'], ['fire', '🔥', 3, 'ひ'],
    ['mountain', '⛰️', 3, 'やま'],
    // レベル4
    ['octopus', '🐙', 4, 'たこ'], ['shark', '🦈', 4, 'さめ'], ['crocodile', '🐊', 4, 'わに'], ['kangaroo', '🦘', 4, 'カンガルー'], ['squirrel', '🐿️', 4, 'りす', ['chipmunk']],
    ['owl', '🦉', 4, 'ふくろう'], ['bat', '🦇', 4, 'こうもり'], ['bee', '🐝', 4, 'はち'], ['ant', '🐜', 4, 'あり'], ['mushroom', '🍄', 4, 'きのこ'],
    ['pumpkin', '🎃', 4, 'かぼちゃ', ['jack o lantern']], ['watermelon', '🍉', 4, 'すいか'], ['pineapple', '🍍', 4, 'パイナップル'], ['lemon', '🍋', 4, 'レモン'], ['peach', '🍑', 4, 'もも'],
    ['cherry', '🍒', 4, 'さくらんぼ'], ['onion', '🧅', 4, 'たまねぎ'], ['crown', '👑', 4, 'かんむり'], ['castle', '🏰', 4, 'おしろ'], ['bridge', '🌉', 4, 'はし'],
    ['island', '🏝️', 4, 'しま'], ['volcano', '🌋', 4, 'かざん'], ['ghost', '👻', 4, 'おばけ'], ['robot', '🤖', 4, 'ロボット'], ['dragon', '🐉', 4, 'りゅう'],
    ['sword', '🗡️', 4, 'つるぎ', ['dagger', 'knife']], ['shield', '🛡️', 4, 'たて'], ['candle', '🕯️', 4, 'ろうそく'], ['bell', '🔔', 4, 'ベル'], ['map', '🗺️', 4, 'ちず'],
    // レベル5
    ['telescope', '🔭', 5, 'ぼうえんきょう'], ['microscope', '🔬', 5, 'けんびきょう'], ['helicopter', '🚁', 5, 'ヘリコプター'], ['ambulance', '🚑', 5, 'きゅうきゅうしゃ'], ['tractor', '🚜', 5, 'トラクター'],
    ['skateboard', '🛹', 5, 'スケートボード'], ['parachute', '🪂', 5, 'パラシュート'], ['compass', '🧭', 5, 'コンパス'], ['magnet', '🧲', 5, 'じしゃく'], ['hourglass', '⏳', 5, 'すなどけい', ['sandglass', 'sand timer']],
    ['thermometer', '🌡️', 5, 'おんどけい'], ['tornado', '🌪️', 5, 'たつまき', ['twister']], ['lightning', '⚡', 5, 'かみなり'], ['snowflake', '❄️', 5, 'ゆきのけっしょう'], ['dinosaur', '🦕', 5, 'きょうりゅう'],
    ['unicorn', '🦄', 5, 'ユニコーン'], ['peacock', '🦚', 5, 'くじゃく'], ['flamingo', '🦩', 5, 'フラミンゴ'], ['hedgehog', '🦔', 5, 'はりねずみ'], ['lobster', '🦞', 5, 'ロブスター', ['crayfish']],
    ['scorpion', '🦂', 5, 'さそり'], ['cactus', '🌵', 5, 'サボテン'], ['broccoli', '🥦', 5, 'ブロッコリー'], ['avocado', '🥑', 5, 'アボカド'], ['pretzel', '🥨', 5, 'プレッツェル'],
    ['trophy', '🏆', 5, 'トロフィー'], ['medal', '🏅', 5, 'メダル'], ['anchor', '⚓', 5, 'いかり'], ['guitar', '🎸', 5, 'ギター'], ['violin', '🎻', 5, 'バイオリン'],
    ['trumpet', '🎺', 5, 'トランペット'], ['drum', '🥁', 5, 'たいこ', ['drums']]
  ];
  var MAX_LEVEL = 5;
  var byWord = {};
  WORDS.forEach(function (w) { byWord[w[0]] = { w: w[0], emoji: w[1], lv: w[2], ja: w[3], alts: w[4] || [] }; });
  var ORDER = WORDS.map(function (w) { return w[0]; });

  var api = { WORDS: WORDS, MAX_LEVEL: MAX_LEVEL, byWord: byWord, ORDER: ORDER };
  root.MB = root.MB || {};
  root.MB.english = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
