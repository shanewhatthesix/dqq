/* =========================================================================
 * 附中·电子斗蛐蛐  离线生成器
 *
 * 不联网也能用：读角色描述里的关键词，推断属性倾向和技能属性，
 * 然后在稀有度上限内把数值配平，最后从技能词库里挑招。
 *
 * 在线大模型（js/llm.js）只是把这一步换成 AI 来想，
 * 生成结果的字段结构完全一样，两边可以互相兜底。
 *
 * 想加关键词：往 KEYWORDS 里追加一条正则就行。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;
  var B = DQQ.balance;

  var G = (DQQ.generator = {});

  /* --------------------------------------------------------------- 关键词表 */
  /* bias：属性倾向，1.0 表示「占满该属性上限的比例」，大于 1 就是偏科
   * elements：技能属性权重
   * tag：给性格筛选用的标签 */
  var KEYWORDS = [
    { re: /拖堂|占课|不下课|晚自习|再讲|讲完|拖到|加课/, bias: { hp: 1.1, attack: 1.0, defense: 1.0, speed: 0.8 }, elements: { '拖堂': 3 }, tag: '拖延' },
    { re: /粉笔|板书|黑板|书写|擦黑/, bias: { attack: 1.15 }, elements: { '粉笔': 3 }, tag: '讲台' },
    { re: /作业|抄写|题海|练习册|卷子|五三|错题|周记|默写/, bias: { attack: 1.15, speed: 0.9 }, elements: { '作业': 3 }, tag: '作业' },
    { re: /考试|测验|月考|期中|期末|排名|分数|压轴|附加题|满分/, bias: { attack: 1.2 }, elements: { '考试': 3 }, tag: '考试' },
    { re: /零食|辣条|奶茶|泡面|小卖部|吃|加餐|卫龙/, bias: { hp: 1.15 }, elements: { '零食': 3 }, tag: '零食' },
    { re: /校规|扣分|处分|记过|通报|德育|班规|档案/, bias: { defense: 1.1 }, elements: { '规则': 3 }, tag: '规则' },
    { re: /食堂|打饭|阿姨|大勺|饭卡/, bias: { hp: 1.2, attack: 0.95 }, elements: { '零食': 2, '粉笔': 1 }, tag: '食堂' },
    { re: /快|跑|冲|百米|体育|球|运动|冠军|校队/, bias: { speed: 1.35, attack: 1.15, defense: 0.9 }, elements: { '粉笔': 1, '拖堂': 1 }, tag: '体育' },
    { re: /学霸|第一|满分|成绩好|竞赛|奥赛|天才/, bias: { defense: 1.35, attack: 1.1, speed: 0.85 }, elements: { '考试': 2, '作业': 1 }, tag: '学霸' },
    { re: /睡|困|摆烂|躺平|摸鱼|划水|后排|摸不着/, bias: { hp: 1.35, defense: 0.75, speed: 0.9 }, elements: { '拖堂': 2, '零食': 1 }, tag: '摆烂' },
    { re: /老师|教师|教练|主任|校长|班主任|导师/, bias: { defense: 1.2, attack: 1.1 }, elements: { '规则': 2, '粉笔': 1 }, tag: '教师' },
    { re: /幽灵|鬼|神秘|诡异|午夜|实验楼|传说|诅咒/, bias: { speed: 1.2, attack: 1.15, hp: 0.95 }, elements: { '考试': 2, '拖堂': 1 }, tag: '灵异' },
    { re: /艺术|音乐|唱|画|舞|美术|合唱|琴|舞台/, bias: { speed: 1.25, hp: 0.9, defense: 0.9 }, elements: { '考试': 1, '零食': 1 }, tag: '艺术' },
    { re: /梗|抽象|整活|鬼畜|退退退|尊嘟假嘟|绝绝子|yyds|破防/, bias: { speed: 1.1, hp: 0.95 }, elements: { '拖堂': 2, '规则': 1 }, tag: '网络梗' },
    { re: /温柔|善良|耐心|好人|和蔼/, bias: { hp: 1.2, attack: 0.85 }, elements: { '零食': 2, '粉笔': 1 }, tag: '温和' },
    { re: /凶|狠|严格|暴躁|可怕|压迫|威严|恐怖|无情/, bias: { attack: 1.3, defense: 1.05 }, elements: { '规则': 2, '考试': 1 }, tag: '威严' },
    { re: /可爱|萌|软|小只|萌系/, bias: { speed: 1.2, hp: 0.9, attack: 0.85 }, elements: { '零食': 2 }, tag: '可爱' },
    { re: /数学|物理|化学|生物|计算|公式|推导|实验/, bias: { attack: 1.15, defense: 1.1 }, elements: { '作业': 2, '考试': 2 }, tag: '理科' },
    { re: /英语|语文|背诵|作文|阅读理解|单词/, bias: { defense: 1.1, speed: 1.05 }, elements: { '作业': 2, '拖堂': 1 }, tag: '文科' },
    { re: /班长|课代表|纪律|检查|收作业|点名/, bias: { defense: 1.2, attack: 1.05 }, elements: { '规则': 2, '作业': 1 }, tag: '班干' },
    { re: /晚|夜|深夜|凌晨|灯|宿管/, bias: { speed: 1.1, hp: 1.05 }, elements: { '拖堂': 2, '考试': 1 }, tag: '夜行' }
  ];

  /* 每种防御类型的默认技能属性（描述里没线索时用） */
  var DEFAULT_ELEMENTS = {
    '学霸': { '考试': 2, '作业': 2, '规则': 1 },
    '学渣': { '拖堂': 2, '零食': 2, '粉笔': 1 },
    '教师': { '粉笔': 2, '规则': 2, '拖堂': 1 },
    '体育生': { '粉笔': 2, '拖堂': 2, '零食': 1 },
    '艺术生': { '考试': 2, '零食': 1, '拖堂': 1 },
    '食堂': { '零食': 2, '规则': 1, '粉笔': 1 }
  };

  /* ---------------------------------------------------------- 描述 → 倾向 */
  G.analyze = function (text) {
    var s = String(text || '');
    var bias = { hp: 1, attack: 1, defense: 1, speed: 1 };
    var elements = {};
    var tags = [];
    var hitCount = 0;

    KEYWORDS.forEach(function (kw) {
      if (!kw.re.test(s)) return;
      hitCount++;
      tags.push(kw.tag);
      Object.keys(kw.bias || {}).forEach(function (k) {
        bias[k] = (bias[k] || 1) * kw.bias[k];
      });
      Object.keys(kw.elements || {}).forEach(function (el) {
        elements[el] = (elements[el] || 0) + kw.elements[el];
      });
    });

    // 正则的 lastIndex 不会因为 test 而残留（没有 g 标志），这里不用重置
    return { bias: bias, elements: elements, tags: tags, hits: hitCount };
  };

  /* --------------------------------------------------- 把总属性分配到四项 */
  /* 先给每项随机抖动一下倾向（不然同一种防御类型每次生成都一样），
   * 再用二分找出「缩放系数」使得四项在各自上限内刚好凑满目标总和。
   * 这样强势项会自然顶到上限，剩下的按倾向分，不会出现全都顶上限的极端配点。 */
  function allocateStats(rarity, weights) {
    var caps = B.caps(rarity);
    var keys = ['hp', 'attack', 'defense', 'speed'];
    var target = Math.round(caps.total * U.randFloat(0.90, 1.0));

    var w = {};
    keys.forEach(function (k) {
      w[k] = (weights[k] || 1) * U.randFloat(0.88, 1.12);
    });

    function totalAt(scale) {
      var sum = 0;
      keys.forEach(function (k) { sum += Math.min(caps[k], caps[k] * w[k] * scale); });
      return sum;
    }

    var lo = 0, hi = 4;
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      if (totalAt(mid) < target) lo = mid; else hi = mid;
    }
    var scale = (lo + hi) / 2;

    var stats = {};
    keys.forEach(function (k) {
      stats[k] = U.clamp(Math.round(caps[k] * w[k] * scale), 1, caps[k]);
    });

    // 四舍五入的零头补到还有空间的项上
    var remain = target - keys.reduce(function (a, k) { return a + stats[k]; }, 0);
    var guard = 0;
    while (remain > 0 && guard++ < 100) {
      var room = keys.filter(function (k) { return stats[k] < caps[k]; });
      if (!room.length) break;
      var per = Math.max(1, Math.floor(remain / room.length));
      room.forEach(function (k) {
        if (remain <= 0) return;
        var add = Math.min(per, caps[k] - stats[k], remain);
        stats[k] += add;
        remain -= add;
      });
    }
    return B.clampStats(stats, rarity);
  }

  /* ------------------------------------------------------------ 技能生成 */
  /* used 记录每个属性已经被用了几次，用得多权重就衰减，
   * 这样「粉笔头百发百中」会以粉笔为主，但不至于四个招全是粉笔。 */
  function pickElement(weights, used) {
    var pool = Object.keys(weights).map(function (el) {
      return { el: el, weight: weights[el] * Math.pow(0.42, used[el] || 0) };
    }).filter(function (o) {
      return DQQ.ELEMENTS.indexOf(o.el) >= 0 && o.weight > 0;
    });
    if (!pool.length) return U.pick(DQQ.ELEMENTS);
    return U.weightedPick(pool).el;
  }

  function genSkills(rarity, elementWeights, analysis) {
    var powerCap = B.powerCap(rarity);
    var totalCap = B.totalPowerCap(rarity);

    // 技能数量。伤害每次都要先扣掉对方防御，所以「4 个 20 威力」远不如
    // 「2 个 40 威力」。这里按「总威力够分几发有威胁的招」来定数量。
    var maxCount = U.clamp(Math.floor(totalCap / (powerCap * 0.55)), 2, 4);
    var minCount = U.clamp(Math.round(totalCap / powerCap), 2, maxCount);
    var countPool = [];
    for (var c = minCount; c <= maxCount; c++) {
      countPool.push({ n: c, weight: c === 3 ? 45 : (c === 2 ? 25 : 30) });
    }
    var count = U.weightedPick(countPool).n;

    // 威力预算：主力技稍强，但每个技能都要有存在感（最低约为主力的 6 成）
    var targetTotal = Math.round(totalCap * U.randFloat(0.86, 0.99));
    var shape = [1.30, 1.05, 0.90, 0.80];
    var weights = shape.slice(0, count).map(function (w) { return w * U.randFloat(0.92, 1.08); });
    var wsum = weights.reduce(function (a, b) { return a + b; }, 0);

    var usedNames = {};
    var usedTemplates = {};
    var elementUse = {};
    var skills = [];

    for (var n = 0; n < count; n++) {
      var element = pickElement(elementWeights, elementUse);
      elementUse[element] = (elementUse[element] || 0) + 1;
      var pool = DQQ.SKILL_POOL[element] || DQQ.SKILL_POOL['粉笔'];

      // 优先挑这个属性里还没用过的模板
      var fresh = pool.filter(function (t) { return !usedTemplates[element + '|' + t.name]; });
      var tpl = U.pick(fresh.length ? fresh : pool);
      usedTemplates[element + '|' + tpl.name] = true;

      var name = tpl.name;
      if (usedNames[name]) name = name + '·改';
      usedNames[name] = true;

      var power = Math.round(targetTotal * weights[n] / wsum);
      var accuracy = U.rangePick(tpl.accuracy);

      // 威力和命中二选一：威力高就压命中，反之亦然，避免又准又痛
      if (power > powerCap * 0.85 && accuracy > 88) accuracy -= U.randInt(4, 12);

      skills.push({
        name: name,
        element: element,
        power: power,
        accuracy: accuracy,
        effect: tpl.effect ? E.normalize(tpl.effect, { rollRanges: true }) : null,
        cg: null
      });
    }

    // 随机挑一个技能把主力的威力优势再拉开一点
    skills = B.clampSkills(skills, rarity);
    // 按威力从大到小排，主技能排最前面
    skills.sort(function (a, b) { return b.power - a.power; });
    return skills;
  }

  /* ------------------------------------------------------------ 性格选择 */
  function pickPersonality(tags) {
    var map = {
      '拖延': ['摸鱼', '佛系', '人间清醒'], '讲台': ['暴躁', '中二'], '作业': ['卷王', '老实人'],
      '考试': ['卷王', '高冷'], '零食': ['嘴硬心软', '社恐'], '规则': ['高冷', '阴阳怪气'],
      '食堂': ['嘴硬心软', '戏精'], '体育': ['暴躁', '外强中干'], '学霸': ['卷王', '高冷'],
      '摆烂': ['随时开摆', '摸鱼', '佛系'], '教师': ['老实人', '中二'], '灵异': ['中二', '高冷'],
      '艺术': ['戏精', '话痨'], '网络梗': ['阴阳怪气', '戏精'], '温和': ['老实人', '嘴硬心软'],
      '威严': ['高冷', '暴躁'], '可爱': ['社恐', '话痨'], '理科': ['中二', '闷声干大事'],
      '文科': ['话痨', '人间清醒'], '班干': ['卷王', '老实人'], '夜行': ['高冷', '闷声干大事']
    };
    var candidates = [];
    (tags || []).forEach(function (t) {
      if (map[t]) candidates = candidates.concat(map[t]);
    });
    if (!candidates.length) return U.pick(DQQ.PERSONALITIES);
    return U.pick(candidates);
  }

  /* ---------------------------------------------------------------- 入口 */
  /* opts: { name, description, type, defenseType, rarity }  —— rarity 留空则随机 */
  G.generate = function (opts) {
    opts = opts || {};
    var description = String(opts.description || '').trim();
    var name = String(opts.name || '').trim() || '无名蛐蛐';

    var analysis = G.analyze(name + ' ' + description);

    // 稀有度：没指定就按权重抽
    var rarity = opts.rarity;
    if (!rarity || DQQ.RARITIES.indexOf(rarity) < 0) {
      rarity = U.weightedPick(DQQ.RARITIES.map(function (r) {
        return { r: r, weight: DQQ.RARITY_META[r].weight };
      })).r;
    }

    var defenseType = DQQ.DEFENSE_TYPES.indexOf(opts.defenseType) >= 0
      ? opts.defenseType : U.pick(DQQ.DEFENSE_TYPES);
    var charType = DQQ.CHARACTER_TYPES.indexOf(opts.type) >= 0
      ? opts.type : U.pick(DQQ.CHARACTER_TYPES);

    // 属性倾向 = 防御类型的天然倾向 × 描述里的关键词倾向
    var baseBias = DQQ.DEFENSE_TYPE_BIAS[defenseType] || { hp: 1, attack: 1, defense: 1, speed: 1 };
    var weights = {};
    ['hp', 'attack', 'defense', 'speed'].forEach(function (k) {
      weights[k] = (baseBias[k] || 1) * (analysis.bias[k] || 1);
    });

    // 技能属性：描述里有关键词就用关键词的，否则用防御类型的默认组合
    var elementWeights = {};
    var hasEl = Object.keys(analysis.elements).length > 0;
    var src = hasEl ? analysis.elements : (DEFAULT_ELEMENTS[defenseType] || { '粉笔': 1 });
    Object.keys(src).forEach(function (k) { elementWeights[k] = src[k]; });

    var stats = allocateStats(rarity, weights);
    var skills = genSkills(rarity, elementWeights, analysis);

    var cricket = {
      name: name,
      description: description,
      type: charType,
      defenseType: defenseType,
      rarity: rarity,
      personality: pickPersonality(analysis.tags),
      stats: stats,
      skills: skills,
      createdBy: opts.createdBy || '',
      createdAt: U.todayStr(),
      generatedBy: 'offline',
      keywords: analysis.tags
    };

    // 理论上不会超模，但落库前再过一遍尺子
    var chk = B.check(cricket);
    if (!chk.ok) {
      cricket.stats = B.clampStats(cricket.stats, rarity);
      cricket.skills = B.clampSkills(cricket.skills, rarity);
    }
    return cricket;
  };

  /* 给「随机一只」按钮用 */
  G.randomBrief = function () {
    var names = ['走廊尽头的人', '三班的传说', '操场边的影子', '小卖部常客', '图书馆钉子户',
      '广播站站长', '值日组组长', '多媒体管理员', '实验楼常客', '天台上的诗人'];
    var descs = [
      '没人知道他在想什么，但每次考试都稳得可怕。',
      '下课第一个冲出教室，上课最后一个进来。',
      '手里永远有一瓶冰红茶，从不离身。',
      '据说他能背下整本英语词典，但体育课总是请假。',
      '晚自习结束后还在教室，灯是他的标志。'
    ];
    return { name: U.pick(names), description: U.pick(descs) };
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
