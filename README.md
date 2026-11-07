# Something Ventured

这个仓库里有三样东西：

| | 地址 | 是什么 |
| --- | --- | --- |
| 官网 | `/` | 俱乐部官网：一部「六章的电影」 |
| **会员端 Web App** | `/app/` | library live 的会员 App（PWA，可「添加到主屏幕」）：非会员看到一座图书馆，会员看到它的机器层（ASCII 终端）。按分区订座、白天签到与座谈、会员卡、隐藏内容 |
| **管理后台** | `/admin/` | 门店后台：确认订单并安排桌号、座位图、入场核验、会员与入会审核、邀请函、会员时间、活动、内容分层、账目、操作日志、规则 |

三者都是纯 HTML / CSS / JS，**没有任何依赖、没有构建步骤、不加载任何境外 CDN**（字体全部自托管），在大陆网络和微信内置浏览器里都能打开。会员端和后台共用一套数据与业务规则（`shared/core.js`，依据《执行规格 v0.3》与 v0.3 新规则），由一个零依赖的 Node 小服务器提供 API。

## 快速开始

```bash
npm start
```

需要 Node 18 以上，不用 `npm install`。启动后打开：

- 官网 <http://localhost:8080/>
- 会员端 <http://localhost:8080/app/>（电脑上会显示在一个手机框里；手机连同一个 Wi-Fi，打开终端里打印的局域网地址）
- 管理后台 <http://localhost:8080/admin/>

| 演示账号 | 怎么进 |
| --- | --- |
| 会员 林知远 No.0007 | 会员端「登录」页点「会员 林知远」，或手机号 `138 0000 0007` + 验证码 `2026` |
| 非会员、审核中、待补资料、待付款、受邀人、已到期 | 同一页的演示身份；手机号见 [docs/web-app.md](docs/web-app.md#演示身份) |
| 后台员工 | 周行（店长）或前台，PIN `1215` |

会员端「我的」和后台「规则与设置」里有**演示时钟**（全站同步），可以让 19:00 的日夜切换随时发生。数据存在 `server/data/db.json`，`npm run reset` 恢复初始数据（后台也有「重置演示数据」）。`npm test` 跑 38 个验收用例。

**没有服务器也能看**：把整个仓库放到任意静态托管上（或 `python3 -m http.server`），会员端和后台会自动切到「本地演示模式」，同一套规则在浏览器里运行，数据存在本机；同一浏览器里打开两个标签页，彼此实时同步。

会员端与后台的完整说明（设计、功能、与执行规格的差异、十分钟演示脚本、部署、待定事项）见 **[docs/web-app.md](docs/web-app.md)**。

---

## 官网

Something Ventured 俱乐部官网：一部「六章的电影」。内容依据《Something Ventured 俱乐部介绍》（2026.10 内部同步版）。

视觉上取对称构图、粉彩布景、章节标题卡和剖面布景（Wes Anderson 式的美感）；交互上用滚动驱动的镜头、翻页式时刻表、⌘K 礼宾台、实时合成的配乐，给 AI / VC / 机器人行业的人一点机械感和彩蛋。

## 本地预览（只看官网）

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 片单

| 场次 | 内容 | 交互 |
| --- | --- | --- |
| 片头 | 粉色胶片倒数 3·2·1 → 红丝绒幕布拉开 | 每次会话只放一次，可点击跳过 |
| 开场 | 杭州那栋楼的对称立面：屋顶招牌就是 wordmark，三层楼分别是 Library / Night / Dining & Bar；下雪 | 鼠标视差；向下滚动时镜头推进、大门打开；底部字幕 + 翻页式开业倒计时 |
| 预告片 | “In a world where everything can be generated…” 五张标题卡 | 圆形光圈（iris）转场；AI 待办清单逐条打勾；可「Skip intro」 |
| 第一章 · 名字 | Nothing → Something 的改稿动画；纪录片出处 | 机场式翻页时刻表：1950s 风投 → Intel、Atari、Apple、Genentech、Cisco → 2026 杭州 Library「Now boarding」 |
| 第二章 · 俱乐部 | 一个身份，而不是一张消费卡；四项会员权益 | 酒店钥匙柜：在「顾客 / 会员」之间切换，看一把钥匙能开几扇门 |
| 第三章 · 折叠空间 | 一条街被折叠进一栋楼 | 滚动驱动：三家店铺叠成三层楼 → 屋顶落下 → 外立面卷起，露出剖面和楼层标注；手机上镜头会推近 |
| 第四章 · 图书馆 | 不是会所，不是酒吧，是图书馆 | 黄铜开关切换白天（仅会员）/ 夜晚（对公众开放）；墙上的钟显示杭州实时时间；借书卡盖章 |
| 第五章 · 仅限推荐 | 推荐 → 筛选 → 入会仪式 → 欢迎 | 横向跟拍镜头穿过四个房间；影院灯箱「Coming attractions」列出筹备中的活动 |
| 第六章 · 申请 | 登记卡式申请表 | 会员卡实时显示填写内容，可 3D 翻面、随鼠标转出镭射光泽；提交后盖上「In diligence · 尽调中」 |
| 片尾 | 演职员表、「No moments in this club were generated.」、Fin. | Rewind 回到开头 |

贯穿全片的小东西：

- **⌘K / Ctrl+K 礼宾台**：输入目的地即可跳转，也能开关音乐、切换 Library 昼夜；右上角的铃铛按钮同效。
- **Sound**：右上角开启后，浏览器实时合成一段拨弦配乐（Karplus–Strong，无音频文件），翻页、开关、盖章、按铃都有音效。默认关闭。
- **底部 HUD**：当前章节 + 胶片时间码（整页按 6 分 40 秒计）。
- **自定义光标**：桌面端悬停按钮时显示动作（APPLY / FLIP / LIGHTS…）。

## 降级

- `prefers-reduced-motion`：不播片头、不做滚动镜头，所有场景直接显示最终画面。
- 没有 JavaScript：整部片按顺序平铺成静态卡片，内容完整可读。

## 上线前清单

- [ ] **申请表接口**：`index.html` 里 `#apply-form` 的 `data-endpoint` 目前为空，表单只做本地演示、不会发送任何数据。填上接收 POST JSON 的地址后才会真正提交。字段：`name, venture, sector, base, lead, contact, thesis, submitted_at, page`。
- [ ] **分享图**：`og:image`（`assets/img/og.png`）现在是相对路径，部署后请改成带域名的绝对地址。微信里的分享卡片需要另外接入微信 JS-SDK。
- [ ] **托管**：部署到大陆服务器需要 ICP 备案。
- [ ] **文案确认**：内部资料里的一些表述在页面上做了公开化处理（没有写年龄段，「形式设计中」改为「入会时揭晓」，规划中的内容都标了「规划中 / 筹备中」）。上线前请与团队核对。
- [ ] **插画**：楼的立面与剖面是风格化插画，不是真实建筑的样子。
- [ ] **Wordmark**：页面上的 wordmark 用 Jost（开源的 Futura 风格字体）排出；如有正式标志文件，替换招牌、导航和片尾即可。

## 文件

```
index.html               官网：全部结构与插画（SVG）
assets/css/style.css     官网样式
assets/js/main.js        官网：场景、翻页牌、礼宾台、表单与会员卡
assets/js/sound.js       官网：配乐与音效（Web Audio）
assets/fonts/            自托管字体（官网与会员端共用）
assets/img/              分享图与图标
app/                     会员端 Web App（PWA）：index.html、app.css、app.js、ascii.js（字符动画）、manifest、service worker、图标
admin/                   管理后台：index.html、admin.css、admin.js
shared/core.js           数据模型、演示数据与全部业务规则（服务器与浏览器共用）
shared/plan.js           店内平面图：分区、桌位，画成墨线 SVG 或纯 ASCII
shared/plan.css          墨线平面图的样式（会员端与后台共用）
shared/api.js            前端调用层：服务器模式 / 本地演示模式 / 离线
shared/ui.js             模板、日期（杭州时间）、提示
server/server.js         零依赖 Node 服务器：静态文件 + /api + 实时推送（SSE）
scripts/build-fonts.py   重新生成字体子集（官网；--app 生成会员端与后台的子集）
scripts/build-icons.mjs  渲染会员端图标与 iOS 启动图（需要 Playwright）
scripts/smoke.mjs        验收用例（npm test）
docs/web-app.md          会员端与后台说明
```

## 字体

| 用途 | 字体 | 文件 |
| --- | --- | --- |
| 标题、标签、wordmark | Jost（Futura 风格，可变字体） | `assets/fonts/jost-latin-var.woff2` |
| 英文衬线、斜体字幕 | Source Serif 4（可变字体） | `assets/fonts/source-serif-4-latin-var*.woff2` |
| 中文标题 | Noto Serif SC SemiBold，**只包含页面用到的字** | `assets/fonts/noto-serif-sc-600-subset.woff2` |
| 时间码、编号 | IBM Plex Mono | `assets/fonts/ibm-plex-mono-latin-*.woff2` |
| 中文正文 | 系统字体（苹方 / 微软雅黑） | — |

**改了中文文案后要重新生成中文字体子集**，否则新出现的字会回落到系统字体：

```bash
pip install fonttools brotli
mkdir -p /tmp/sv-fonts && (cd /tmp/sv-fonts && npm pack @fontsource/noto-serif-sc @fontsource-variable/source-serif-4 @fontsource-variable/jost @fontsource/ibm-plex-mono && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar -xzf "$f" -C "${f%.tgz}"; done)
python3 scripts/build-fonts.py /tmp/sv-fonts
```

会员端和后台的中文标题用另一份子集（`noto-serif-sc-600-app.woff2`），改了 `app/`、`admin/`、`shared/` 里的中文后运行：

```bash
python3 scripts/build-fonts.py --app /tmp/sv-fonts
```

所有字体均为 SIL Open Font License。
