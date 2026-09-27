/* =========================================================================
 * 附中·电子斗蛐蛐  数据层
 * 类型 / 属性 / 克制表 / 稀有度 / 技能词库 / 预设蛐蛐
 * 想加新属性、新类型、新角色模板，只改这个文件。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});

  DQQ.VERSION = '1.1.0';

  /* ---------------------------------------------------------------- 角色类型 */
  DQQ.CHARACTER_TYPES = ['虚构', '导师', '校领导', '同学', '网络梗'];

  DQQ.CHARACTER_TYPE_META = {
    '虚构': { icon: '🎭', desc: '完全虚构，不映射真人' },
    '导师': { icon: '👨‍🏫', desc: '老师、教练、社团指导' },
    '校领导': { icon: '🏛️', desc: '校长、主任、年级组长' },
    '同学': { icon: '🎒', desc: '学生、社团成员' },
    '网络梗': { icon: '🌐', desc: '网络热梗抽象角色' }
  };

  /* --------------------------------------------------- 类型克制（攻击 → 防御） */
  DQQ.TYPE_MULT = {
    '虚构': { '虚构': 1, '导师': 1, '校领导': 1, '同学': 1, '网络梗': 1 },
    '导师': { '虚构': 1, '导师': 1, '校领导': 0.8, '同学': 1.2, '网络梗': 1 },
    '校领导': { '虚构': 1, '导师': 1.2, '校领导': 1, '同学': 1.5, '网络梗': 1 },
    '同学': { '虚构': 1, '导师': 1, '校领导': 1.2, '同学': 1, '网络梗': 1 },
    '网络梗': { '虚构': 1, '导师': 1, '校领导': 1, '同学': 1, '网络梗': 1 }
  };

  /* ---------------------------------------------------------------- 攻击属性 */
  DQQ.ELEMENTS = ['粉笔', '作业', '考试', '拖堂', '零食', '规则'];

  DQQ.ELEMENT_META = {
    '粉笔': { color: '#6E7683', desc: '基础、稳定、命中高' },
    '作业': { color: '#2E6489', desc: '高威力、低命中' },
    '考试': { color: '#C43D2E', desc: '高暴击、波动大' },
    '拖堂': { color: '#8A5A2B', desc: '控制型、减益' },
    '零食': { color: '#4B7A55', desc: '回复、辅助' },
    '规则': { color: '#16283F', desc: '无视部分防御' }
  };

  /* 属性自带的隐藏特性，写在引擎里生效 */
  DQQ.ELEMENT_TRAITS = {
    '粉笔': { accuracyBonus: 10 },        // 命中高
    '作业': {},                            // 高威力低命中靠数值体现
    '考试': { critBonus: 20 },             // 暴击率 +20%
    '拖堂': {},                            // 控制靠技能效果体现
    '零食': {},                            // 回复靠技能效果体现
    '规则': { defPierce: 0.5 }             // 无视 50% 防御
  };

  /* ---------------------------------------------------------------- 防御类型 */
  DQQ.DEFENSE_TYPES = ['学霸', '学渣', '教师', '体育生', '艺术生', '食堂'];

  DQQ.DEFENSE_TYPE_META = {
    '学霸': { icon: '🎓', desc: '高防御、低速度' },
    '学渣': { icon: '😴', desc: '高HP、低防御' },
    '教师': { icon: '👨‍🏫', desc: '均衡、克制学生' },
    '体育生': { icon: '🏃', desc: '高速度、高攻击' },
    '艺术生': { icon: '🎨', desc: '高闪避、特殊技能' },
    '食堂': { icon: '🍳', desc: '高回复、消耗型' }
  };

  /* 防御类型的隐藏战斗特性。
   * 设计文档里「艺术生=高闪避」「食堂=高回复」光靠四项属性表达不出来，
   * 所以给它们各加一条被动。其余四类的高防/高血/均衡/高速由数值倾向体现。 */
  DQQ.DEFENSE_TRAITS = {
    '学霸': {},
    '学渣': {},
    '教师': {},
    '体育生': {},
    '艺术生': { dodge: 8 },     // 额外 8% 闪避
    '食堂': { regen: 3 }        // 每回合结束回复 4 点 HP
  };

  /* 防御类型对属性的天然倾向，生成器用它分配数值 */
  DQQ.DEFENSE_TYPE_BIAS = {
    '学霸': { hp: 0.9, attack: 0.9, defense: 1.35, speed: 0.85 },
    '学渣': { hp: 1.35, attack: 0.8, defense: 0.7, speed: 0.95 },
    '教师': { hp: 1.0, attack: 1.05, defense: 1.1, speed: 0.85 },
    '体育生': { hp: 1.0, attack: 1.2, defense: 0.9, speed: 1.25 },
    '艺术生': { hp: 0.85, attack: 1.0, defense: 0.8, speed: 1.2 },
    '食堂': { hp: 1.25, attack: 0.85, defense: 1.0, speed: 0.9 }
  };

  /* --------------------------------------------- 属性克制（攻击属性 → 防御类型） */
  DQQ.ELEMENT_MULT = {
    '粉笔': { '学霸': 0.5, '学渣': 1, '教师': 0.5, '体育生': 2, '艺术生': 1, '食堂': 2 },
    '作业': { '学霸': 0.5, '学渣': 2, '教师': 2, '体育生': 1, '艺术生': 1, '食堂': 1 },
    '考试': { '学霸': 2, '学渣': 2, '教师': 0.5, '体育生': 0.5, '艺术生': 2, '食堂': 1 },
    '拖堂': { '学霸': 1, '学渣': 0.5, '教师': 0.5, '体育生': 2, '艺术生': 1, '食堂': 2 },
    '零食': { '学霸': 1, '学渣': 1, '教师': 1, '体育生': 2, '艺术生': 0.5, '食堂': 0.5 },
    '规则': { '学霸': 1, '学渣': 2, '教师': 2, '体育生': 0.5, '艺术生': 0.5, '食堂': 1 }
  };

  /* ------------------------------------------------------------------ 稀有度 */
  /* 数值上限来自设计文档 7.3 超模检测 */
  DQQ.RARITIES = ['普通', '稀有', '史诗', '传说'];

  DQQ.RARITY_META = {
    '普通': { color: '#8C8778', caps: { hp: 80, attack: 50, defense: 50, speed: 60, total: 220 }, powerCap: 40, totalPowerCap: 80, weight: 40 },
    '稀有': { color: '#2E6489', caps: { hp: 90, attack: 60, defense: 60, speed: 70, total: 260 }, powerCap: 50, totalPowerCap: 110, weight: 32 },
    '史诗': { color: '#C43D2E', caps: { hp: 100, attack: 70, defense: 70, speed: 80, total: 300 }, powerCap: 60, totalPowerCap: 140, weight: 20 },
    '传说': { color: '#D9A020', caps: { hp: 110, attack: 80, defense: 80, speed: 90, total: 340 }, powerCap: 70, totalPowerCap: 170, weight: 8 }
  };

  /* 生成器用的每项属性下限系数（相对上限），避免出现 5 点攻击的废柴 */
  DQQ.STAT_FLOOR_RATIO = 0.5;

  /* ------------------------------------------------------------- 技能效果池 */
  /* kind: debuff / buff / heal / dot / stun / drain / shield
   * stat: attack / defense / speed
   * value: buff/debuff 用比例(0.15 = 15%)，heal/dot/shield 用点数，drain 用吸取比例
   */
  DQQ.EFFECT_KINDS = {
    debuff: '削弱对方',
    buff: '强化自身',
    heal: '回复生命',
    dot: '持续伤害',
    stun: '使对方无法行动',
    drain: '吸取生命',
    shield: '获得护盾'
  };

  /* 被禁止的效果关键词 —— 超模检测用 */
  DQQ.BANNED_EFFECT_WORDS = [
    '一击必杀', '秒杀', '即死', '无敌', '免疫所有', '免疫全部', '必定命中且',
    '无法被击败', '不死', '秒杀全场', '100%眩晕无限', '永久眩晕'
  ];

  /* 每种属性的技能模板池。power/accuracy 给的是区间，生成时随机取。 */
  DQQ.SKILL_POOL = {
    '粉笔': [
      { name: '粉笔头', power: [28, 44], accuracy: [92, 100], effect: null, tag: '稳定输出' },
      { name: '黑板擦回旋', power: [34, 48], accuracy: [82, 94], effect: null, tag: '稳定输出' },
      { name: '板书铁拳', power: [40, 54], accuracy: [74, 86], effect: null, tag: '高威力' },
      { name: '粉笔灰迷雾', power: [20, 32], accuracy: [90, 100], effect: { kind: 'debuff', stat: 'attack', value: [0.1, 0.2], turns: 2, chance: [0.5, 1] }, tag: '减攻' },
      { name: '飞掷粉笔盒', power: [42, 56], accuracy: [64, 78], effect: null, tag: '高风险' },
      { name: '三尺讲台压制', power: [32, 46], accuracy: [80, 92], effect: { kind: 'debuff', stat: 'defense', value: [0.15, 0.25], turns: 2, chance: [0.5, 0.9] }, tag: '破防' },
      { name: '板书狂草', power: [30, 44], accuracy: [85, 96], effect: { kind: 'buff', stat: 'attack', value: [0.1, 0.2], turns: 2, chance: 1 }, tag: '自我强化' }
    ],
    '作业': [
      { name: '题海战术', power: [40, 55], accuracy: [68, 82], effect: null, tag: '高威力' },
      { name: '抄写十遍', power: [36, 50], accuracy: [72, 86], effect: { kind: 'dot', value: [6, 12], turns: 3, chance: [0.5, 0.9] }, tag: '持续伤害' },
      { name: '请家长', power: [44, 58], accuracy: [60, 74], effect: { kind: 'debuff', stat: 'defense', value: [0.15, 0.3], turns: 2, chance: [0.6, 1] }, tag: '破防' },
      { name: '五三冲刺', power: [42, 56], accuracy: [66, 80], effect: null, tag: '高威力' },
      { name: '错题本反噬', power: [30, 42], accuracy: [80, 92], effect: { kind: 'drain', value: [0.3, 0.5], turns: 1, chance: 1 }, tag: '吸血' },
      { name: '作业加量', power: [34, 48], accuracy: [75, 88], effect: { kind: 'debuff', stat: 'speed', value: [0.15, 0.3], turns: 2, chance: [0.5, 0.9] }, tag: '减速' },
      { name: '周记暴击', power: [38, 52], accuracy: [70, 84], effect: null, tag: '高威力' }
    ],
    '考试': [
      { name: '突击测验', power: [40, 55], accuracy: [70, 84], effect: null, tag: '高暴击' },
      { name: '压轴题', power: [48, 62], accuracy: [58, 72], effect: null, tag: '高风险' },
      { name: '排名打击', power: [36, 50], accuracy: [78, 90], effect: { kind: 'debuff', stat: 'attack', value: [0.15, 0.25], turns: 2, chance: [0.6, 1] }, tag: '减攻' },
      { name: '选择题三长一短', power: [30, 44], accuracy: [85, 96], effect: null, tag: '稳定输出' },
      { name: '期中突袭', power: [44, 58], accuracy: [64, 78], effect: { kind: 'stun', turns: 1, chance: [0.2, 0.35] }, tag: '控制' },
      { name: '满分制裁', power: [46, 60], accuracy: [62, 76], effect: null, tag: '高威力' },
      { name: '附加题', power: [50, 64], accuracy: [55, 68], effect: null, tag: '极限输出' }
    ],
    '拖堂': [
      { name: '再讲一分钟', power: [26, 38], accuracy: [88, 98], effect: { kind: 'debuff', stat: 'speed', value: [0.2, 0.35], turns: 2, chance: [0.6, 1] }, tag: '减速' },
      { name: '下课铃没响', power: [30, 42], accuracy: [84, 95], effect: { kind: 'stun', turns: 1, chance: [0.25, 0.4] }, tag: '控制' },
      { name: '最后一题', power: [38, 52], accuracy: [74, 88], effect: null, tag: '高威力' },
      { name: '占用课间', power: [28, 40], accuracy: [86, 96], effect: { kind: 'debuff', stat: 'defense', value: [0.15, 0.3], turns: 2, chance: [0.5, 0.9] }, tag: '破防' },
      { name: '晚自习延长', power: [32, 46], accuracy: [80, 92], effect: { kind: 'dot', value: [5, 10], turns: 3, chance: [0.5, 0.9] }, tag: '持续伤害' },
      { name: '拖堂十连', power: [42, 56], accuracy: [66, 80], effect: null, tag: '高威力' }
    ],
    '零食': [
      { name: '辣条回血', power: [14, 24], accuracy: [95, 100], effect: { kind: 'heal', value: [12, 20], turns: 1, chance: 1 }, tag: '回复' },
      { name: '奶茶加速', power: [16, 26], accuracy: [92, 100], effect: { kind: 'buff', stat: 'speed', value: [0.2, 0.35], turns: 3, chance: 1 }, tag: '加速' },
      { name: '泡面补给', power: [18, 28], accuracy: [90, 100], effect: { kind: 'heal', value: [10, 18], turns: 1, chance: 1 }, tag: '回复' },
      { name: '小卖部特供', power: [22, 34], accuracy: [86, 98], effect: { kind: 'buff', stat: 'attack', value: [0.15, 0.3], turns: 3, chance: 1 }, tag: '强化' },
      { name: '卫龙冲击', power: [30, 44], accuracy: [80, 94], effect: null, tag: '稳定输出' },
      { name: '冰红茶暴击', power: [32, 46], accuracy: [76, 90], effect: { kind: 'drain', value: [0.2, 0.4], turns: 1, chance: 1 }, tag: '吸血' },
      { name: '加餐护盾', power: [12, 20], accuracy: [95, 100], effect: { kind: 'shield', value: [12, 20], turns: 3, chance: 1 }, tag: '护盾' }
    ],
    '规则': [
      { name: '校规第7条', power: [32, 46], accuracy: [86, 98], effect: { kind: 'debuff', stat: 'attack', value: [0.1, 0.2], turns: 2, chance: [0.6, 1] }, tag: '减攻' },
      { name: '扣分通报', power: [30, 44], accuracy: [88, 100], effect: { kind: 'debuff', stat: 'defense', value: [0.15, 0.3], turns: 2, chance: [0.6, 1] }, tag: '破防' },
      { name: '通报批评', power: [36, 50], accuracy: [80, 94], effect: null, tag: '无视防御' },
      { name: '记入档案', power: [40, 54], accuracy: [74, 88], effect: { kind: 'dot', value: [6, 12], turns: 3, chance: [0.5, 0.9] }, tag: '持续伤害' },
      { name: '班规压制', power: [34, 48], accuracy: [82, 94], effect: { kind: 'debuff', stat: 'speed', value: [0.15, 0.25], turns: 2, chance: [0.5, 0.9] }, tag: '减速' },
      { name: '德育处传唤', power: [42, 56], accuracy: [70, 84], effect: { kind: 'stun', turns: 1, chance: [0.2, 0.35] }, tag: '控制' }
    ]
  };

  /* ---------------------------------------------------------------- 性格池 */
  DQQ.PERSONALITIES = [
    '暴躁', '佛系', '卷王', '摸鱼', '高冷', '社恐', '话痨', '嘴硬心软',
    '戏精', '老实人', '中二', '阴阳怪气', '人间清醒', '随时开摆', '外强中干', '闷声干大事'
  ];

  /* ---------------------------------------------------------------- 预设蛐蛐 */
  /* 新同学想加模板角色，往这里追加一条就行，格式和玩家创建的一模一样。 */
  DQQ.PRESET_CRICKETS = [
    {
      /* 这一条就是设计文档第 8 节的数据结构示例，数值原样保留 */
      name: '数学课代表',
      description: '拖堂能力极强，粉笔头百发百中，收作业时六亲不认。',
      type: '同学', defenseType: '学霸', rarity: '稀有',
      personality: '卷王',
      stats: { hp: 85, attack: 55, defense: 50, speed: 65 },
      skills: [
        { name: '粉笔头', element: '粉笔', power: 45, accuracy: 95, effect: null, cg: null },
        { name: '请家长', element: '作业', power: 50, accuracy: 80, effect: { kind: 'debuff', stat: 'defense', value: 0.2, turns: 2, chance: 0.8 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '食堂阿姨',
      description: '手抖是假象，勺子底下全是肉。打饭窗口前从不失手。',
      type: '虚构', defenseType: '食堂', rarity: '稀有',
      personality: '嘴硬心软',
      stats: { hp: 90, attack: 50, defense: 55, speed: 55 },
      skills: [
        { name: '加餐护盾', element: '零食', power: 16, accuracy: 98, effect: { kind: 'shield', value: 20, turns: 3, chance: 1 }, cg: null },
        { name: '辣条回血', element: '零食', power: 20, accuracy: 96, effect: { kind: 'heal', value: 18, turns: 1, chance: 1 }, cg: null },
        { name: '抖动的大勺', element: '粉笔', power: 42, accuracy: 88, effect: null, cg: null },
        { name: '扣分通报', element: '规则', power: 32, accuracy: 90, effect: { kind: 'debuff', stat: 'defense', value: 0.2, turns: 2, chance: 0.7 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '年级主任',
      description: '走廊里的黑影，脚步声自带压迫感，全校没人敢在他面前跑。',
      type: '校领导', defenseType: '教师', rarity: '史诗',
      personality: '高冷',
      stats: { hp: 95, attack: 68, defense: 68, speed: 62 },
      skills: [
        { name: '德育处传唤', element: '规则', power: 50, accuracy: 78, effect: { kind: 'stun', turns: 1, chance: 0.3 }, cg: null },
        { name: '通报批评', element: '规则', power: 46, accuracy: 86, effect: null, cg: null },
        { name: '记入档案', element: '规则', power: 42, accuracy: 82, effect: { kind: 'dot', value: 10, turns: 3, chance: 0.8 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '后排睡觉的',
      description: '上课睡到打铃，被点名时靠本能答对，生命力异常顽强。',
      type: '同学', defenseType: '学渣', rarity: '普通',
      personality: '随时开摆',
      stats: { hp: 78, attack: 44, defense: 32, speed: 58 },
      skills: [
        { name: '装死', element: '零食', power: 14, accuracy: 98, effect: { kind: 'heal', value: 16, turns: 1, chance: 1 }, cg: null },
        { name: '鼾声攻击', element: '拖堂', power: 24, accuracy: 90, effect: { kind: 'debuff', stat: 'speed', value: 0.25, turns: 2, chance: 0.7 }, cg: null },
        { name: '抄作业反噬', element: '作业', power: 40, accuracy: 82, effect: { kind: 'drain', value: 0.4, turns: 1, chance: 1 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '校队前锋',
      description: '百米十一秒，课间十分钟能踢完一场球，上课铃永远追不上他。',
      type: '同学', defenseType: '体育生', rarity: '稀有',
      personality: '暴躁',
      stats: { hp: 78, attack: 60, defense: 52, speed: 70 },
      skills: [
        { name: '冲刺射门', element: '粉笔', power: 50, accuracy: 78, effect: null, cg: null },
        { name: '体能测试', element: '考试', power: 32, accuracy: 88, effect: null, cg: null },
        { name: '体育课特权', element: '规则', power: 28, accuracy: 90, effect: null, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '合唱团首席',
      description: '高音能穿透三层教学楼，联欢晚会压轴，闪避技能点满。',
      type: '同学', defenseType: '艺术生', rarity: '稀有',
      personality: '戏精',
      stats: { hp: 76, attack: 56, defense: 46, speed: 66 },
      skills: [
        { name: '高音穿透', element: '考试', power: 46, accuracy: 84, effect: null, cg: null },
        { name: '和声干扰', element: '拖堂', power: 30, accuracy: 92, effect: { kind: 'debuff', stat: 'attack', value: 0.25, turns: 2, chance: 0.8 }, cg: null },
        { name: '舞台气场', element: '零食', power: 24, accuracy: 94, effect: { kind: 'buff', stat: 'speed', value: 0.3, turns: 3, chance: 1 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '物理竞赛教练',
      description: '随手画个受力分析就能让你怀疑人生，压轴题在他眼里是送分题。',
      type: '导师', defenseType: '学霸', rarity: '史诗',
      personality: '卷王',
      stats: { hp: 88, attack: 66, defense: 70, speed: 66 },
      skills: [
        { name: '压轴题', element: '考试', power: 58, accuracy: 70, effect: null, cg: null },
        { name: '受力分析', element: '作业', power: 44, accuracy: 84, effect: { kind: 'debuff', stat: 'defense', value: 0.25, turns: 2, chance: 0.8 }, cg: null },
        { name: '竞赛集训', element: '拖堂', power: 38, accuracy: 86, effect: { kind: 'dot', value: 9, turns: 3, chance: 0.8 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '晚自习巡逻主任',
      description: '零点几秒就能锁定后排的手机屏幕，走廊尽头永远有他的脚步声。',
      type: '虚构', defenseType: '教师', rarity: '史诗',
      personality: '高冷',
      stats: { hp: 96, attack: 64, defense: 70, speed: 60 },
      skills: [
        { name: '后窗凝视', element: '考试', power: 52, accuracy: 76, effect: { kind: 'stun', turns: 1, chance: 0.25 }, cg: null },
        { name: '没收手机', element: '规则', power: 48, accuracy: 88, effect: { kind: 'debuff', stat: 'attack', value: 0.2, turns: 2, chance: 0.9 }, cg: null },
        { name: '无声巡廊', element: '拖堂', power: 40, accuracy: 90, effect: { kind: 'debuff', stat: 'speed', value: 0.25, turns: 2, chance: 0.7 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '实验楼幽灵',
      description: '只在晚自习后出现，据说做实验炸过三次实验室，至今仍在游荡。',
      type: '虚构', defenseType: '艺术生', rarity: '传说',
      personality: '中二',
      stats: { hp: 104, attack: 78, defense: 68, speed: 84 },
      skills: [
        { name: '午夜实验', element: '考试', power: 52, accuracy: 66, effect: null, cg: null },
        { name: '试剂挥洒', element: '作业', power: 42, accuracy: 80, effect: { kind: 'dot', value: 12, turns: 3, chance: 0.85 }, cg: null },
        { name: '穿墙而过', element: '拖堂', power: 38, accuracy: 88, effect: { kind: 'buff', stat: 'speed', value: 0.3, turns: 3, chance: 1 }, cg: null },
        { name: '实验室封锁', element: '规则', power: 38, accuracy: 74, effect: { kind: 'stun', turns: 1, chance: 0.3 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '退退退',
      description: '拳头没到，气势先到。物理伤害有限，精神污染拉满。',
      type: '网络梗', defenseType: '艺术生', rarity: '普通',
      personality: '戏精',
      stats: { hp: 72, attack: 44, defense: 38, speed: 60 },
      skills: [
        { name: '退退退', element: '拖堂', power: 28, accuracy: 94, effect: { kind: 'debuff', stat: 'attack', value: 0.2, turns: 2, chance: 0.8 }, cg: null },
        { name: '气势压制', element: '规则', power: 32, accuracy: 88, effect: { kind: 'debuff', stat: 'defense', value: 0.2, turns: 2, chance: 0.7 }, cg: null },
        { name: '情绪稳定', element: '零食', power: 16, accuracy: 96, effect: { kind: 'heal', value: 15, turns: 1, chance: 1 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '数学老师',
      description: '一道题能讲三种解法，拖堂是他的浪漫，粉笔头是他的准星。',
      type: '导师', defenseType: '教师', rarity: '稀有',
      personality: '老实人',
      stats: { hp: 84, attack: 54, defense: 60, speed: 60 },
      skills: [
        { name: '再讲一分钟', element: '拖堂', power: 34, accuracy: 92, effect: { kind: 'debuff', stat: 'speed', value: 0.3, turns: 2, chance: 0.8 }, cg: null },
        { name: '三种解法', element: '作业', power: 40, accuracy: 82, effect: null, cg: null },
        { name: '板书铁拳', element: '粉笔', power: 36, accuracy: 80, effect: null, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    },
    {
      name: '尊嘟假嘟',
      description: '一句话能把人问懵，真假难辨，让人怀疑自己的记忆。',
      type: '网络梗', defenseType: '学渣', rarity: '普通',
      personality: '阴阳怪气',
      stats: { hp: 74, attack: 44, defense: 36, speed: 60 },
      skills: [
        { name: '尊嘟假嘟', element: '拖堂', power: 26, accuracy: 94, effect: { kind: 'stun', turns: 1, chance: 0.25 }, cg: null },
        { name: '记忆篡改', element: '考试', power: 38, accuracy: 84, effect: { kind: 'debuff', stat: 'attack', value: 0.2, turns: 2, chance: 0.7 }, cg: null },
        { name: '装傻充愣', element: '零食', power: 16, accuracy: 96, effect: { kind: 'heal', value: 15, turns: 1, chance: 1 }, cg: null }
      ],
      createdBy: '社团预置', createdAt: '2026-09-27'
    }
  ];

})(typeof globalThis !== 'undefined' ? globalThis : this);
