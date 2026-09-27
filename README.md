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

## 建到 GitHub 组织下（社团共用）

社团仓库挂在组织下比挂个人账号好：学生能一起协作，负责人换届也不用改仓库地址。

### 部署脚本已经支持

`deploy\一键部署.bat` 第二步会问「组织名」：

- **留空** → 建在你自己的账号下
- **填组织名**（比如 `jxsdfz-club`）→ 建到组织下

脚本会自动换成 `POST /orgs/{org}/repos` 这个接口，仓库地址和在线试玩地址也会跟着用组织名。

> 建到组织下**权限要求不一样**：你必须是组织成员，而且角色要能建仓库。
> 如果 Token 没被组织授权过，接口会返回 403/404。脚本会把可能的原因列出来，
> 实在不行就在组织页面手动建一个空仓库，再重跑脚本推送。

### 创建组织

网页右上角头像 → **Your organizations** → **New organization** → 选 **Free**。

| 要填的 | 说明 |
|---|---|
| 组织名 | 会直接进网址（`github.com/组织名`）和 Pages 地址（`组织名.github.io`）。**改名会连带改仓库地址**，最好一次定好 |
| 联系邮箱 | 建议用社团邮箱或指导老师的，别用某个学生的个人邮箱 |
| 归属 | 选「My personal account」，这样你自己是 Owner |

### 费用

- **组织本身免费**（Free 计划），公开仓库数量不限
- 私有仓库在 Free 计划下能用，但**没有 GitHub Pages**、也没有受保护分支。
  所以这个项目**保持 public**
- 学校可以申请 **GitHub Education / GitHub Campus Program**，通过后能拿到
  Team 级功能。具体条件和权益以官网为准，值得试一下

### 把已有的仓库搬过去

`dqq` 已经建在个人账号下了，不用重建，直接转移：

仓库 → **Settings** → 拉到最下面 **Danger Zone** → **Transfer ownership** → 填组织名。

转移之后：

- 仓库地址变成 `github.com/组织名/dqq`
- **Pages 地址也会跟着变**，要去 Settings → Pages 里确认一下，并更新 README 里的链接
- 旧地址 GitHub 会自动做 301 跳转，老链接不会立刻失效

### 组织里加人

组织 → **People** → **Invite member**。

权限建议收着给：

| 角色 | 给谁 |
|---|---|
| **Write** | 只改代码的学生 |
| **Maintain** | 负责合并、发布的骨干 |
| **Owner** | 指导老师 / 社长，最多两三个（Owner 能删仓库） |

另外可以把组织的默认仓库权限设成 **Read** 或 **None**，按仓库单独授权更安全。

## 在学校机房部署（Windows 7）

给机房电脑单独备了一套脚本，在 `deploy/` 目录里，**双击就能跑**。

| 文件 | 用途 |
|---|---|
| `deploy/一键部署.bat` | 提交 - 建仓库 - 推送 - 开 Pages，一条龙 |
| `deploy/清除凭据.bat` | 抹掉本机保存的 Token（公用电脑用完跑一下） |

### 用之前

**Windows 7 必须装对 Git 版本。** 官方从 v2.47.0 起就不支持 Win7 了，
v2.48 的安装包甚至会主动拒绝安装。Win7 上要用 **2.46.2**：

- 64 位：https://github.com/git-for-windows/git/releases/download/v2.46.2.windows.1/Git-2.46.2-64-bit.exe
- 32 位：https://github.com/git-for-windows/git/releases/download/v2.46.2.windows.1/Git-2.46.2-32-bit.exe

脚本检测不到 git 时会直接把这些地址打出来。

### 怎么用

1. 把整个项目文件夹拷到机房电脑（U 盘 / 局域网共享都行，`deploy` 子目录要在项目根目录下）
2. 双击 `deploy\一键部署.bat`
3. 填四项：GitHub 用户名、仓库名、Token、仓库可见性

Token 在 GitHub 网页生成：右上角头像 - Settings - Developer settings -
Personal access tokens - Tokens (classic) - Generate new token，**勾选 `repo` 一项即可**。

跑完会打印仓库地址和在线试玩地址。重复运行是安全的，会直接推送新改动。

### 几个实现上的坑（都踩过）

| 坑 | 处理 |
|---|---|
| **中文编码** | `.bat` 存成 **GBK**。中文版 Windows 的 cmd 代码页是 936，存 UTF-8 会乱码。脚本开头会 `chcp 936`，这样即使系统被改成 65001 也能正常显示 |
| **Token 被提交** | 配置存到 `%USERPROFILE%\.dqq-deploy-config.bat`，也就是**仓库外面**。一开始放在 `deploy/` 里，结果被 GitHub 的密钥扫描拒推（`push declined due to repository rule violations`） |
| **JSON 里的中文** | 建仓库的请求体含中文描述，batch 写出来是 GBK 字节，GitHub 要求 UTF-8，返回 `400 Problems parsing JSON`。改成用 JSON 的 Unicode 转义写法，整行纯 ASCII |
| **`chcp` 吃输入** | `chcp` 会清空 stdin 缓冲区。真人敲键盘没影响（输入还没产生），但用管道喂输入做自动化测试时会读到空值 —— 所以测试要用「延迟送输入」的方式 |
| **批处理语法** | 别在圆括号块里写裸的右括号（会提前闭合代码块）和单个感叹号（会跟后面的变量引用配对）。`^` 号在引号内不是转义符，会原样显示出来 |

### 安全提醒

跑完之后 Token 明文存在两个地方：

- `%USERPROFILE%\.dqq-deploy-config.bat`（仓库外，不会被提交）
- `.git\config` 的 origin 地址里

**公用机房电脑用完请运行 `deploy\清除凭据.bat`**，它会清掉这两处。
另外建议顺手去 GitHub 上撤销那个 Token。

### 机房浏览器要求

游戏的脚本用了 `Promise` / `fetch` / `async`，**需要 Chrome 55 以上**。
Win7 能装的最后一版 Chrome 是 109，可以用。

**不要用 IE 或 360/QQ 浏览器的兼容模式**（IE 内核），跑不起来。
如果机房锁死了浏览器版本，先在教师机上试试能不能打开。

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

登录 DNSHE 控制台，找到 `jxsdfz.bbroot.com` 的 DNS 解析，**推荐直接用 A 记录**（原因见下）。

#### 方案 A：4 条 A 记录（推荐）

| 记录类型 | 记录名称 | 记录内容 | TTL |
|---|---|---|---|
| `A` | `@` | `185.199.108.153` | 自动 |
| `A` | `@` | `185.199.109.153` | 自动 |
| `A` | `@` | `185.199.110.153` | 自动 |
| `A` | `@` | `185.199.111.153` | 自动 |

这四条是 GitHub Pages 的官方 IP。建 4 条是为了冗余，少一条也能用但别只建一条。

#### 方案 B：1 条 CNAME（可能被拒）

| 记录类型 | 记录名称 | 记录内容 | TTL |
|---|---|---|---|
| `CNAME` | `@` | `shanewhatthesix.github.io` | 自动 |

**但 DNSHE 很可能拒绝这条**，因为 `jxsdfz.bbroot.com` 是作为独立 zone 接入的
（DNSHE 官网写的是「子域名通过 NS 委派独立接入」），而 zone 顶点必然有 NS/SOA 记录，
**DNS 规范不允许 CNAME 与其它记录共存于同一名字**。DNSHE 的 API 文档里也专门列了
`cname_conflict` 这个错误码。

用控制台保存 CNAME 时报的 `操作失败，请稍后重试`（带一个 domain-xxx 错误编号）
多半就是这个冲突，而不是真的"稍后重试"。

#### 两个字段最容易填反

面板里「当前域名」已经显示 `jxsdfz.bbroot.com` 了，所以：

- **记录名称填 `@`**（表示"就是这个域名本身"），**不要**把目标域名填在这里 ——
  否则会变成 `shanewhatthesix.github.io.jxsdfz.bbroot.com`
- **记录内容才填目标**：A 记录填 IP，CNAME 填 `shanewhatthesix.github.io`

CNAME 的目标**不要带仓库名**，是 `shanewhatthesix.github.io`，不是 `.../dqq`。

#### 如果只想用 CNAME

可以换个名字，比如记录名称填 `www`，然后把自定义域名设成 `www.jxsdfz.bbroot.com`。
非顶点的 CNAME 一定合法。


### 第二步：确认 DNS 真的生效了，再往下走

```bash
nslookup jxsdfz.bbroot.com 8.8.8.8
```

结果里出现 `shanewhatthesix.github.io` 或 `185.199.10x.153` 这类 GitHub Pages 的 IP 才算通。
**看到 NXDOMAIN 就停在这里，别去动 GitHub 的设置。**

也可以直接试访问：`curl -I http://jxsdfz.bbroot.com/`

> A 记录的话，`nslookup` 会直接返回 `185.199.10x.153`，不会显示 CNAME，这是正常的。

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
