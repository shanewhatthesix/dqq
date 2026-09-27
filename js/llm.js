/* =========================================================================
 * 附中·电子斗蛐蛐  在线 AI 生成（可选）
 *
 * 走 OpenAI 兼容的 /chat/completions 接口，所以智谱、通义、DeepSeek、Kimi、
 * OpenAI 都能直接用。API Key 只存在你自己的浏览器 localStorage 里，不会外传。
 *
 * 不填 Key 也完全能玩 —— 会退回 js/generator.js 的离线生成器。
 *
 * ── 关于两个容易踩的坑（都踩过） ──────────────────────────────────────
 *
 * 1) 推理模型会把 max_tokens 吃光。
 *    deepseek-v4-pro / deepseek-reasoner 这类模型会先输出一大段思维链
 *    （返回里叫 reasoning_content），而且思维链也算进 completion_tokens。
 *    如果 max_tokens 给 1200，思维链能占满 1200，答案（content）就是空字符串 ——
 *    表现得像「AI 没返回内容」。所以这里的预算给得比较宽（默认 4096）。
 *
 * 2) 不用 JSON 模式就得靠提示词求它。
 *    DeepSeek / OpenAI / 智谱都支持 response_format={"type":"json_object"}，
 *    开了以后接口层保证返回合法 JSON。默认打开；不支持的接口会自动降级重试。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;
  var B = DQQ.balance;

  var L = (DQQ.llm = {});

  /* 常用服务商预设，UI 里一键切换 */
  L.PROVIDERS = [
    { id: 'deepseek', label: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat',
      note: 'deepseek-chat 最快最稳；deepseek-reasoner / v4-pro 是推理模型，会慢一些' },
    { id: 'zhipu', label: '智谱 GLM（有免费额度）', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    { id: 'dashscope', label: '通义千问（阿里云）', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
    { id: 'moonshot', label: 'Kimi 月之暗面', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { id: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { id: 'custom', label: '自定义（OpenAI 兼容）', base: '', model: '' }
  ];

  /* ------------------------------------------------------------ 提示词 */
  function buildPrompt(input) {
    var caps = B.caps(input.rarity);
    var powerCap = B.powerCap(input.rarity);
    var totalPowerCap = B.totalPowerCap(input.rarity);

    /* 格式要求放在最前面（第一印象）和最后面（最近效应）各说一次。
     * 中间夹一个完整的正确样例 —— 只描述结构不给例子，模型很容易自由发挥。 */
    var sys = [
      '你是校园题材回合制对战游戏的数值策划，根据玩家描述设计一只「蛐蛐」的属性和技能。',
      '',
      '【最重要的要求】',
      '直接输出一个 JSON 对象。第一个字符必须是 {，最后一个字符必须是 }。',
      '不要写思考过程、不要解释、不要道歉、不要用 markdown 代码块、不要加任何前后缀文字。',
      '如果输出里出现 JSON 以外的东西，这份数据会被系统直接丢弃。',
      '',
      '【输出结构】（字段名和类型必须完全一致，不要增删字段）',
      '{',
      '  "personality": "四字以内的性格",',
      '  "stats": { "hp": 数字, "attack": 数字, "defense": 数字, "speed": 数字 },',
      '  "skills": [',
      '    { "name": "技能名", "element": "粉笔", "power": 数字, "accuracy": 数字, "effect": null }',
      '  ]',
      '}',
      '',
      '【一个合格的输出样例】',
      '{"personality":"卷王","stats":{"hp":85,"attack":58,"defense":60,"speed":52},"skills":[{"name":"粉笔头","element":"粉笔","power":45,"accuracy":92,"effect":null},{"name":"请家长","element":"作业","power":50,"accuracy":78,"effect":{"kind":"debuff","stat":"defense","value":0.2,"turns":2,"chance":0.8}}]}',
      '',
      '【硬性规则】',
      '1. 属性上限：hp≤' + caps.hp + '，attack≤' + caps.attack + '，defense≤' + caps.defense +
        '，speed≤' + caps.speed + '；四项总和≤' + caps.total + '。',
      '2. 技能 2-4 个。单个 power≤' + powerCap + '，所有技能 power 总和≤' + totalPowerCap + '。',
      '3. accuracy 在 50-100 之间。威力越高，命中率应当越低。',
      '4. element 只能是这六个之一：' + DQQ.ELEMENTS.join('、') + '。',
      '5. 不允许「一击必杀」「无敌」「必定命中」这类破坏平衡的效果。',
      '6. 技能名 2-6 个字，有校园生活气息，可以是具体动作或道具。',
      '7. effect 只能是 null，或者下面七种之一（stat 只能是 attack/defense/speed，value 用小数比例）：',
      '   {"kind":"debuff","stat":"defense","value":0.2,"turns":2,"chance":0.8}  削弱对方',
      '   {"kind":"buff","stat":"attack","value":0.2,"turns":2,"chance":1}       强化自己',
      '   {"kind":"heal","value":25,"turns":1,"chance":1}                        回复HP',
      '   {"kind":"dot","value":8,"turns":3,"chance":0.8}                        每回合掉血',
      '   {"kind":"stun","turns":1,"chance":0.25}                                对方停止行动',
      '   {"kind":"drain","value":0.4,"turns":1,"chance":1}                      吸取伤害回血',
      '   {"kind":"shield","value":25,"turns":3,"chance":1}                      获得护盾',
      '   注意：heal/dot/shield 的 value 是点数；buff/debuff/drain 的 value 是 0-1 的小数。',
      '',
      '【创作原则】',
      '- 数值要贴合描述给人的感觉：跑得快的速度高，能扛的 HP/防御高，凶的攻击高。',
      '- 至少有一个技能带 effect，让对战有变化。',
      '- 不要指名道姓任何真实的人，用泛称；不要写人身攻击或侮辱性内容。',
      '',
      '【再强调一次】你的回复必须是一个以 { 开头、以 } 结尾的 JSON 对象，此外什么都没有。'
    ].join('\n');

    var user = [
      '蛐蛐名字：' + input.name,
      '稀有度：' + input.rarity + '（决定上面那些上限）',
      '角色类型：' + input.type + '（' + (DQQ.CHARACTER_TYPE_META[input.type] || {}).desc + '）',
      '防御类型：' + input.defenseType + '（' + (DQQ.DEFENSE_TYPE_META[input.defenseType] || {}).desc + '）',
      '玩家写的描述：' + (input.description || '（没写，请自由发挥）'),
      '',
      '请设计这只蛐蛐。只回一个 JSON 对象，第一个字符是 {，不要有任何其他文字。'
    ].join('\n');

    return { system: sys, user: user };
  }

  /* ------------------------------------------------- 从回复里抠出 JSON */
  /* 大模型很爱在 JSON 外面裹一层 ```json 或者加点解释，这里都容错。 */
  L.extractJson = function (text) {
    if (!text || typeof text !== 'string') return null;

    var s = text.trim();
    // 去掉 ```json ... ```
    var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();

    try { return JSON.parse(s); } catch (e) {}

    // 从第一个 { 开始做括号配对，找出最外层对象
    var start = s.indexOf('{');
    if (start < 0) return null;
    var depth = 0, inStr = false, esc = false;
    for (var i = start; i < s.length; i++) {
      var ch = s[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;   // 括号没配平 —— 多半是被 max_tokens 截断了
  };

  /* ------------------------------------------------- 校验并修正 AI 的结果 */
  L.sanitize = function (raw, input, notes) {
    notes = notes || [];
    var rarity = input.rarity;
    var powerCap = B.powerCap(rarity);

    var out = {
      name: input.name,
      description: input.description,
      type: input.type,
      defenseType: input.defenseType,
      rarity: rarity,
      personality: '',
      stats: {},
      skills: [],
      createdBy: input.createdBy || '',
      createdAt: U.todayStr(),
      generatedBy: 'llm'
    };

    /* 性格 */
    var p = raw && raw.personality;
    if (typeof p === 'string' && p.trim() && p.trim().length <= 8) {
      out.personality = p.trim();
    } else {
      out.personality = U.pick(DQQ.PERSONALITIES);
      notes.push('AI 没给性格，已随机补一个');
    }

    /* 属性 */
    var st = (raw && raw.stats) || {};
    var stats = {
      hp: Number(st.hp), attack: Number(st.attack),
      defense: Number(st.defense), speed: Number(st.speed)
    };
    var keys = ['hp', 'attack', 'defense', 'speed'];
    var badStats = keys.some(function (k) { return !isFinite(stats[k]) || stats[k] <= 0; });
    if (badStats) {
      notes.push('AI 给的属性不完整，已改用离线生成器补全');
      var fallback = DQQ.generator.generate(input);
      out.stats = fallback.stats;
      out.personality = out.personality || fallback.personality;
    } else {
      var clamped = B.clampStats(stats, rarity);
      if (keys.some(function (k) { return Math.round(stats[k]) !== clamped[k]; })) {
        notes.push('AI 的属性超模，已自动压回' + rarity + '上限');
      }
      out.stats = clamped;
    }

    /* 技能 */
    var rawSkills = (raw && Array.isArray(raw.skills)) ? raw.skills : [];
    var skills = [];
    rawSkills.forEach(function (s, i) {
      if (!s || typeof s !== 'object') return;
      var name = String(s.name || '').trim().slice(0, 10);
      if (!name) name = '技能' + (i + 1);
      var element = DQQ.ELEMENTS.indexOf(s.element) >= 0 ? s.element : U.pick(DQQ.ELEMENTS);
      var power = Number(s.power);
      var acc = Number(s.accuracy);
      if (!isFinite(power) || power <= 0) power = Math.round(powerCap * 0.6);
      if (!isFinite(acc)) acc = 85;
      skills.push({
        name: name,
        element: element,
        power: U.clamp(Math.round(power), B.MIN_POWER, powerCap),
        accuracy: U.clamp(Math.round(acc), B.MIN_ACCURACY, B.MAX_ACCURACY),
        effect: E.normalize(s.effect, { rollRanges: true }),
        cg: null
      });
    });

    // 技能数量不够 2 个，用离线生成器补齐
    if (skills.length < B.MIN_SKILLS) {
      notes.push('AI 给的技能不足 2 个，已用离线生成器补齐');
      var fb = DQQ.generator.generate(input);
      while (skills.length < B.MIN_SKILLS && fb.skills.length) {
        skills.push(fb.skills.shift());
      }
    }
    if (skills.length > B.MAX_SKILLS) {
      notes.push('AI 给的技能超过 4 个，已裁掉多余的');
      skills = skills.slice(0, B.MAX_SKILLS);
    }
    // 去掉重名
    var seen = {};
    skills.forEach(function (s) {
      var base = s.name, n = 2;
      while (seen[s.name]) { s.name = base + '·' + n; n++; }
      seen[s.name] = true;
    });

    if (B.totalPower(skills) > B.totalPowerCap(rarity)) {
      notes.push('AI 的技能总威力超模，已自动压缩');
      skills = B.clampSkills(skills, rarity);
    }
    out.skills = skills;
    out.portrait = input.portrait || null;   // 立绘是玩家自己传的，AI 不碰
    return out;
  };

  /* ------------------------------------------------------------ 调用接口 */
  /* 把一次 HTTP 调用封装成 Promise<{content, finishReason, usage, model}> */
  function callOnce(input, settings, override) {
    var s = settings;
    var prompt = buildPrompt(input);
    var base = String(s.apiBase || '').replace(/\/+$/, '');
    var url = base + '/chat/completions';

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutMs = s.aiTimeout || 60000;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);

    var body = {
      model: s.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: (override && override.temperature != null) ? override.temperature : (s.temperature != null ? s.temperature : 0.8),
      /* 给足预算。推理模型的思维链也占这个额度，
       * 给小了会出现「content 是空字符串」这种看起来像接口坏了的现象。 */
      max_tokens: (override && override.maxTokens) || s.maxTokens || 4096
    };

    // JSON 模式：接口层保证返回合法 JSON，比在提示词里求它可靠得多
    var wantJson = (override && override.jsonMode != null) ? override.jsonMode : (s.jsonMode !== false);
    if (wantJson) body.response_format = { type: 'json_object' };

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.apiKey
      },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        clearTimeout(timer);
        if (!res.ok) {
          var detail = text;
          try {
            var j = JSON.parse(text);
            detail = (j.error && (j.error.message || j.error.code)) || j.message || text;
          } catch (e) {}
          var err = new Error('接口返回 ' + res.status + '：' + String(detail).slice(0, 200));
          err.httpStatus = res.status;
          throw err;
        }
        var data;
        try { data = JSON.parse(text); }
        catch (e) { throw new Error('接口返回的不是 JSON'); }

        var ch = data && data.choices && data.choices[0];
        var msg = (ch && ch.message) || {};
        return {
          content: typeof msg.content === 'string' ? msg.content : '',
          reasoning: typeof msg.reasoning_content === 'string' ? msg.reasoning_content : '',
          finishReason: ch && ch.finish_reason,
          usage: data && data.usage,
          model: data && data.model
        };
      });
    }).catch(function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') {
        throw new Error('请求超时（超过 ' + Math.round(timeoutMs / 1000) + ' 秒）。推理模型会比较慢，可以在设置里把超时调大');
      }
      if (err instanceof TypeError) {
        throw new Error('请求被浏览器拦截或网络不通。可能是接口不允许跨域，试试离线生成器，或在设置里换一个接口地址');
      }
      throw err;
    });
  }

  /* 把「为什么没拿到 JSON」讲清楚，别只丢一句「找不到 JSON」 */
  function explainEmpty(r) {
    if (!r.content && r.finishReason === 'length') {
      var rt = r.usage && r.usage.completion_tokens_details && r.usage.completion_tokens_details.reasoning_tokens;
      return '输出被截断了（max_tokens 用满）' +
        (rt ? '，其中 ' + rt + ' 个 token 花在思考过程上' : '') +
        '。去设置里把「最大输出长度」调大，或者换一个非推理模型（比如 deepseek-chat）';
    }
    if (!r.content && r.reasoning) {
      return '模型只输出了思考过程，没有给答案。换一个非推理模型会更稳';
    }
    if (!r.content) {
      return '接口返回的内容是空的（finish_reason=' + (r.finishReason || '未知') + '）';
    }
    return null;
  }

  L.generate = function (input, settings, cb) {
    var s = settings || {};
    if (!s.aiEnabled || !s.apiKey) {
      cb(new Error('没有配置在线 AI'), null);
      return;
    }

    function finish(r) {
      var emptyMsg = explainEmpty(r);
      if (emptyMsg) { cb(new Error(emptyMsg), null); return; }

      var json = L.extractJson(r.content);
      if (!json) {
        var snippet = r.content.trim().slice(0, 80).replace(/\s+/g, ' ');
        cb(new Error('返回的内容里找不到完整 JSON（可能被截断）。开头是：' + snippet), null);
        return;
      }
      var notes = [];
      var cricket = L.sanitize(json, input, notes);
      cricket._notes = notes;
      cricket._raw = r.content;
      cricket._meta = { model: r.model, finishReason: r.finishReason, usage: r.usage };
      cb(null, cricket);
    }

    /* 第一次正常调；失败就降级重试一次：
     * 关掉 JSON 模式（有些接口不认这个参数会直接报错）、温度调低、把预算再放大。 */
    callOnce(input, s, null)
      .then(function (r) {
        if (r.content && L.extractJson(r.content)) { finish(r); return; }
        return callOnce(input, s, { jsonMode: false, temperature: 0.3, maxTokens: Math.max(s.maxTokens || 4096, 8192) * 2 })
          .then(function (r2) {
            // 重试拿到的如果更完整就用它
            if (r2.content && L.extractJson(r2.content)) finish(r2);
            else finish(r.content && r.content.length > r2.content.length ? r : r2);
          });
      })
      .catch(function (err) {
        // 第一次就报错（4xx/超时）也可能是 JSON 模式不被支持，降级再试一次
        var retriable = err && (err.httpStatus === 400 || err.httpStatus === 422);
        if (!retriable) { cb(err, null); return; }
        callOnce(input, s, { jsonMode: false, temperature: 0.3 })
          .then(finish)
          .catch(function (e2) { cb(e2, null); });
      });
  };

  /* 设置页的「测试连接」：只做一次最便宜的连通性检查 */
  L.test = function (settings, cb) {
    var s = U.deepClone(settings || {});
    var base = String(s.apiBase || '').replace(/\/+$/, '');
    if (!base) { cb(new Error('还没填接口地址')); return; }
    if (!s.apiKey) { cb(new Error('还没填 API Key')); return; }

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 20000);

    fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.apiKey },
      body: JSON.stringify({
        model: s.model,
        messages: [{ role: 'user', content: '回复一个「好」字即可。' }],
        max_tokens: 16
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (res.ok) { cb(null, '连接成功，模型可用'); return; }
      res.text().then(function (t) {
        var detail = t;
        try { var j = JSON.parse(t); detail = (j.error && j.error.message) || j.message || t; } catch (e) {}
        cb(new Error('接口返回 ' + res.status + '：' + String(detail).slice(0, 160)));
      });
    }).catch(function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') cb(new Error('连接超时'));
      else if (err instanceof TypeError) cb(new Error('被浏览器拦截（CORS）或网络不通'));
      else cb(err);
    });
  };

  /* 设置页的「试生成一只」：跑完整的生成流程，把每一步都摊开说。
   * 光测连通性没用 —— 连通但拿不到 JSON 才是最坑的情况。 */
  L.selfTest = function (settings, cb) {
    var probe = {
      name: '测试蛐蛐',
      description: '一只用来测试接口的蛐蛐，跑得快，擅长拖堂。',
      type: '同学',
      defenseType: '体育生',
      rarity: '稀有'
    };
    var t0 = Date.now();
    L.generate(probe, settings, function (err, cricket) {
      var ms = Date.now() - t0;
      if (err) { cb(err, { ms: ms }); return; }
      cb(null, {
        ms: ms,
        personality: cricket.personality,
        stats: cricket.stats,
        skills: cricket.skills.map(function (s) { return s.name + '(' + s.element + ' ' + s.power + ')'; }),
        notes: cricket._notes,
        meta: cricket._meta,
        preview: (cricket._raw || '').slice(0, 160)
      });
    });
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
