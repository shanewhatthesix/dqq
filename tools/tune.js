/* =========================================================================
 * 附中·电子斗蛐蛐  伤害公式调参
 *
 * 扫 DMG_K 的组合，用几个硬指标挑最合适的一组：
 *   - 攻击流 vs 防御流 胜率要接近 50%（成正比）
 *   - 1v1 平均 8~12 回合（不能两下就死，也不能打到天荒地老）
 *   - 3v3 平均 ≤ 24 回合，打到回合上限的比例 < 5%
 *   - 同稀有度对战不能出现一家独大
 *
 * 用法：  node tools/tune.js
 * ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
for (const f of ['data.js', 'util.js', 'effect.js', 'balance.js', 'engine.js']) {
  const p = path.join(JS_DIR, f);
  vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}
const DQQ = globalThis.DQQ;
const { util: U, engine: Engine } = DQQ;
const ROSTER = DQQ.PRESET_CRICKETS;

const C = Engine.CONST;

/* --------------------------------------------------------- 测试用配点 */
/* 都卡在合法上限内，总属性一样，只有攻防取向不同 */
const SKILLS = [
  { name: '主攻', element: '规则', power: 55, accuracy: 95, effect: null },
  { name: '副攻', element: '粉笔', power: 45, accuracy: 95, effect: null }
];
function build(name, stats) {
  return {
    name, type: '同学', defenseType: '学霸', rarity: '史诗',
    stats, skills: U.deepClone(SKILLS)
  };
}
/* 关键：HP 和速度完全一样，只把 30 点属性在「攻击」和「防御」之间对调。
 * 这样测出来的胜率就纯粹反映攻防的相对价值，不会被血量或先手优势污染。 */
const ATK_BUILD = build('攻击流', { hp: 90, attack: 70, defense: 40, speed: 70 });
const DEF_BUILD = build('防御流', { hp: 90, attack: 40, defense: 70, speed: 70 });

/* ------------------------------------------------------------- 指标 */
function measure(iter) {
  const out = {};

  // 1) 攻击流 vs 防御流
  let aw = 0, dw = 0, dr = 0;
  for (let i = 0; i < iter; i++) {
    const r = Engine.runAuto([U.deepClone(ATK_BUILD)], [U.deepClone(DEF_BUILD)], {});
    if (r.winner === 'A') aw++; else if (r.winner === 'B') dw++; else dr++;
  }
  out.atkWin = aw / iter;

  // 2) 随机 1v1 的节奏
  let turns = [], capHits = 0, hits = [], twoShot = 0;
  for (let i = 0; i < iter; i++) {
    const A = U.deepClone(U.pick(ROSTER));
    const Bc = U.deepClone(U.pick(ROSTER));
    const r = Engine.runAuto([A], [Bc], {});
    turns.push(r.turns);
    if (r.reason.indexOf('上限') >= 0) capHits++;
    const dealt = {};
    r.events.forEach(e => { if (e.type === 'damage') dealt[e.side] = (dealt[e.side] || 0) + 1; });
    const w = r.winner === 'A' ? dealt.A : dealt.B;
    if (w) { hits.push(w); if (w <= 2) twoShot++; }
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  out.turns1v1 = avg(turns);
  out.capRate = capHits / iter;
  out.avgHits = avg(hits);
  out.twoShot = twoShot / iter;

  // 3) 3v3 节奏
  let t3 = [];
  for (let i = 0; i < Math.floor(iter / 3); i++) {
    const r = Engine.runAuto(
      U.shuffle(ROSTER).slice(0, 3).map(c => U.deepClone(c)),
      U.shuffle(ROSTER).slice(0, 3).map(c => U.deepClone(c)), {});
    t3.push(r.turns);
  }
  out.turns3v3 = avg(t3);

  // 4) 同稀有度循环赛的极差（越小越公平）
  let spread = 0, groups = 0;
  for (const rar of DQQ.RARITIES) {
    const g = ROSTER.filter(c => c.rarity === rar);
    if (g.length < 2) continue;
    const rec = g.map(() => 0);
    let n = 0;
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        for (let k = 0; k < 40; k++) {
          const first = k % 2 === 0;
          const A = U.deepClone(first ? g[i] : g[j]);
          const Bc = U.deepClone(first ? g[j] : g[i]);
          const r = Engine.runAuto([A], [Bc], {});
          if (r.winner === null) continue;
          const iWon = (r.winner === 'A') === first;
          if (iWon) rec[i]++; else rec[j]++;
          n++;
        }
      }
    }
    const rates = rec.map(w => w / Math.max(1, n / g.length));
    spread += Math.max(...rates) - Math.min(...rates);
    groups++;
  }
  out.raritySpread = spread / Math.max(1, groups);

  return out;
}

/* --------------------------------------------------------------- 扫描 */
const DMG_KS = [40, 50, 60, 70, 85, 100];
const CAPS = [0.45];
const ITER = parseInt(process.argv[2], 10) || 400;

console.log('扫描 DMG_K × 单次伤害上限  (每组 %d 场)', ITER);
console.log('='.repeat(96));
console.log('DMG_K   上限   攻击流胜率   1v1回合   3v3回合   上限局   平均几下  两下秒   同稀有度极差');
console.log('-'.repeat(96));

const results = [];
for (const k of DMG_KS) {
  for (const s of CAPS) {
    C.DMG_K = k;
    C.MAX_HIT_RATIO = s;
    const m = measure(ITER);

    // 打分：离理想值越远扣分越多
    let score = 0;
    score += Math.abs(m.atkWin - 0.5) * 260;          // 攻防要成正比
    score += Math.abs(m.turns1v1 - 10) * 3.2;         // 1v1 理想 10 回合
    score += Math.max(0, m.turns3v3 - 24) * 4;        // 3v3 别超过 24 回合
    score += m.capRate * 300;                          // 打不完的比例
    score += Math.max(0, 4 - m.avgHits) * 25;         // 平均至少 4 下
    score += m.twoShot * 400;                          // 两下秒掉
    score += m.raritySpread * 30;                      // 同稀有度公平性

    results.push({ k, s, m, score });
    console.log(
      String(k).padStart(4) + '  ' +
      String(s).padStart(4) + '   ' +
      (m.atkWin * 100).toFixed(1).padStart(9) + '%   ' +
      m.turns1v1.toFixed(1).padStart(6) + '   ' +
      m.turns3v3.toFixed(1).padStart(6) + '   ' +
      (m.capRate * 100).toFixed(1).padStart(5) + '%   ' +
      m.avgHits.toFixed(1).padStart(7) + '   ' +
      (m.twoShot * 100).toFixed(1).padStart(5) + '%   ' +
      m.raritySpread.toFixed(2).padStart(10) +
      '   ' + score.toFixed(1)
    );
  }
}

results.sort((a, b) => a.score - b.score);
console.log('\n最合适的三组：');
results.slice(0, 3).forEach((r, i) => {
  console.log(`  ${i + 1}. DMG_K=${r.k}   攻击流胜率 ${(r.m.atkWin * 100).toFixed(1)}%` +
    `  1v1 ${r.m.turns1v1.toFixed(1)} 回合  3v3 ${r.m.turns3v3.toFixed(1)} 回合` +
    `  平均 ${r.m.avgHits.toFixed(1)} 下`);
});
console.log('\n把选中的组合填回 js/engine.js 的 engine.CONST。');
