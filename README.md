# 🦗 附中·电子斗蛐蛐

纯网页的回合制格斗游戏。把你身边的同学、老师、校领导、网络梗做成"蛐蛐"，
AI 根据描述生成属性和技能，然后两只蛐蛐在竞技场里打一场。

**零成本 · 零硬件 · 不需要服务器 · 不需要构建工具。**

---

## 快速开始

**方法一：直接双击 `index.html`**

对，就这么简单。整个游戏是纯静态的 HTML/CSS/JS，没有构建步骤，不依赖任何外部库和 CDN，
断网也能玩（在线 AI 除外）。所有脚本都用普通 `<script>` 标签加载，没有用 ES Module，
就是为了让 `file://` 直接打开也能跑。

> 小提示：个别浏览器（比如 Safari、或者 Chrome 的无痕模式）在 `file://` 下会禁用
> localStorage，那样改的东西关掉页面就没了。真遇到这种情况，用方法二起个本地服务即可。

**方法二：本地起个小服务**（推荐，行为跟线上一致）

```bash
cd DQQ
python -m http.server 8000
# 然后浏览器打开 http://127.0.0.1:8000
```

---

## 传到 GitHub 并部署

本地仓库已经建好了（`main` 分支、首次提交完成、工作区干净），**28 个文件全部就绪**。
你只需要做认证和推送。

### 第一步：登录 GitHub

```bash
gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key
```

这条命令把主机、协议、认证方式都指定好了，所以**它不会再问你任何问题**，
只会直接打印两行：

```
! One-time code (XXXX-XXXX) copied to clipboard
Open this URL to continue in your web browser: https://github.com/login/device
```

验证码已经自动复制到剪贴板了。浏览器会自动打开授权页（没弹出就手动开
https://github.com/login/device ），**把码粘进去**（Ctrl+V），点授权。

看到 `✓ Logged in as 你的用户名` 就成功了，终端会自动继续。

> 码的有效期大约 15 分钟，过期就重跑一次这条命令，会给你一个新的。

### 第二步：建仓库并推送

```bash
cd D:/Dev/Game/DQQ
gh repo create dqq --public --source=. --push
```

- `dqq` 是仓库名，**可以改成你想要的**，它会直接变成网址的一部分
- `--public` 是公开仓库。想先私密就换成 `--private`，
  但**私有仓库用 GitHub Pages 需要付费账号**，免费号必须公开
- `--source=.` 表示用当前目录当源
- `--push` 表示建完立刻推上去

成功的话会打印仓库地址，类似：

```
✓ Created repository 你的用户名/dqq on GitHub
✓ Added remote https://github.com/你的用户名/dqq.git
✓ Pushed commits to https://github.com/你的用户名/dqq.git
```

去 `https://github.com/你的用户名/dqq` 能看到 28 个文件就对了。

### 第三步：开启网页访问（GitHub Pages）

1. 打开仓库页面 → **Settings**（顶部菜单，不是右上角头像里的）
2. 左侧栏找到 **Pages**
3. **Source** 选 `Deploy from a branch`
4. **Branch** 选 `main`，目录保持 `/ (root)`，点 **Save**
5. 等 1-2 分钟刷新这个页面，顶部会出现绿色提示和网址

访问 `https://你的用户名.github.io/dqq/` 就能玩了。手机也能直接开。

> 仓库里的 `.nojekyll` 是为了让 Pages 原样发布所有文件 ——
> GitHub Pages 默认会跑一遍 Jekyll，它会忽略下划线开头的文件和目录。

### 以后更新代码

```bash
git add -A
git commit -m "改了什么"
git push
```

推送后等一两分钟，Pages 会自动重新发布。

> ⚠️ **改了 `js/` 或 `css/` 记得把 `index.html` 里的 `?v=` 加一**，
> 否则访客会一直跑缓存的旧版本。详见下面「改完代码要给资源加版本号」。

### 常见问题

| 现象 | 原因与处理 |
|---|---|
| `gh: command not found` | 重开一个终端窗口（装完 PATH 才生效），或把 `C:\Program Files\GitHub CLI` 加进 PATH |
| `authentication failed` / 403 | 登录过期了，重跑第一步 |
| `Name already exists on this account` | 仓库名 `dqq` 你已经有同名的了，换一个名字 |
| `remote origin already exists` | 之前加过 remote。`git remote remove origin` 再重试 |
| 推送后网页 404 | Pages 还没开启，或者刚开还在构建（等 2 分钟）；确认访问的是仓库名对应的网址 |
| 网页打开是白的 | 打开浏览器控制台看报错。多半是 `?v=` 版本号没改，浏览器拿了旧 JS |
| 不想装 gh | 去 github.com 网页新建一个**空仓库**（不要勾 README / .gitignore / license），然后 `git remote add origin https://github.com/你的用户名/dqq.git` + `git push -u origin main` |

## 自定义域名

打算绑定 **jxsdfz.bbroot.com**（DNSHE 注册的免费域名）。目前还没配完，下面是踩过坑之后的正确顺序。

### ⚠️ 顺序很关键：先配 DNS，再在 GitHub 设域名

**千万别反过来。** 这条是踩出来的：

在 GitHub 上设了自定义域名、但 DNS 还没配好的话，GitHub 过几分钟会开始把
`shanewhatthesix.github.io/dqq` **301 到自定义域名**，而那个域名还解析不了 ——
**整个站点直接打不开**。实测到的响应：

```
HTTP/1.1 301 Moved Permanently
Location: http://jxsdfz.bbroot.com/     ← 这个域名当时是 NXDOMAIN
```

**更坑的地方**：刚设完那几分钟 github.io 还是 200，看着一切正常，
要等重定向传播开（我这边大约几分钟）才会暴露出问题。
所以**别拿"刚设完还能访问"来判断安全** —— 我第一次就是这么误判的。

### 第一步：在 DNSHE 加解析记录

`bbroot.com` 的 NS 是 `a.nic.dnshe.org` / `b.nic.dnshe.org`，登录 DNSHE 控制台，
在 `bbroot.com` 的 DNS 解析里加一条：

| 字段 | 填什么 |
|---|---|
| 记录类型 | `CNAME` |
| 主机记录 / 名称 | `jxsdfz` |
| 记录值 / 目标 | `shanewhatthesix.github.io` |
| TTL | 600 或默认 |

三个容易填错的地方：

1. **目标不要带仓库名** —— 是 `shanewhatthesix.github.io`，不是 `shanewhatthesix.github.io/dqq`
2. 主机记录只填 `jxsdfz`（除非面板明确要求填完整域名）
3. 有些面板要求结尾带点：`shanewhatthesix.github.io.`

### 第二步：确认 DNS 真的生效了，再往下走

```bash
nslookup jxsdfz.bbroot.com 8.8.8.8
```

结果里出现 `shanewhatthesix.github.io` 或 `185.199.10x.153` 这类 GitHub Pages 的 IP 才算通。
**看到 NXDOMAIN 就停在这里，别去动 GitHub 的设置。**

也可以直接试访问：`curl -I http://jxsdfz.bbroot.com/`

### 第三步：DNS 通了之后，再在 GitHub 设域名

```bash
gh api --method PUT /repos/shanewhatthesix/dqq/pages -f "cname=jxsdfz.bbroot.com"
```

GitHub 会自动往仓库里提交一个 `CNAME` 文件（内容就是域名），然后：

1. 校验 DNS 并自动签发 Let's Encrypt 证书（可能要几十分钟）
2. 证书好了之后，在 **Settings → Pages** 勾选 **Enforce HTTPS**

查进度：

```bash
gh api /repos/shanewhatthesix/dqq/pages   --jq '.cname + " | DNS:" + (.protected_domain_state // "未校验") + " | HTTPS强制:" + (.https_enforced|tostring)'
```

### 万一搞坏了怎么退回

只要把自定义域名清空，github.io 立刻恢复（我实测过，几十秒内生效）：

```bash
gh api --method PUT /repos/shanewhatthesix/dqq/pages -f "cname="
```

GitHub 会自动删掉仓库里的 `CNAME` 文件，然后本地 `git fetch && git reset --hard origin/main` 对齐。

### 换域名

改 DNSHE 里的记录，再执行一次上面的 PUT 命令。**不要在网页上手改 `CNAME` 文件**，会被覆盖。

## 改完代码要给资源加版本号

`index.html` 里每个 css / js 引用后面都挂着 `?v=1.0.1`：

```html
<script src="js/ui-creator.js?v=1.0.1"></script>
```

**改了 `js/` 或 `css/` 之后一定要把这个号 +1，并同步 `js/data.js` 里的 `DQQ.VERSION`。**

原因：浏览器对静态资源用启发式缓存，GitHub Pages 也不会主动让缓存失效。
不换版本号的话，学生那边会一直跑缓存的旧文件，出现「代码明明改了但没生效」这种
最难查的问题。（我自己在开发时就踩过一次。）

## 已知限制

- **稀有度之间存在碾压**：这是设计使然（传说就是比普通强），跨稀有度对战请开公平模式
- **同稀有度内战也有强弱差**：克制表本身就是石头剪刀布，一个角色能吃死另一个
  （最容易翻车的是把主力全押在粉笔上 —— 打学霸和教师都只有 0.5 倍）。
  创建页面会检查属性覆盖面并提醒你。当前预设的同稀有度胜率区间是 21%~83%
- **改预设数值不会影响已有存档**：`PRESET_CRICKETS` 只在蛐蛐库为空时灌一次，
  之后玩家库里存的是自己的副本。后人改了预设数值，老玩家需要手动删掉重加，
  或者在「设置 → 恢复预设角色」里补回来
- **战斗上限 30 回合**：超过就按剩余血量比例判定，避免僵持局
- **localStorage 容量约 5MB**：CG 图片占大头，存不下时会提示你删几只带图的
- **浏览器直连大模型可能被 CORS 拦截**：这是浏览器安全策略，不是 bug，用离线生成器即可
- **3v3 是同一台设备轮流操作**，还没做联网对战

---

## 内容安全

- 角色用泛称，**不要指名道姓真实的人**，不要上传真人照片
- 在线 AI 的提示词里已经写了"不要设计人身攻击、侮辱性内容"，但 AI 不一定百分百听话，
  **存进蛐蛐库前请自己过一眼**
- 所有数据只存在玩家自己的浏览器里，不上传任何服务器

---

## 一句话总结

上传身边人当角色 + AI 生成技能 + 属性克制 + 3v3 真人对战 + 1v1 随机斗蛐蛐 + 技能 CG + AI 解说 + 战报可分享。

---

江西师大附中 · 电子科创社团
