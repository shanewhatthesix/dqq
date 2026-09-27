/* =========================================================================
 * 附中·电子斗蛐蛐  无头模拟器
 *
 * 在 Node 里把 js/ 下的脚本加载进来跑几万场对战，用来验证两件事：
 *   1. 引擎逻辑不会卡死 / 报错 / 出现负血
 *   2. 数值平衡 —— 平均几回合结束、有没有过强的属性或类型
 *
 * 用法：  node tools/simulate.js [每场次数]
 * ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const LOAD_ORDER = ['data.js', 'util.js', 'effect.js', 'balance.js', 'engine.js'];

for (const f of LOAD_ORDER) {
  const p = path.join(JS_DIR, f);
  vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}

const DQQ = globalThis.DQQ;
const { util: U, effect: E, balance: B, engine: Engine } = DQQ;

const N = parseInt(process.argv[2], 10) || 3000;

let failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
  return cond;
}

/* ------------------------------------------------------------------ 1. 预设数据体检 */
console.log('='.repeat(64));
console.log('【1】预设蛐蛐超模检测');
console.log('='.repeat(64));

let presetBad = 0;
for (const c of DQQ.PRESET_CRICKETS) {
  const r = B.check(c);
  const power = B.totalPower(c.skills);
  const line = `${c.name.padEnd(14, '　')} ${c.rarity} ${String(c.type).padEnd(4, '　')}/${String(c.defenseType).padEnd(4, '　')}` +
    ` 属性${String(r.totalStats).padStart(3)} 威力${String(power).padStart(3)}`;
  if (!r.ok) {
    presetBad++;
    console.log(`  ✗ ${line}`);
    r.errors.forEach(e => console.log(`      ! ${e}`));
  } else {
    console.log(`  ✓ ${line}`);
  }
  r.warnings.forEach(w => console.log(`      ~ ${w}`));
}
assert(presetBad === 0, `${presetBad} 个预设蛐蛐没通过超模检测`);

/* --------------------------------------------------- 2. 中英文效果解析往返测试 */
console.log('\n' + '='.repeat(64));
console.log('【2】效果解析器');
console.log('='.repeat(64));

const parseCases = [
  ['对方防御-10%', 'debuff', 'defense'],
  ['自身攻击+20%', 'buff', 'attack'],
  ['30%概率使对方速度-20%持续2回合', 'debuff', 'speed'],
  ['回复20点HP', 'heal', null],
  ['回复15%最大生命', 'heal', null],
  ['每回合损失8点HP持续3回合', 'dot', null],
  ['使对方眩晕1回合', 'stun', null],
  ['吸取30%伤害', 'drain', null],
  ['获得25点护盾', 'shield', null],
];
for (const [text, kind, stat] of parseCases) {
  const e = E.normalize(text);
  const ok = e && e.kind === kind && (stat === null || e.stat === stat);
  assert(ok, `效果解析失败: "${text}" → ${JSON.stringify(e)}`);
  console.log(`  ${ok ? '✓' : '✗'} ${text.padEnd(30, '　')} → ${E.text(e) || '(无法解析)'}`);
}
// 解析不了的应该返回 null 而不是乱猜
assert(E.normalize('随便写点什么') === null, '无法识别的效果应当返回 null');
console.log(`  ✓ 无法识别的文本返回 null`);

/* --------------------------------------------------------- 3. 伤害公式抽查 */
console.log('\n' + '='.repeat(64));
console.log('【3】伤害公式抽查（同条件固定随机种子）');
console.log('='.repeat(64));

function fixedRng() { return 0.5; }
const probe = DQQ.PRESET_CRICKETS[0];
function mkProbe(c) {
  const b = Engine.create({ teams: { A: [c], B: [c] } });
  return b.teams.A.members[0];
}
const atkMember = mkProbe(probe);
const defMember = mkProbe(DQQ.PRESET_CRICKETS[3]);   // 后排睡觉的（学渣）
for (const mult of [0.5, 1, 2]) {
  // 找一条对应倍率的技能来验证
  for (const el of DQQ.ELEMENTS) {
    if (Engine.elementMult(el, defMember.defenseType) !== mult) continue;
    const skill = { element: el, power: 45, accuracy: 95, effect: null };
    const d = Engine.calcDamage(atkMember, defMember, skill, fixedRng);
    console.log(`  ${el} → ${defMember.defenseType}  倍率${mult}×  伤害 ${d.damage}`);
    assert(d.damage >= 1, '伤害不应小于 1');
    break;
  }
}

/* ------------------------------------------------------------ 4. 随机对战 */
console.log('\n' + '='.repeat(64));
console.log(`【4】随机对战模拟（每组 ${N} 场）`);
console.log('='.repeat(64));

const stats = {
  turns: [], winnerA: 0, winnerB: 0, draw: 0, maxTurns: 0,
  timeout: 0, err: 0, hpLeft: [],
};

function randTeam(n) {
  return U.shuffle(DQQ.PRESET_CRICKETS).slice(0, n).map(c => U.deepClone(c));
}

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  try {
    const r = Engine.runAuto(randTeam(1), randTeam(1), { nameA: 'A', nameB: 'B' });
    stats.turns.push(r.turns);
    if (r.winner === 'A') stats.winnerA++;
    else if (r.winner === 'B') stats.winnerB++;
    else stats.draw++;
    if (r.turns > stats.maxTurns) stats.maxTurns = r.turns;
    if (r.reason.indexOf('上限') >= 0) stats.timeout++;
    // 血量和守恒检查
    for (const side of ['A', 'B']) {
      for (const m of r.battle.teams[side].members) {
        assert(m.hp >= 0 && m.hp <= m.maxHp, `血量越界: ${m.name} ${m.hp}/${m.maxHp}`);
      }
    }
    // winner 为 null 只可能是同归于尽，或打到回合上限且双方血量比例正好相等
    assert(r.winner !== null || r.reason === '同归于尽' || r.reason.indexOf('上限') >= 0,
      `战斗结束却没有结果: ${r.reason}`);
  } catch (err) {
    stats.err++;
    if (stats.err <= 3) console.log(`  ✗ 异常: ${err.message}\n${err.stack.split('\n')[1]}`);
  }
}
const elapsed = Date.now() - t0;

const avgTurns = stats.turns.reduce((a, b) => a + b, 0) / stats.turns.length;
const sorted = stats.turns.slice().sort((a, b) => a - b);
console.log(`  耗时          ${elapsed}ms  (${(elapsed / N).toFixed(2)}ms/场)`);
// 注意：A/B 不代表先手，先后手由速度决定。两边都是随机抽样，理论上应该各 50%。
console.log(`  A 方胜率      ${(stats.winnerA / N * 100).toFixed(1)}%   (理论 50%，两边随机抽签)`);
console.log(`  B 方胜率      ${(stats.winnerB / N * 100).toFixed(1)}%`);
console.log(`  平局          ${(stats.draw / N * 100).toFixed(1)}%`);
console.log(`  平均回合数    ${avgTurns.toFixed(1)}  (中位数 ${sorted[Math.floor(sorted.length / 2)]}, 最长 ${stats.maxTurns})`);
console.log(`  打到回合上限  ${(stats.timeout / N * 100).toFixed(1)}%`);
console.log(`  异常          ${stats.err}`);
assert(stats.err === 0, `有 ${stats.err} 场对战抛异常`);

/* ------------------------------------------------------------- 5. 3v3 对战 */
console.log('\n' + '='.repeat(64));
console.log('【5】3v3 对战模拟');
console.log('='.repeat(64));

const t3 = { turns: [], err: 0, winA: 0, winB: 0, draw: 0 };
for (let i = 0; i < Math.floor(N / 3); i++) {
  try {
    const r = Engine.runAuto(randTeam(3), randTeam(3), { nameA: 'A', nameB: 'B' });
    t3.turns.push(r.turns);
    if (r.winner === 'A') t3.winA++; else if (r.winner === 'B') t3.winB++; else t3.draw++;
  } catch (err) {
    t3.err++;
    if (t3.err <= 3) console.log(`  ✗ ${err.message}\n${err.stack.split('\n')[1]}`);
  }
}
const avg3 = t3.turns.reduce((a, b) => a + b, 0) / t3.turns.length;
console.log(`  平均回合数    ${avg3.toFixed(1)}`);
console.log(`  先手胜率      ${(t3.winA / t3.turns.length * 100).toFixed(1)}%`);
console.log(`  平局          ${(t3.draw / t3.turns.length * 100).toFixed(1)}%`);
console.log(`  异常          ${t3.err}`);
assert(t3.err === 0, `3v3 有 ${t3.err} 场抛异常`);

/* ------------------------------------------------ 6. 全蛐蛐循环赛（谁超模） */
console.log('\n' + '='.repeat(64));
console.log('【6】预设蛐蛐循环赛（两两对战，看有没有谁一家独大）');
console.log('='.repeat(64));

const ROSTER = DQQ.PRESET_CRICKETS;
const PER_PAIR = 120;
const record = ROSTER.map(c => ({ name: c.name, rarity: c.rarity, win: 0, lose: 0, draw: 0 }));

for (let i = 0; i < ROSTER.length; i++) {
  for (let j = i + 1; j < ROSTER.length; j++) {
    for (let k = 0; k < PER_PAIR; k++) {
      const first = (k % 2 === 0);
      const A = U.deepClone(first ? ROSTER[i] : ROSTER[j]);
      const Bc = U.deepClone(first ? ROSTER[j] : ROSTER[i]);
      const r = Engine.runAuto([A], [Bc], {});
      if (r.winner === null) { record[i].draw++; record[j].draw++; }
      else if ((r.winner === 'A' && first) || (r.winner === 'B' && !first)) { record[i].win++; record[j].lose++; }
      else { record[j].win++; record[i].lose++; }
    }
  }
}

record.sort((a, b) => (b.win / (b.win + b.lose || 1)) - (a.win / (a.win + a.lose || 1)));
console.log('  排名  蛐蛐            稀有度  胜率');
let lopsided = 0;
record.forEach((r, i) => {
  const total = r.win + r.lose;
  const rate = total ? r.win / total : 0;
  const bar = '█'.repeat(Math.round(rate * 20)).padEnd(20, '·');
  console.log(`  ${String(i + 1).padStart(3)}   ${r.name.padEnd(14, '　')} ${r.rarity}  ${bar} ${(rate * 100).toFixed(0)}%`);
  if (rate > 0.78 || rate < 0.22) lopsided++;
});
console.log(`  → 胜率超出 22%~78% 区间的蛐蛐：${lopsided} 只`);
console.log('  说明：稀有度越高数值上限越高，跨稀有度碾压是设计使然。');
console.log('        真正要盯的是「同稀有度内」是否公平，见下一节。');

/* ------------------------------------------- 6b. 同稀有度内部平衡（公平模式） */
console.log('\n' + '='.repeat(64));
console.log('【6b】同稀有度内战（公平模式的核心体验）');
console.log('='.repeat(64));

for (const rar of DQQ.RARITIES) {
  const group = ROSTER.filter(c => c.rarity === rar);
  if (group.length < 2) { console.log(`  ${rar}：只有 ${group.length} 只，跳过`); continue; }
  const rec = group.map(c => ({ name: c.name, win: 0, lose: 0, draw: 0 }));
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      for (let k = 0; k < 200; k++) {
        const first = (k % 2 === 0);
        const A = U.deepClone(first ? group[i] : group[j]);
        const Bc = U.deepClone(first ? group[j] : group[i]);
        const r = Engine.runAuto([A], [Bc], {});
        if (r.winner === null) { rec[i].draw++; rec[j].draw++; }
        else if ((r.winner === 'A') === first) { rec[i].win++; rec[j].lose++; }
        else { rec[j].win++; rec[i].lose++; }
      }
    }
  }
  rec.sort((a, b) => (b.win / (b.win + b.lose || 1)) - (a.win / (a.win + a.lose || 1)));
  console.log(`  ── ${rar} ──`);
  rec.forEach(r => {
    const total = r.win + r.lose;
    const rate = total ? r.win / total : 0;
    const bar = '█'.repeat(Math.round(rate * 20)).padEnd(20, '·');
    console.log(`     ${r.name.padEnd(14, '　')} ${bar} ${(rate * 100).toFixed(0)}%`);
  });
}

/* ------------------------------------------- 6c. 攻击流 vs 防御流（成正比吗） */
console.log('\n' + '='.repeat(64));
console.log('【6c】攻击流 vs 防御流（同样的属性预算，谁赢？）');
console.log('='.repeat(64));

/* 两条完全同价的配点：一条把点全堆攻击，一条全堆防御。
 * 如果公式健康，胜率应该接近 50%；如果攻击一边倒，说明防御不值钱。 */
const SKILLS_FOR_TEST = [
  { name: '平A', element: '规则', power: 55, accuracy: 95, effect: null },
  { name: '平B', element: '规则', power: 45, accuracy: 95, effect: null }
];
function testBuild(name, stats) {
  return {
    name: name, type: '同学', defenseType: '学霸', rarity: '稀有',
    stats: stats, skills: U.deepClone(SKILLS_FOR_TEST)
  };
}
/* HP 和速度必须完全一样，只把点数在攻击和防御之间对调，
 * 否则测出来的其实是「血量/先手优势」，不是攻防的相对价值。 */
const ATTACK_BUILD = testBuild('攻击流', { hp: 90, attack: 70, defense: 40, speed: 70 });
const DEFENSE_BUILD = testBuild('防御流', { hp: 90, attack: 40, defense: 70, speed: 70 });

const FAIR_ITER = 4000;
let atkWins = 0, defWins = 0, fairDraw = 0;
let atkHits = 0, defHits = 0;
for (let i = 0; i < FAIR_ITER; i++) {
  const r = Engine.runAuto([U.deepClone(ATTACK_BUILD)], [U.deepClone(DEFENSE_BUILD)], {});
  if (r.winner === 'A') atkWins++;
  else if (r.winner === 'B') defWins++;
  else fairDraw++;
  atkHits += r.events.filter(e => e.type === 'damage' && e.side === 'A').length;
  defHits += r.events.filter(e => e.type === 'damage' && e.side === 'B').length;
}
const atkRate = atkWins / FAIR_ITER;
console.log(`  攻击流(atk 120, def 30) 胜率 ${(atkRate * 100).toFixed(1)}%`);
console.log(`  防御流(atk 60,  def 90) 胜率 ${(defWins / FAIR_ITER * 100).toFixed(1)}%`);
console.log(`  攻击流平均命中 ${(atkHits / FAIR_ITER).toFixed(1)} 次，防御流 ${(defHits / FAIR_ITER).toFixed(1)} 次`);
console.log(`  → 偏移 ${Math.abs(atkRate - 0.5) > 0.12 ? '⚠ 太大，攻击和防御不成正比' : '✓ 可以接受（接近 50%）'}`);
assert(Math.abs(atkRate - 0.5) <= 0.15,
  `攻击流胜率 ${(atkRate * 100).toFixed(1)}% 偏离 50% 太多，说明攻击/防御失衡`);

/* ------------------------------------------- 6d. 单击伤害上限与对局节奏 */
console.log('\n' + '='.repeat(64));
console.log('【6d】单击伤害上限与对局节奏（同稀有度随机对战）');
console.log('='.repeat(64));

/* 这里要分开看两件事，之前混在一起导致误报：
 *   a) 单击伤害上限 —— 直接量「最大的一下打掉了对方多少比例的血」，
 *      这是「会不会被两下秒」的真正指标，应该 ≤ MAX_HIT_RATIO。
 *   b) 对局节奏 —— 看回合数和「一回合秒杀」的比例。
 * 不能拿「打死对方用了几次 direct damage」当指标：持续伤害（抄写十遍那类）
 * 也在扣血但不占出手次数，2 次直击 + 3 跳毒把人毒死是正常的，不是两下秒。 */
const hitPct = [];
const endTurns = [];
let oneTurnKill = 0, total1v1 = 0, directHits = [];

for (let i = 0; i < 1200; i++) {
  const A = U.deepClone(U.pick(ROSTER));
  const Bc = U.deepClone(U.pick(ROSTER));
  if (A.rarity !== Bc.rarity) continue;          // 只看同稀有度，跨稀有度本来就不公平
  const r = Engine.runAuto([A], [Bc], {});
  if (!r.winner) continue;
  total1v1++;

  const loser = r.winner === 'A' ? r.battle.teams.B : r.battle.teams.A;
  const maxHp = loser.members.reduce((a, m) => a + m.maxHp, 0);

  // 每一击占对方血量的比例
  let hits = 0;
  r.events.forEach(e => {
    if (e.type !== 'damage' || e.side !== r.winner) return;
    hits++;
    hitPct.push(e.damage / maxHp);
  });
  directHits.push(hits);
  endTurns.push(r.turns);
  if (r.turns <= 1) oneTurnKill++;
}

hitPct.sort((a, b) => a - b);
endTurns.sort((a, b) => a - b);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const maxPct = hitPct[hitPct.length - 1];
const avgPct = avg(hitPct);

console.log(`  单次伤害占对方血量：平均 ${(avgPct * 100).toFixed(1)}%，最大 ${(maxPct * 100).toFixed(1)}%`);
console.log(`    （上限设定为 ${(Engine.CONST.MAX_HIT_RATIO * 100).toFixed(0)}%，超过就说明上限没生效）`);
console.log(`  平均出手 ${avg(directHits).toFixed(1)} 次打死一只（另有持续伤害在磨血）`);
console.log(`  平均 ${avg(endTurns).toFixed(1)} 回合结束（中位数 ${endTurns[Math.floor(endTurns.length / 2)]}，最短 ${endTurns[0]}）`);
const oneTurnRate = oneTurnKill / total1v1;
console.log(`  一回合内被打死的对局：${(oneTurnRate * 100).toFixed(1)}%`);

assert(maxPct <= Engine.CONST.MAX_HIT_RATIO + 0.01,
  `单击最高打出 ${(maxPct * 100).toFixed(1)}% 血，超过 ${(Engine.CONST.MAX_HIT_RATIO * 100).toFixed(0)}% 的上限，两下秒杀保护失效了`);
assert(avg(endTurns) >= 4, `平均只用 ${avg(endTurns).toFixed(1)} 回合就结束，战斗太短`);
assert(oneTurnRate < 0.01, `有 ${(oneTurnRate * 100).toFixed(1)}% 的对局一回合就结束，还是太快`);

/* ------------------------------------------------------------ 7. 边界情况 */
console.log('\n' + '='.repeat(64));
console.log('【7】边界情况');
console.log('='.repeat(64));

// 7a. 全员 1 点攻击 vs 满防 —— 不能出现 0 伤害死循环
const weak = {
  name: '菜鸡', type: '同学', defenseType: '学渣', rarity: '普通',
  stats: { hp: 10, attack: 1, defense: 1, speed: 1 },
  skills: [{ name: '挠', element: '粉笔', power: 5, accuracy: 50, effect: null }],
};
const tank = {
  name: '铁桶', type: '同学', defenseType: '学霸', rarity: '传说',
  stats: { hp: 110, attack: 5, defense: 80, speed: 1 },
  skills: [{ name: '瞪', element: '粉笔', power: 5, accuracy: 50, effect: null }],
};
{
  const r = Engine.runAuto([U.deepClone(weak)], [U.deepClone(tank)], {});
  console.log(`  低攻 vs 高防：${r.turns} 回合结束，结果 ${r.winner || '平局'} (${r.reason})`);
  assert(r.turns <= Engine.CONST.MAX_TURNS, '战斗必须在回合上限内结束');
}

// 7b. 无限眩晕不能锁死对手导致打不完
const stunner = {
  name: '控制狂', type: '网络梗', defenseType: '艺术生', rarity: '普通',
  stats: { hp: 60, attack: 40, defense: 40, speed: 60 },
  skills: [
    { name: '定', element: '拖堂', power: 20, accuracy: 100, effect: { kind: 'stun', turns: 1, chance: 1 } },
    { name: '定2', element: '拖堂', power: 20, accuracy: 100, effect: { kind: 'stun', turns: 1, chance: 1 } },
  ],
};
{
  const r = Engine.runAuto([U.deepClone(stunner)], [U.deepClone(DQQ.PRESET_CRICKETS[3])], {});
  console.log(`  全程控制：${r.turns} 回合结束，结果 ${r.winner || '平局'} (${r.reason})`);
  assert(r.turns <= Engine.CONST.MAX_TURNS + 1, '控制流也必须在上限内收场');
}

// 7c. 强制换人不会让替补白赚一次行动
{
  const a = { name: 'A', type: '同学', defenseType: '学渣', rarity: '普通',
    stats: { hp: 40, attack: 99, defense: 1, speed: 90 },
    skills: [{ name: '秒', element: '考试', power: 70, accuracy: 100, effect: null },
             { name: '秒2', element: '考试', power: 70, accuracy: 100, effect: null }] };
  const b = { name: 'B', type: '同学', defenseType: '学渣', rarity: '普通',
    stats: { hp: 30, attack: 30, defense: 1, speed: 1 },
    skills: [{ name: '挠', element: '粉笔', power: 20, accuracy: 100, effect: null },
             { name: '挠2', element: '粉笔', power: 20, accuracy: 100, effect: null }] };
  const b2 = Object.assign({}, b, { name: 'B2' });
  const r = Engine.runAuto([a], [b, b2], {});
  // 这里只验换人机制，不验输赢。A 速度 90 先手打死 B 之后，
  // B2 应当顶上，并接管 B 队本回合剩下的那次行动机会。
  const acts = r.events.filter(e => e.type === 'use-skill');
  const aActs = acts.filter(e => e.side === 'A').length;
  const bActs = acts.filter(e => e.side === 'B').length;
  const entered = r.events.filter(e => e.type === 'switch-in' && e.member.name === 'B2');
  console.log(`  换人接管行动机会：A 出手 ${aActs} 次，B 方出手 ${bActs} 次（含替补 B2）`);
  assert(entered.length === 1, 'B2 必须被换上场');
  assert(bActs >= 1, '替补 B2 上场后应当拿到 B 队本回合的行动机会');
}

// 7d. 3v3 里被打死的那队必须有替补顶上
{
  const r = Engine.runAuto(randTeam(3), randTeam(3), {});
  const faints = r.events.filter(e => e.type === 'faint');
  const switches = r.events.filter(e => e.type === 'switch-in' && e.forced);
  console.log(`  3v3 阵亡 ${faints.length} 次，强制换人 ${switches.length} 次`);
  // 每次阵亡要么触发一次强制换人，要么直接终局（该队全灭），所以最多差 1 次
  const endedByWipe = r.reason === '全员阵亡' ? 1 : 0;
  assert(switches.length === faints.length - endedByWipe,
    `强制换人次数(${switches.length}) 应为阵亡次数(${faints.length})减去终局那次(${endedByWipe})`);
}

/* --------------------------------------------------------------- 收尾 */
console.log('\n' + '='.repeat(64));
if (failures.length) {
  console.log(`✗ 发现 ${failures.length} 个问题：`);
  failures.forEach(f => console.log(`   - ${f}`));
  process.exit(1);
} else {
  console.log('✓ 全部检查通过');
  console.log('='.repeat(64));
}
